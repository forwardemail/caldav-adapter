const log = require('../../../lib/winston')('principal/propfind');

const { splitPrefix } = require('../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../lib/xBuild');
const _ = require('lodash');

const tagActions = {
  /* https://tools.ietf.org/html/rfc5397#section-3 */
  // 'current-user-principal': () => {
    
  // },
  // 'checksum-versions': '',
  /* https://tools.ietf.org/html/rfc6578#section-3 */
  // 'sync-token': () => '<d:sync-token>555</d:sync-token>',
  /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
  // 'supported-report-set': () => {
  //   return getSupportedReportSet(comm);
  // },
  /* https://tools.ietf.org/html/rfc3744#section-4.2 */
  // 'principal-URL': () => {
  //   return '<d:principal-URL><d:href>/p/' + comm.getUser().getUserName() + '/</d:href></d:principal-URL>\r\n';
  // },
  /* https://tools.ietf.org/html/rfc4918#section-15.2 */
  // 'displayname': () => {
  //   return '<d:displayname>' + comm.getUser().getUserName() + '</d:displayname>';
  // },
  /* https://tools.ietf.org/html/rfc3744#section-5.8 */
  // 'principal-collection-set': () => {
  //   return '<d:principal-collection-set><d:href>' + pRoot + '</d:href></d:principal-collection-set>';
  // },
  /* https://tools.ietf.org/html/rfc4791#section-6.2.1 */
  // 'calendar-home-set': () => {
  //   return '<cal:calendar-home-set><d:href>/cal/' + comm.getUser().getUserName() + '</d:href></cal:calendar-home-set>';
  // },
  /* https://tools.ietf.org/html/rfc6638#appendix-B.5 */
  // 'schedule-outbox-URL': () => {
  //   return '<cal:schedule-outbox-URL><d:href>/cal/' + comm.getUser().getUserName() + '/outbox</d:href></cal:schedule-outbox-URL>';
  // },
  /* https://tools.ietf.org/html/rfc6638#section-2.4.1 */
  // 'calendar-user-address-set': () => {
  //   return getCalendarUserAddressSet(comm);
  // },
  /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt */
  // 'notification-URL': () => {
  //   return '<cs:notification-URL><d:href>/cal/' + comm.getUser().getUserName() + '/notifications/</d:href></cs:notification-URL>';
  // },
  /* https://tools.ietf.org/html/rfc2518#section-13.5 */
  // 'getcontenttype': () => '',
  // 'addressbook-home-set': () => {
  //   return '<card:addressbook-home-set><d:href>/card/' + comm.getUser().getUserName() + '/</d:href></card:addressbook-home-set>';
  // },
  // 'directory-gateway': () => {
  //   return '';
  // },
  // 'email-address-set': () => {
  //   return '<cs:email-address-set><cs:email-address>' + emailAddress + '</cs:email-address></cs:email-address-set>';
  // },
  // 'resource-id': ''
};

module.exports = function(/*opts*/) {
  return async function(ctx, reqXml) {
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const props = _(node)
      .map((v, k) => {
        const tag = splitPrefix(k);
        const tagAction = tagActions[tag];
        log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
        if (!tagAction) { return null; }

      })
      .compact()
      .value();
    
    const res = response(ctx.url, status[200], props);
    const ms = multistatus(res);
    return build(ms);
  };
};
