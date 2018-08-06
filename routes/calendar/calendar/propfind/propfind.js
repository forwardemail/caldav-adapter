const log = require('../../../../lib/winston')('calendar/propfind');

const { splitPrefix } = require('../../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../../lib/xBuild');
const _ = require('lodash');

const tagActions = {
  /* https://tools.ietf.org/html/rfc6578#section-3 */
  'sync-token': async (ctx, calendar) => { return { 'D:sync-token': calendar.syncToken }; },
  /* DEPRECATED - https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt */
  'getctag': async (ctx, calendar) => { return { 'CS:getctag': calendar.syncToken }; },
  /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
  // 'supported-report-set': () => '',
  /* https://tools.ietf.org/html/rfc3744#section-4.2 */
  // 'principal-URL': () => '',
  /* https://tools.ietf.org/html/rfc4918#section-15.2 */
  // 'displayname': () => '',
  /* https://tools.ietf.org/html/rfc3744#section-5.8 */
  // 'principal-collection-set': () => '',
  /* https://tools.ietf.org/html/rfc4791#section-6.2.1 */
  // 'calendar-home-set': () => '',
  /* https://tools.ietf.org/html/rfc6638#appendix-B.5 */
  // 'schedule-outbox-URL': () => '',
  /* https://tools.ietf.org/html/rfc6638#section-2.4.1 */
  // 'calendar-user-address-set': () => '',
  /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt */
  // 'notification-URL': () => '',
  /* https://tools.ietf.org/html/rfc2518#section-13.5 */
  // 'getcontenttype': () => '',
  // 'addressbook-home-set': () => '',
  // 'directory-gateway': () => '',
  // 'email-address-set': () => '',
  // 'resource-id': () => ''
};

module.exports = function(/*opts*/) {
  return async function(ctx, reqXml, calendar) {
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx, calendar);
    });
    const res = await Promise.all(actions);
    
    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
};
