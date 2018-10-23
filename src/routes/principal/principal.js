const { notFound } = require('../../common/xBuild');
const { setMultistatusResponse } = require('../../common/response');

module.exports = function(opts) {
  const log = require('../../common/winston')({ ...opts, label: 'principal' });
  const methods = {
    propfind: require('./propfind')(opts),
    report: require('./report')(opts)
  };

  return async function(ctx) {
    const method = ctx.method.toLowerCase();
    setMultistatusResponse(ctx);

    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      return ctx.body = notFound(ctx.url);
    }

    ctx.body = await methods[method](ctx);
  };
};
