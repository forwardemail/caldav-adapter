const { response, status } = require('../../../common/xBuild');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/report/expand-property' });
  return async function(ctx/*, calendar*/) {
    log.debug('returning blank 200 response');
    return { responses: [response(ctx.url, status[200])] };
  };
};
