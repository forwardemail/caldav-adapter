const { notFound } = require('../../common/x-build');
const {
  setMissingMethod,
  setMultistatusResponse,
  setOptions
} = require('../../common/response');
const winston = require('../../common/winston');
const routePropfind = require('./propfind');
const routeMkCalendar = require('./mkcalendar');
// const routeReport = require('./report');

module.exports = function (options) {
  const log = winston({ ...options, label: 'principal' });
  const methods = {
    propfind: routePropfind(options),
    get: routePropfind(options), // Handle GET same as PROPFIND for redirected requests
    // report: reportReport(opts)
    //
    // TODO: proppatch
    // NOTE: fennel implements this with 403 forbidden
    // <https://github.com/LordEidi/fennel.js/blob/abfc371701fcb2581d8f1382426f0ef9e9846554/handler/principal.js#L317-L340>
    //
    mkcalendar: routeMkCalendar(options)
  };

  return async function (ctx) {
    const method = ctx.method.toLowerCase();

    if (method === 'options') {
      setOptions(ctx, ['OPTIONS', 'PROPFIND', 'GET']);
      return;
    }

    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      setMissingMethod(ctx);
      ctx.body = notFound(ctx.url);
      return;
    }

    setMultistatusResponse(ctx);
    ctx.body = await methods[method](ctx);
  };
};
