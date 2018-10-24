const xml = require('../../../common/xml');
const { build, multistatus, response, status } = require('../../../common/xBuild');
const _ = require('lodash');
const path = require('path');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/propfind' });
  const eventResponse = require('./eventResponse')(opts);
  const tagActions = {
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
    /* https://tools.ietf.org/html/rfc5397#section-3 */
    'current-user-principal': async (ctx) => {
      return {
        'D:current-user-principal': {
          'D:href': path.join(opts.principalRoute, ctx.state.user.user, '/')
        }
      };
    },
    /* https://tools.ietf.org/html/rfc3744#section-5.4 */
    'current-user-privilege-set': async () => {
      return {
        'D:current-user-privilege-set': {
          'D:privilege': [
            { 'D:read': '' },
            { 'D:read-acl': '' },
            { 'D:read-current-user-privilege-set': '' },
            { 'D:write': '' },
            { 'D:write-acl': '' },
            { 'D:write-content': '' },
            { 'D:write-properties': '' },
            { 'D:bind': '' }, // PUT - https://tools.ietf.org/html/rfc3744#section-3.9
            { 'D:unbind': '' }, // DELETE - https://tools.ietf.org/html/rfc3744#section-3.10
            { 'CAL:read-free-busy': '' }, // https://tools.ietf.org/html/rfc4791#section-6.1.1
          ]
        }
      };
    },
    // 'directory-gateway': () => '',
    /* https://tools.ietf.org/html/rfc4918#section-15.2 */
    'displayname': async (ctx, calendar) => { return { 'D:displayname': calendar.calendarName }; },
    // 'email-address-set': () => '',
    /* https://tools.ietf.org/html/rfc2518#section-13.5 */
    'getcontenttype': async () => { return { 'D:getcontenttype': 'text/calendar; charset=utf-8; component=VEVENT' }; },
    /* DEPRECATED - https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt */
    'getctag': async (ctx, calendar) => { return { 'CS:getctag': calendar.syncToken }; },
    // 'getetag': async (ctx, calendar) => { return { 'D:getetag': calendar.lastUpdatedOn }; },
    /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt */
    // 'notification-URL': () => '',
    /* https://tools.ietf.org/html/rfc3744#section-5.1 */
    'owner': async (ctx) => {
      return {
        'D:owner': {
          'D:href': path.join(opts.principalRoute, ctx.state.params.userId, '/')
        }
      };
    },
    /* https://tools.ietf.org/html/rfc3744#section-5.8 */
    // 'principal-collection-set': () => '',
    /* https://tools.ietf.org/html/rfc3744#section-4.2 */
    'principal-URL': async (ctx) => {
      return { 'D:principal-URL': path.join(opts.principalRoute, ctx.state.params.userId, '/') };
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

  const calendarResponse = async function(ctx, calendar) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];
    const actions = _.map(children, async (child) => {
      const tag = child.localName;
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx, calendar);
    });
    const res = await Promise.all(actions);
    
    const url = path.join(opts.calendarRoute, ctx.state.params.userId, calendar.calendarId, '/');
    const props = _.compact(res);
    return response(url, props.length ? status[200] : status[404], props);
  };

  const exec = async function(ctx, calendar) {
    const resp = await calendarResponse(ctx, calendar);
    const resps = [resp];
    
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const events = await opts.getEventsForCalendar(ctx.state.params.userId, calendar.calendarId);
    const { responses } = await eventResponse(ctx, events, calendar, children);
    resps.push(...responses);

    const ms = multistatus(resps);
    return build(ms);
  };

  return {
    exec,
    calendarResponse
  };
};
