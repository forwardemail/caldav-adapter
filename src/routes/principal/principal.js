const { notFound } = require('../../common/xBuild');
const { setMultistatusResponse, setOptions } = require('../../common/response');

module.exports = function(opts) {
  const log = require('../../common/winston')({ ...opts, label: 'principal' });
  const methods = {
    propfind: require('./propfind')(opts),
    // report: require('./report')(opts)
  };

  return async function(ctx) {
    const method = ctx.method.toLowerCase();
    setMultistatusResponse(ctx);

    if (method === 'options') {
      return setOptions(ctx, ['OPTIONS', 'PROPFIND']);
    }
    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      return ctx.body = notFound(ctx.url);
    }

    ctx.body = await methods[method](ctx);
  };
};
