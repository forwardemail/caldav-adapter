const log = require('../../../lib/winston')('principal/propfind');

const { splitPrefix } = require('../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../lib/xBuild');
const _ = require('lodash');
const path = require('path');

module.exports = function(opts) {
  const tagActions = {
    // 'addressbook-home-set': () => '',
    /* https://tools.ietf.org/html/rfc4791#section-6.2.1 */
    'calendar-home-set': async (ctx) => {
      return {
        'CAL:calendar-home-set': {
          href: path.join(opts.calendarRoute, ctx.state.user.user)
        }
      };
    },
    /* https://tools.ietf.org/html/rfc6638#section-2.4.1 */
    // 'calendar-user-address-set': () => '',
    // 'checksum-versions': () => '',
    /* https://tools.ietf.org/html/rfc5397#section-3 */
    'current-user-principal': async (ctx) => {
      return {
        'D:current-user-principal': {
          href: path.join(opts.principalRoute, ctx.state.user.user)
        }
      };
    },
    // 'directory-gateway': () => '',
    /* https://tools.ietf.org/html/rfc4918#section-15.2 */
    'displayname': async (ctx) => {
      return {
        'D:displayname': ctx.state.user.user
      };
    },
    // 'email-address-set': () => '',
    /* https://tools.ietf.org/html/rfc2518#section-13.5 */
    // 'getcontenttype': () => '',
    /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt */
    // 'notification-URL': () => '',
    /* https://tools.ietf.org/html/rfc3744#section-5.8 */
    'principal-collection-set': async () => {
      return {
        'D:principal-collection-set': { href: opts.principalRoute }
      };
    },
    /* https://tools.ietf.org/html/rfc3744#section-4.2 */
    'principal-URL': async (ctx) => {
      return {
        'D:principal-URL': {
          href: path.join(opts.principalRoute, ctx.state.user.user)
        }
      };
    },
    /* https://tools.ietf.org/html/rfc5842#section-3.1 */
    // 'resource-id': () => ''
    /* https://tools.ietf.org/html/rfc6638#appendix-B.5 */
    // 'schedule-outbox-URL': () => '',
    /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
    // 'supported-report-set': () => '',
    /* https://tools.ietf.org/html/rfc6578#section-3 */
    // 'sync-token': () => '<d:sync-token>555</d:sync-token>',
  };
  return async function(ctx, reqXml) {
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx);
    });
    const res = await Promise.all(actions);
    
    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
};
