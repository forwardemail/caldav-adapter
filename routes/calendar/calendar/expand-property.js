const { response, status } = require('../../../common/x-build');
const winston = require('../../../common/winston');

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/report/expand-property' });
  return async function (ctx) {
    // ,calendar
    log.debug('returning blank 200 response');
    return { responses: [response(ctx.url, status[200])] };
  };
};
