const xml = require('../../common/xml');
const { build, multistatus, response, status } = require('../../common/xBuild');
const _ = require('lodash');
const path = require('path');

module.exports = function(opts) {
  const log = require('../../common/winston')({ ...opts, label: 'principal/propfind' });
  const tagActions = {
    // 'addressbook-home-set': () => '',
    /* https://tools.ietf.org/html/rfc4791#section-6.2.1 */
    'calendar-home-set': async (ctx) => {
      return {
        'CAL:calendar-home-set': {
          'D:href': path.join(opts.calendarRoute, ctx.state.user.user, '/')
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
          'D:href': path.join(opts.principalRoute, ctx.state.user.user, '/')
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
        'D:principal-collection-set': { 'D:href': opts.principalRoute }
      };
    },
    /* https://tools.ietf.org/html/rfc3744#section-4.2 */
    'principal-URL': async (ctx) => {
      return {
        'D:principal-URL': {
          'D:href': path.join(opts.principalRoute, ctx.state.user.user, '/')
        }
      };
    },
    /* https://tools.ietf.org/html/rfc5842#section-3.1 */
    // 'resource-id': () => ''
    /* https://tools.ietf.org/html/rfc6638#section-2.2 */
    'schedule-inbox-URL': async () => {
      return {
        'CAL:schedule-inbox-URL': {
          'D:href': '' // empty for now
        }
      };
    },
    /* https://tools.ietf.org/html/rfc6638#section-2.1 */
    'schedule-outbox-URL': async () => {
      return {
        'CAL:schedule-outbox-URL': {
          'D:href': '' // empty for now
        }
      };
    },
    /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
    // 'supported-report-set': () => '',
    /* https://tools.ietf.org/html/rfc6578#section-3 */
    // 'sync-token': () => '<d:sync-token>555</d:sync-token>',
  };
  return async function(ctx) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const actions = _.map(children, async (child) => {
      const tag = child.localName;
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
