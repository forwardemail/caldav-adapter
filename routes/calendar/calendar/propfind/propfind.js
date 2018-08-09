const log = require('../../../../lib/winston')('calendar/propfind');

const { splitPrefix } = require('../../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../../lib/xBuild');
const _ = require('lodash');
const path = require('path');


module.exports = function(opts) {
  const tagActions = {
    /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
    // 'supported-report-set': () => '',
    // 'addressbook-home-set': () => '',
    /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-sharing.txt */
    'allowed-sharing-modes': async () => {
      return { 'CS:allowed-sharing-modes': '' };
    },
    'calendar-color': async (ctx, calendar) => {
      return { 'ICAL:calendar-color': calendar.color };
    },
    /* https://tools.ietf.org/html/rfc4791#section-6.2.1 */
    // 'calendar-home-set': () => '',
    // 'calendar-order': () => '',
    /* https://tools.ietf.org/html/rfc4791#section-5.2.2 */
    // 'calendar-timezone': async () => '',
    /* https://tools.ietf.org/html/rfc6638#section-2.4.1 */
    // 'calendar-user-address-set': () => '',
    // 'directory-gateway': () => '',
    /* https://tools.ietf.org/html/rfc4918#section-15.2 */
    'displayname': async (ctx, calendar) => { return { 'D:displayname': calendar.calendarName }; },
    // 'email-address-set': () => '',
    /* https://tools.ietf.org/html/rfc2518#section-13.5 */
    'getcontenttype': async () => { return { 'D:getcontenttype': 'text/calendar; charset=utf-8' }; },
    /* DEPRECATED - https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt */
    'getctag': async (ctx, calendar) => { return { 'CS:getctag': calendar.syncToken }; },
    'getetag': async (ctx, calendar) => { return { 'D:getetag': calendar.createdOn }; },
    /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt */
    // 'notification-URL': () => '',
    /* https://tools.ietf.org/html/rfc3744#section-5.1 */
    'owner': async (ctx) => {
      return { 'D:owner': { href: path.join(opts.principalRoute, ctx.state.params.userId) } };
    },
    /* https://tools.ietf.org/html/rfc3744#section-5.8 */
    // 'principal-collection-set': () => '',
    /* https://tools.ietf.org/html/rfc3744#section-4.2 */
    'principal-URL': async (ctx) => {
      return { 'D:principal-URL': path.join(opts.principalRoute, ctx.state.params.userId) };
    },
    // 'resource-id': () => ''
    /* https://tools.ietf.org/html/rfc4791#section-4.2 */
    'resourcetype': async () => {
      return {
        'D:resourcetype': {
          'D:collection': '',
          'CAL:calendar': ''
        }
      };
    },
    /* https://tools.ietf.org/html/rfc6638#appendix-B.5 */
    // 'schedule-outbox-URL': () => '',
    /* https://tools.ietf.org/html/rfc4791#section-5.2.3 */
    'supported-calendar-component-set': async () => {
      return {
        'CAL:supported-calendar-component-set': {
          'CAL:comp': {
            '@name': 'VEVENT'
          }
        }
      };
    },
    /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
    'supported-report-set': async () => {
      return {
        'D:supported-report-set': {
          'D:supported-report': [
            { 'D:report': { 'CAL:calendar-query': '' } },
            { 'D:report': { 'CAL:calendar-multiget': '' } },
            { 'D:report': { 'CAL:sync-collection': '' } }
          ]
        }
      };
    },
    /* https://tools.ietf.org/html/rfc6578#section-3 */
    'sync-token': async (ctx, calendar) => { return { 'D:sync-token': calendar.syncToken }; },
  };

  const calendarResponse = async function(ctx, reqXml, calendar) {
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx, calendar);
    });
    const res = await Promise.all(actions);
    
    return response(ctx.url, status[200], _.compact(res));
  };

  const exec = async function(ctx, reqXml, calendar) {
    const resps = calendarResponse(ctx, reqXml, calendar);
    const ms = multistatus([resps]);
    return build(ms);
  };

  return {
    exec,
    calendarResponse
  };
};
