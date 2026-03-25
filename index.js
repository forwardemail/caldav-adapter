const path = require('node:path');
const { pathToRegexp } = require('path-to-regexp');
const basicAuth = require('basic-auth');
const parseBody = require('./common/parse-body');
const winston = require('./common/winston');
const { setMultistatusResponse } = require('./common/response');
const {
  build,
  buildTag,
  href,
  multistatus,
  response,
  status
} = require('./common/x-build');
const cal = require('./routes/calendar/calendar');
const pri = require('./routes/principal/principal');

const defaults = {
  caldavRoot: '/',
  calendarRoot: 'cal',
  principalRoot: 'p',
  logEnabled: false
};

module.exports = function (options) {
  // avoid mutating shared `defaults` object
  options = { ...defaults, ...options };

  const log = winston({ ...options, label: 'index' });

  const rootRoute = path.join('/', options.caldavRoot);
  const calendarRoute = path.join(rootRoute, options.calendarRoot);
  const principalRoute = path.join(rootRoute, options.principalRoot, '/');

  const rootRegexp = pathToRegexp(path.join(rootRoute, '/:params*'));
  const calendarRegex = { keys: [] };
  calendarRegex.regexp = pathToRegexp(
    path.join(calendarRoute, '/:principalId/:calendarId?/:eventId*'),
    calendarRegex.keys
  );
  const principalRegex = { keys: [] };
  principalRegex.regexp = pathToRegexp(
    path.join(principalRoute, '/:principalId?'),
    principalRegex.keys
  );

  const calendarRoutes = cal({
    logEnabled: options.logEnabled,
    logLevel: options.logLevel,
    data: options.data
  });

  const principalRoutes = pri({
    logEnabled: options.logEnabled,
    logLevel: options.logLevel,
    data: options.data
  });

  const fillParameters = function (ctx) {
    ctx.state.params = {};

    // use ctx.path instead of ctx.url to avoid query string matching
    let regex;
    if (calendarRegex.regexp.test(ctx.path)) {
      regex = calendarRegex;
    } else if (principalRegex.regexp.test(ctx.path)) {
      regex = principalRegex;
    }

    if (!regex) {
      return;
    }

    const captures = ctx.path.match(regex.regexp);
    for (let i = 0; i < regex.keys.length; i++) {
      let captured = captures[i + 1];
      if (typeof captured === 'string') {
        captured = decodeURIComponent(captured);
      }

      ctx.state.params[regex.keys[i].name] = captured;
      //
      // NOTE: We no longer strip .ics extension here.
      // The caldav-server.js now handles flexible lookup for both
      // eventId with and without .ics extension for backwards compatibility.
      // This preserves the original eventId as sent by the client.
      //
    }
  };

  const auth = async function (ctx) {
    const creds = basicAuth(ctx);
    if (!creds) {
      ctx.status = 401;
      ctx.response.set(
        'WWW-Authenticate',
        `Basic realm="${options.authRealm}"`
      );
      return false;
    }

    ctx.state.user = await options.authenticate(ctx, {
      username: creds.name,
      password: creds.pass,
      principalId: ctx.state.params.principalId
    });
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.response.set(
        'WWW-Authenticate',
        `Basic realm="${options.authRealm}"`
      );
      return false;
    }

    if (!ctx.state.params.principalId) {
      ctx.state.params.principalId = ctx.state.user.principalId;
    }

    return true;
  };

  const fillRoutes = function (ctx) {
    ctx.state.principalRootUrl = principalRoute;
    if (ctx.state.params.principalId) {
      ctx.state.calendarHomeUrl = path.join(
        calendarRoute,
        ctx.state.params.principalId,
        '/'
      );
      ctx.state.principalUrl = path.join(
        principalRoute,
        ctx.state.params.principalId,
        '/'
      );
      if (ctx.state.params.calendarId) {
        ctx.state.calendarUrl = path.join(
          calendarRoute,
          ctx.state.params.principalId,
          ctx.state.params.calendarId,
          '/'
        );
      }
    }
  };

  //
  // RFC 4918 Section 9.1 / RFC 6764 Section 5:
  // When a PROPFIND hits the root (caldavRoot), return a 207 multistatus
  // with current-user-principal so clients can discover the principal URL
  // without following redirects.  This is the standard CalDAV discovery
  // flow: clients PROPFIND the root, read current-user-principal, then
  // PROPFIND the principal URL for calendar-home-set.
  //
  // Previously the adapter returned a 302 redirect to /principals/,
  // which some clients (notably iOS/macOS Calendar) do not follow
  // correctly for PROPFIND requests.
  //
  const handleRootPropfind = function (ctx) {
    const dav = 'DAV:';
    const calNs = 'urn:ietf:params:xml:ns:caldav';

    const props = [
      {
        [buildTag(dav, 'current-user-principal')]: href(ctx.state.principalUrl)
      },
      {
        [buildTag(dav, 'resourcetype')]: {
          [buildTag(dav, 'collection')]: ''
        }
      }
    ];

    // If the client also asked for calendar-home-set or principal-URL,
    // include them so the client can skip the principal PROPFIND entirely
    if (ctx.state.calendarHomeUrl) {
      props.push({
        [buildTag(calNs, 'calendar-home-set')]: href(ctx.state.calendarHomeUrl)
      });
    }

    const resps = response(ctx.url, status[200], props);
    const ms = multistatus([resps]);
    setMultistatusResponse(ctx);
    ctx.body = build(ms);
  };

  return async function (ctx, next) {
    // use 301 permanent redirect per RFC 6764 Section 5
    if (
      ctx.path.toLowerCase() === '/.well-known/caldav' &&
      !options.disableWellKnown
    ) {
      ctx.status = 301;
      ctx.redirect(rootRoute);
      return;
    }

    // use ctx.path instead of ctx.url
    if (!rootRegexp.test(ctx.path)) {
      await next();
      return;
    }

    ctx.state.caldav = true;
    fillParameters(ctx);
    const authed = await auth(ctx);
    if (!authed) {
      return;
    }

    fillRoutes(ctx);

    await parseBody(ctx);
    log.verbose('REQUEST BODY', ctx?.request?.body || '<empty>');

    // use ctx.path instead of ctx.url
    if (calendarRegex.regexp.test(ctx.path)) {
      await calendarRoutes(ctx);
    } else if (principalRegex.regexp.test(ctx.path)) {
      await principalRoutes(ctx);
    } else if (ctx.method.toLowerCase() === 'propfind') {
      //
      // Handle PROPFIND at the root URL (caldavRoot).
      // Return 207 with current-user-principal so CalDAV clients
      // can discover the principal URL without following redirects.
      //
      handleRootPropfind(ctx);
    } else {
      //
      // For non-PROPFIND methods at the root (e.g. OPTIONS handled
      // upstream, or unexpected methods), redirect to the principal URL.
      //
      ctx.redirect(principalRoute);
      return;
    }

    log.verbose('RESPONSE BODY', ctx.body || '<empty>');
  };
};
