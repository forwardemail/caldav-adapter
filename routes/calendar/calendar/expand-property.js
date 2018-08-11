const log = require('../../../lib/winston')('calendar/report/expand-property');

const { response, status } = require('../../../lib/xBuild');

module.exports = function(/*opts*/) {
  return async function(ctx/*, reqXml, calendar*/) {
    log.debug('returning blank 200 response');
    return { responses: [response(ctx.url, status[200])] };
  };
};
