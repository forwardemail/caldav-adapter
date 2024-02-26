const { notFound } = require('../../common/x-build');
const { setMultistatusResponse, setOptions } = require('../../common/response');
const winston = require('../../common/winston');
const routerUserPropfind = require('./user/propfind');
// const routerUserProppatch = require('./user/proppatch');
const routerCalPropfind = require('./calendar/propfind');
const routerCalReport = require('./calendar/report');
const routerCalGet = require('./calendar/get');
// const routerCalProppatch = require('./calendar/proppatch');
const routerCalPut = require('./calendar/put');
const routerCalDelete = require('./calendar/delete');

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
    // proppatch: routerCalProppatch(opts),
    put: routerCalPut(options),
    delete: routerCalDelete(options)
  };

  return async function (ctx) {
    const method = ctx.method.toLowerCase();
    const { calendarId } = ctx.state.params;
    setMultistatusResponse(ctx);

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

      if (!calendar) {
        log.warn(`calendar not found: ${calendarId}`);
        ctx.body = notFound(ctx.url);
        return;
      }

      if (!calMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        ctx.body = notFound(ctx.url);
        return;
      }

      const body = await calMethods[method].exec(ctx, calendar);
      if (body) {
        ctx.body = body;
      }
    } else {
      if (method === 'options') {
        setOptions(ctx, ['OPTIONS', 'PROPFIND']);
        return;
      }

      if (!userMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        ctx.body = notFound(ctx.url);
        return;
      }

      ctx.body = await userMethods[method].exec(ctx);
    }
  };
};
