import { CalDavOptions, CalDavAuthPrincipal } from '.';
import { posix as path } from 'path';
import { pathToRegexp, Key } from 'path-to-regexp';
import basicAuth from 'basic-auth';
import parseBody from './common/parseBody';
import winston from './common/winston';
import cal from './routes/calendar/calendar';
import pri from './routes/principal/principal';
import { Request, ParameterizedContext } from 'koa';
import { FullCalendar } from 'ical';

interface CalendarRequest extends Request {
  body?: string;
  xml?: Document;
  ical?: FullCalendar;
}

export interface CalendarState {
  user?: CalDavAuthPrincipal;
  params: {
      principalId?: string;
      [key: string]: any;
  };
  [key: string]: any;
}

export interface CalendarContext extends ParameterizedContext<CalendarState> {
  request: CalendarRequest;
}

const defaults = {
  caldavRoot: '/',
  calendarRoot: 'cal',
  principalRoot: 'p',
  logEnabled: false
};
type CalRegex = {
  keys: Key[];
  regexp?: RegExp;
};

export default function(opts: CalDavOptions) {
  opts = Object.assign(defaults, opts);

  const log = winston({ ...opts, label: 'index' });

  const rootRoute = path.join('/', opts.caldavRoot);
  const calendarRoute = path.join(rootRoute, opts.calendarRoot);
  const principalRoute = path.join(rootRoute, opts.principalRoot, '/');

  const rootRegexp = pathToRegexp(path.join(rootRoute, '/:params*'));
  const calendarRegex: CalRegex = { keys: [] };
  calendarRegex.regexp = pathToRegexp(path.join(calendarRoute, '/:principalId/:calendarId?/:eventId*'), calendarRegex.keys);
  const principalRegex: CalRegex = { keys: [] };
  principalRegex.regexp = pathToRegexp(path.join(principalRoute, '/:principalId?'), principalRegex.keys);

  const calendarRoutes = cal({
    logEnabled: opts.logEnabled,
    logLevel: opts.logLevel,
    proId: opts.proId,
    data: opts.data
  });

  const principalRoutes = pri({
    logEnabled: opts.logEnabled,
    logLevel: opts.logLevel,
    proId: opts.proId,
    data: opts.data
  });

  const fillParams = function(ctx: CalendarContext) {
    ctx.state.params = {};

    let regex;
    if (calendarRegex.regexp.test(ctx.url)) {
      regex = calendarRegex;
    } else if (principalRegex.regexp.test(ctx.url)) {
      regex = principalRegex;
    }
    if (!regex) { return; }

    const captures = ctx.url.match(regex.regexp);
    for (let i = 0; i < regex.keys.length; i++) {
      let captured = captures[i + 1];
      if (typeof captured === 'string') {
        captured = decodeURIComponent(captured);
      }
      ctx.state.params[regex.keys[i].name] = captured;
      if (typeof captured === 'string' && captured.endsWith('.ics')) {
        ctx.state.params[regex.keys[i].name] = captured.slice(0, -4);
      }
    }
  };

  const auth = async function(ctx: CalendarContext) {
    const creds = basicAuth(ctx);
    if (!creds) {
      ctx.status = 401;
      ctx.response.set('WWW-Authenticate', `Basic realm="${opts.authRealm}"`);
      return false;
    }
    ctx.state.user = await opts.authenticate({
      username: creds.name,
      password: creds.pass,
      principalId: ctx.state.params.principalId
    });
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.response.set('WWW-Authenticate', `Basic realm="${opts.authRealm}"`);
      return false;
    }
    if (!ctx.state.params.principalId) {
      ctx.state.params.principalId = ctx.state.user.principalId;
    }
    return true;
  };

  const fillRoutes = function(ctx: CalendarContext) {
    ctx.state.principalRootUrl = principalRoute;
    if (ctx.state.params.principalId) {
      ctx.state.calendarHomeUrl = path.join(calendarRoute, ctx.state.params.principalId, '/');
      ctx.state.principalUrl = path.join(principalRoute, ctx.state.params.principalId, '/');
      if (ctx.state.params.calendarId) {
        ctx.state.calendarUrl = path.join(calendarRoute, ctx.state.params.principalId, ctx.state.params.calendarId, '/');
      }
    }
  };

  return async function(ctx: CalendarContext, next) {
    if (ctx.url.toLowerCase() === '/.well-known/caldav' && !opts.disableWellKnown) {
      // return ctx.redirect(rootRoute);
      ctx.status = 404;
      return;
    }

    if (!rootRegexp.test(ctx.url)) {
      await next();
      return;
    }
    ctx.state.caldav = true;
    fillParams(ctx);
    const authed = await auth(ctx);
    if (!authed) { return; }
    fillRoutes(ctx);

    await parseBody(ctx);
    log.verbose(`REQUEST BODY: ${ctx.request.body ? ('\n' + ctx.request.body) : 'empty'}`);

    if (calendarRegex.regexp.test(ctx.url)) {
      await calendarRoutes(ctx);
    } else if (principalRegex.regexp.test(ctx.url)) {
      await principalRoutes(ctx);
    } else {
      ctx.redirect(principalRoute);
      return;
    }
    log.verbose(`RESPONSE BODY: ${ctx.body ? ('\n' + ctx.body) : 'empty'}`);
  };
}
