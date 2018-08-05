const log = require('../../../lib/winston')('calendar/report/calendar-query');

const { splitPrefix } = require('../../../lib/xParse');
const { response, status } = require('../../../lib/xBuild');
const path = require('path');
const _ = require('lodash');
const moment = require('moment');

const tagActions = {
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

module.exports = function(opts) {
  return async function(ctx, reqXml, calendar) {
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
      const propActions = _.map(propTags, async (v, k) => {
        const tag = splitPrefix(k);
        const tagAction = tagActions[tag];
        log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
        if (!tagAction) { return null; }
        return await tagAction(event);
      });
      const pRes = await Promise.all(propActions);
      const url = path.join(ctx.url, `${event.eventId}.ics`);
      return response(url, status[200], _.compact(pRes));
    });
    return await Promise.all(eventActions);
  };
};
