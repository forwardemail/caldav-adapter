const { notFound } = require('../../common/x-build');
const {
  setMissingMethod,
  setMultistatusResponse,
  setOptions
} = require('../../common/response');
const winston = require('../../common/winston');
const routePropfind = require('./propfind');
const routeGet = require('./get');
const routeMkCalendar = require('./mkcalendar');
const routeReport = require('./report');

module.exports = function (options) {
  const log = winston({ ...options, label: 'principal' });
  const methods = {
    propfind: routePropfind(options),
    get: routeGet(options),
    //
    // RFC 3744 Section 9.4/9.5: principal-property-search and
    // principal-search-property-set are REPORT methods on the
    // principal resource.  Some clients (including Apple Calendar)
    // use these during discovery.
    //
    report: routeReport(options),
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
      setOptions(ctx, ['OPTIONS', 'PROPFIND', 'REPORT', 'GET']);
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
