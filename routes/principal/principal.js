const log = require('../../lib/winston')('principal');

const { parse } = require('../../lib/xParse');
const { notFound } = require('../../lib/xBuild');

module.exports = function(opts) {
  const methods = {
    propfind: require('./propfind/propfind')(opts)
  };

  return async function(ctx) {
    const reqXml = await parse(ctx.request.body);
    const method = ctx.method.toLowerCase();

    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      return notFound(ctx.url);
    }

    ctx.body = await methods[method](ctx, reqXml);
  };
};
