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
    //
    // Check if XML was parsed successfully
    // Per RFC 4918 Section 8.2: "If a server receives XML that is not
    // well-formed, then the server MUST reject the entire request with
    // a 400 (Bad Request)."
    //
    // ctx.request.xml can be null if:
    // 1. The XML body is empty
    // 2. The XML body is malformed and fails to parse
    // 3. The Content-Type is incorrect
    //
    if (!ctx.request.xml || !ctx.request.xml.documentElement) {
      log.debug('report rejected: invalid or empty XML body');
      ctx.status = 400;
      ctx.body = 'Bad Request: invalid or missing XML body';
      return;
    }

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
