const log = require('../lib/winston')('calendar');

const path = require('path');
const { parse, splitPrefix } = require('../lib/xParse');
const { build, multistatus, response, status, notFound } = require('../lib/xBuild');
const _ = require('lodash');
const moment = require('moment');

module.exports = function(opts) {
  const methods = {};
  methods.propfind = async function(ctx, reqXml, calendar) {
    const tagActions = {
      /* https://tools.ietf.org/html/rfc6578#section-3 */
      'sync-token': async () => { return { 'D:sync-token': calendar.syncToken }; },
      /* DEPRECATED - https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt */
      'getctag': async () => { return { 'CS:getctag': calendar.syncToken }; },
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
      'resource-id': ''
    };
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`propfind ${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction();
    });
    const res = await Promise.all(actions);
    
    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };

  methods.report = async function(ctx, reqXml, calendar) {
    const tagActions = {
      /* https://tools.ietf.org/html/rfc4791#section-9.5 */
      'calendar-query': async () => {
        const propActions = {
          /* https://tools.ietf.org/html/rfc4791#section-5.3.4 */
          'getetag': async (event) => {
            return { 'D:getetag': event.createdOn };
          },
          'getcontenttype': async () => {
            return { 'D:getcontenttype': 'text/calendar; charset=utf-8; component=VEVENT' };
          },
          /* https://tools.ietf.org/html/rfc4791#section-9.6 */
          // 'calendar-data': async (event) => {
          //   return {
          //     'CAL:calendar-data': event.iCalendar
          //   };
          // }
        };

        const filters = _.get(reqXml, 'B:calendar-query.B:filter[0].B:comp-filter');
        if (!filters) { return null; }
        const cFilter = _.find(filters, (f) => _.get(f, '$.name') === 'VCALENDAR');
        if (!cFilter) { return null; }
        const eFilter = _.find(cFilter['B:comp-filter'], (f) => _.get(f, '$.name') === 'VEVENT');
        if (!eFilter) { return null; }
        /* https://tools.ietf.org/html/rfc4791#section-9.9 */
        const timeRange = eFilter['B:time-range'];
        if (!timeRange || !timeRange[0]) { return null; }
        const start = timeRange[0].$.start ? moment(timeRange[0].$.start).unix() : null;
        const end = timeRange[0].$.end ? moment(timeRange[0].$.end).unix() : null;
        const events = await opts.getEventsByDate(ctx.state.params.userId, calendar.calendarId, start, end);

        const propTags = _.get(reqXml, 'B:calendar-query.A:prop[0]');
        const eventActions = _.map(events, async (event) => {
          const pActions = _.map(propTags, async (v, k) => {
            const p = splitPrefix(k);
            const pAction = propActions[p];
            log.debug(`report calendar-query ${pAction ? 'hit' : 'miss'}: ${p}`);
            if (!pAction) { return null; }
            return await pAction(event);
          });
          const pRes = await Promise.all(pActions);
          const url = path.join(ctx.url, `${event.eventId}.ics`);
          return response(url, status[200], _.compact(pRes));
        });
        return await Promise.all(eventActions);
      }
    };
    const root = Object.keys(reqXml)[0];
    const rootTag = splitPrefix(root);
    const rootAction = tagActions[rootTag];
    log.debug(`report ${rootAction ? 'hit' : 'miss'}: ${rootTag}`);
    if (!rootAction) {
      return notFound(ctx.url);
    }
    const res = await rootAction();
    const ms = multistatus(res);
    return build(ms);
  };

  return async function(ctx) {
    const reqXml = await parse(ctx.request.body);
    const method = ctx.method.toLowerCase();

    // check calendar exists & user has access
    const calendar = await opts.getCalendar(ctx.state.params.userId, ctx.state.params.calendarId);
    if (!calendar) {
      log.warn(`calendar not found: ${ctx.state.params.calendarId}`);
      return notFound(ctx.url);
    }
    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      return notFound(ctx.url);
    }

    ctx.body = await methods[method](ctx, reqXml, calendar);
  };
};
