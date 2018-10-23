const path = require('path');
const pathToRegexp = require('path-to-regexp');
const auth = require('basic-auth');

const parseBody = require('./common/parseBody');
const { setOptions } = require('./common/response');

const defaults = {
  caldavRoot: '/',
  calendarRoot: 'cal',
  principalRoot: 'p',
  logEnabled: false
};

const getParams = function(keys, captures) {
  const params = {};
  for (let i = 0; i < keys.length; i++) {
    params[keys[i].name] = captures[i + 1];
    if (typeof captures[i + 1] === 'string' && captures[i + 1].endsWith('.ics')) {
      params[keys[i].name] = captures[i + 1].slice(0, -4);
    }
  }
  return params;
};

module.exports = function(opts) {
  opts = Object.assign(defaults, opts);

  const log = require('./common/winston')({ ...opts, label: 'index' });

  const rootRoute = path.resolve('/', opts.caldavRoot);
  const calendarRoute = path.join(rootRoute, opts.calendarRoot);
  const principalRoute = path.join(rootRoute, opts.principalRoot, '/');

  const rootRegexp = pathToRegexp(path.join(rootRoute, '/:params*'));
  const calendarKeys = [];
  const calendarRegexp = pathToRegexp(path.join(calendarRoute, '/:userId/:calendarId?/:eventId*'), calendarKeys);
  const principalKeys = [];
  const principalRegexp = pathToRegexp(path.join(principalRoute, '/:params*'), principalKeys);

  const calendarRoutes = require('./routes/calendar/calendar')({
    logEnabled: opts.logEnabled,
    logLevel: opts.logLevel,
    calendarRoute: calendarRoute,
    principalRoute: principalRoute,
    domain: opts.domain,
    proId: opts.proId,
    getCalendar: opts.getCalendar,
    getCalendarsForUser: opts.getCalendarsForUser,
    updateCalendar: opts.updateCalendar,
    getEventsForCalendar: opts.getEventsForCalendar,
    getEventsByDate: opts.getEventsByDate,
    getEvent: opts.getEvent,
    createEvent: opts.createEvent,
    updateEvent: opts.updateEvent,
    deleteEvent: opts.deleteEvent
  });

  const principalRoutes = require('./routes/principal/principal')({
    logEnabled: opts.logEnabled,
    calendarRoute: calendarRoute,
    principalRoute: principalRoute,
  });

  return async function(ctx, next) {
    if (ctx.url.toLowerCase() === '/.well-known/caldav' && !opts.disableWellKnown) {
      return ctx.redirect(rootRoute);
    }

    if (!rootRegexp.test(ctx.url)) {
      return await next();
    }

    const creds = auth(ctx);
    if (!creds) {
      ctx.status = 401;
      ctx.response.set('WWW-Authenticate', `Basic realm="${opts.authRealm}"`);
      return;
    }
    ctx.state.user = await opts.authMethod(creds.name, creds.pass);
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.response.set('WWW-Authenticate', `Basic realm="${opts.authRealm}"`);
      return;
    }

    if (ctx.method === 'OPTIONS') {
      return setOptions(ctx);
    }

    await parseBody(ctx);
    log.verbose(`REQUEST BODY: ${ctx.request.body ? ('\n' + ctx.request.body) : 'empty'}`);

    if (calendarRegexp.test(ctx.url)) {
      const captures = ctx.url.match(calendarRegexp);
      ctx.state.params = getParams(calendarKeys, captures);
      await calendarRoutes(ctx);
    } else if (principalRegexp.test(ctx.url)) {
      const captures = ctx.url.match(principalRegexp);
      ctx.state.params = getParams(principalKeys, captures);
      await principalRoutes(ctx);
    } else {
      return ctx.redirect(principalRoute);
    }
    log.verbose(`RESPONSE BODY: ${ctx.body ? ('\n' + ctx.body) : 'empty'}`);
  };
};
