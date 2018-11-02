const xml = require('../../common/xml');
const { build, multistatus, response, status } = require('../../common/xBuild');
const _ = require('lodash');

module.exports = function(opts) {
  const tags = require('../../common/tags')(opts);
  const tagActions = {
    // 'addressbook-home-set': () => '',
    /* https://tools.ietf.org/html/rfc6638#section-2.4.1 */
    // 'calendar-user-address-set': () => '',
    // 'checksum-versions': () => '',
    // 'directory-gateway': () => '',
    // 'email-address-set': () => '',
    /* https://tools.ietf.org/html/rfc2518#section-13.5 */
    // 'getcontenttype': () => '',
    /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt */
    // 'notification-URL': () => '',
    /* https://tools.ietf.org/html/rfc5842#section-3.1 */
    // 'resource-id': () => ''
    /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
    // 'supported-report-set': () => '',
    /* https://tools.ietf.org/html/rfc6578#section-3 */
    // 'sync-token': () => '<d:sync-token>555</d:sync-token>',
  };
  return async function(ctx) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const actions = _.map(children, async (child) => {
      return await tags.getResponse(child, ctx);
    });
    const res = await Promise.all(actions);
    
    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
};
