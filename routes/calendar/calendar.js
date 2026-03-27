const { notFound } = require('../../common/x-build');
const {
  setMissingMethod,
  setMultistatusResponse,
  setOptions
} = require('../../common/response');
const winston = require('../../common/winston');
const routeMkCalendar = require('../principal/mkcalendar');
const routerUserPropfind = require('./user/propfind');
// const routerUserProppatch = require('./user/proppatch');
const routerCalPropfind = require('./calendar/propfind');
const routerCalReport = require('./calendar/report');
const routerCalGet = require('./calendar/get');
const routerCalProppatch = require('./calendar/proppatch');
const routerCalPut = require('./calendar/put');
const routerCalDelete = require('./calendar/delete');
const routerScheduling = require('./scheduling');

/**
 * Dispatch a method handler and assign its return value to ctx.body.
 * Handlers that return a value (e.g. propfind, report) provide the
 * response body directly.  Handlers that manage ctx.status and ctx.body
 * themselves (e.g. put, delete) return undefined; in that case we must
 * NOT overwrite ctx.body, because assigning undefined resets Koa's
 * status to 204.
 */
async function dispatchHandler(ctx, handler, ...args) {
  setMultistatusResponse(ctx);
  if (typeof handler.exec === 'function') {
    const result = await handler.exec(ctx, ...args);
    if (result !== undefined) {
      ctx.body = result;
    }
  } else if (typeof handler === 'function') {
    const result = await handler(ctx, ...args);
    if (result !== undefined) {
      ctx.body = result;
    }
  } else {
    return false;
  }

  return true;
}

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar' });
  const userMethods = {
    propfind: routerUserPropfind(options)
    // proppatch: routerUserProppatch(opts)
  };
  const calMethods = {
    propfind: routerCalPropfind(options),
    report: routerCalReport(options),
    get: routerCalGet(options),
    proppatch: routerCalProppatch(options),
    put: routerCalPut(options),
    delete: routerCalDelete(options),
    mkcalendar: routeMkCalendar(options)
  };

  // Initialize scheduling routes
  const scheduling = routerScheduling(options);

  return async function (ctx) {
    const method = ctx.method.toLowerCase();
    const { calendarId } = ctx.state.params;

    // use exact calendarId match instead of URL substring
    // to prevent routing collisions with calendars named "inbox" or "outbox"
    if (
      calendarId &&
      (calendarId.toLowerCase() === 'inbox' ||
        calendarId.toLowerCase() === 'outbox')
    ) {
      log.debug('Routing to scheduling handler', { url: ctx.url, method });
      return scheduling.route(ctx);
    }

    if (calendarId) {
      // Check calendar exists & user has access
      const calendar = await options.data.getCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId,
        user: ctx.state.user
      });
      if (method === 'options') {
        const methods =
          calendar && calendar.readonly
            ? ['OPTIONS', 'PROPFIND', 'REPORT']
            : ['OPTIONS', 'PROPFIND', 'REPORT', 'PUT', 'DELETE'];
        setOptions(ctx, methods);
        return;
      }

      if (!calendar && method !== 'mkcalendar') {
        log.warn(`calendar not found: ${calendarId}`);
        setMissingMethod(ctx);
        ctx.body = notFound(ctx.url);
        return;
      }

      if (!calMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        setMissingMethod(ctx);
        ctx.body = notFound(ctx.url);
        return;
      }

      try {
        // pass calendar object via ctx.state to avoid
        // redundant getCalendar() calls inside handlers
        ctx.state.calendar = calendar;
        const handled = await dispatchHandler(
          ctx,
          calMethods[method],
          calendar
        );
        if (!handled) {
          log.warn(`method handler not found: ${method}`);
          setMissingMethod(ctx);
          ctx.body = notFound(ctx.url);
        }
      } catch (err) {
        // Only mark as code bug if it's truly unexpected (not a Boom/HTTP error)
        if (!err.isBoom && !err.status) err.isCodeBug = true;
        err.calendarId = calendarId;
        err.principalId = ctx.state.params.principalId;
        err.method = method;
        log.error('calendar method error', err);
        throw err;
      }
    } else {
      if (method === 'options') {
        setOptions(ctx, ['OPTIONS', 'PROPFIND']);
        return;
      }

      if (!userMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        setMissingMethod(ctx);
        ctx.body = notFound(ctx.url);
        return;
      }

      try {
        const handled = await dispatchHandler(ctx, userMethods[method]);
        if (!handled) {
          log.warn(`method handler not found: ${method}`);
          setMissingMethod(ctx);
          ctx.body = notFound(ctx.url);
        }
      } catch (err) {
        // Only mark as code bug if it's truly unexpected (not a Boom/HTTP error)
        if (!err.isBoom && !err.status) err.isCodeBug = true;
        err.principalId = ctx.state.params.principalId;
        err.method = method;
        log.error('user method error', err);
        throw err;
      }
    }
  };
};
