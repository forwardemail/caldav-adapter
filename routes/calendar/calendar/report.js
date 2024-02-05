const { build, multistatus, notFound } = require('../../../common/x-build');
const winston = require('../../../common/winston');
const query = require('./calendar-query');
const multiget = require('./calendar-multiget');
const expand = require('./expand-property');
const sync = require('./sync-collection');

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/report' });
  const rootActions = {
    /* https://tools.ietf.org/html/rfc4791#section-7.8 */
    'calendar-query': query(options),
    /* https://tools.ietf.org/html/rfc4791#section-7.9 */
    'calendar-multiget': multiget(options),
    /* https://tools.ietf.org/html/rfc3253#section-3.8 */
    'expand-property': expand(options),
    /* https://tools.ietf.org/html/rfc6578#section-3.2 */
    'sync-collection': sync(options)
  };
  const exec = async function (ctx, calendar) {
    const rootTag = ctx.request.xml.documentElement.localName;
    const rootAction = rootActions[rootTag];
    log.debug(`report ${rootAction ? 'hit' : 'miss'}: ${rootTag}`);
    if (!rootAction) {
      return notFound(ctx.url);
    }

    const { responses, other } = await rootAction(ctx, calendar);
    const ms = multistatus(responses, other);
    return build(ms);
  };

  return {
    exec
  };
};
