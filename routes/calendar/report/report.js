const log = require('../../../lib/winston')('calendar/report');

const { splitPrefix } = require('../../../lib/xParse');
const { build, multistatus, notFound } = require('../../../lib/xBuild');

module.exports = function(opts) {
  const rootActions = {
    'calendar-query': require('./calendar-query')(opts),
    'calendar-multiget': require('./calendar-multiget')(opts)
  };
  return async function(ctx, reqXml, calendar) {
    const root = Object.keys(reqXml)[0];
    const rootTag = splitPrefix(root);
    const rootAction = rootActions[rootTag];
    log.debug(`report ${rootAction ? 'hit' : 'miss'}: ${rootTag}`);
    if (!rootAction) {
      return notFound(ctx.url);
    }
    const res = await rootAction(ctx, reqXml, calendar);
    const ms = multistatus(res);
    return build(ms);
  };
};
