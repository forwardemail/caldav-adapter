const { notFound } = require('../../common/x-build');
const { setMultistatusResponse, setOptions } = require('../../common/response');
const winston = require('../../common/winston');
const routePropfind = require('./propfind');
const routeMkCalendar = require('./mkcalendar');
// const routeReport = require('./report');

module.exports = function (options) {
  const log = winston({ ...options, label: 'principal' });
  const methods = {
    propfind: routePropfind(options),
    // report: reportReport(opts)
    mkcalendar: routeMkCalendar(options)
  };

  return async function (ctx) {
    const method = ctx.method.toLowerCase();
    setMultistatusResponse(ctx);

    if (method === 'options') {
      setOptions(ctx, ['OPTIONS', 'PROPFIND']);
      return;
    }

    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      ctx.body = notFound(ctx.url);
      return;
    }

    ctx.body = await methods[method](ctx);
  };
};
