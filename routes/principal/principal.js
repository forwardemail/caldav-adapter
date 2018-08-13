const log = require('../../lib/winston')('principal');

const { parse } = require('../../lib/xParse');
const { notFound } = require('../../lib/xBuild');
const { setMultistatusResponse } = require('../../lib/response');

module.exports = function(opts) {
  const methods = {
    propfind: require('./propfind')(opts),
    report: require('./report')(opts)
  };

  return async function(ctx) {
    const reqXml = await parse(ctx.request.body);
    const method = ctx.method.toLowerCase();
    setMultistatusResponse(ctx);
    
    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      return ctx.body = notFound(ctx.url);
    }

    ctx.body = await methods[method](ctx, reqXml);
  };
};
