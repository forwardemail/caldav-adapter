const log = require('../../../lib/winston')('calendar/report');

const { splitPrefix } = require('../../../lib/xParse');
const { build, multistatus, notFound } = require('../../../lib/xBuild');

module.exports = function(opts) {
  const rootActions = {
    /* https://tools.ietf.org/html/rfc4791#section-7.8 */
    'calendar-query': require('./calendar-query')(opts),
    /* https://tools.ietf.org/html/rfc4791#section-7.9 */
    'calendar-multiget': require('./calendar-multiget')(opts),
    /* https://tools.ietf.org/html/rfc3253#section-3.8 */
    'expand-property': require('./expand-property')(opts),
    /* https://tools.ietf.org/html/rfc6578#section-3.2 */
    'sync-collection': require('./sync-collection')(opts)
  };
  const exec = async function(ctx, reqXml, calendar) {
    const root = Object.keys(reqXml)[0];
    const rootTag = splitPrefix(root);
    const rootAction = rootActions[rootTag];
    log.debug(`report ${rootAction ? 'hit' : 'miss'}: ${rootTag}`);
    if (!rootAction) {
      return notFound(ctx.url);
    }
    const { responses, other } = await rootAction(ctx, reqXml, calendar);
    const ms = multistatus(responses, other);
    return build(ms);
  };
  
  return {
    exec
  };
};
