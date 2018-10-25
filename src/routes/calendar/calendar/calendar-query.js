const xml = require('../../../common/xml');
const _ = require('lodash');
const moment = require('moment');

module.exports = function(opts) {
  // const log = require('../../../common/winston')({ ...opts, label: 'calendar/report/calendar-query' });
  const eventResponse = require('./eventResponse')(opts);
  return async function(ctx, calendar) {
    /* https://tools.ietf.org/html/rfc4791#section-9.9 */
    const filters = xml.get('/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name=\'VCALENDAR\']/CAL:comp-filter[@name=\'VEVENT\']/CAL:time-range', ctx.request.xml);
    if (!filters || !filters[0]) { return { responses: [] }; }
    const filter = filters[0];
    const startAttr = _.find(filter.attributes, { localName: 'start' });
    const start = startAttr ? moment(startAttr.nodeValue).unix() : null;
    const endAttr = _.find(filter.attributes, { localName: 'end' });
    const end = endAttr ? moment(endAttr.nodeValue).unix() : null;
    const events = await opts.data.getEventsByDate({
      principalId: ctx.state.params.principalId,
      calendarId: calendar.calendarId,
      start: start,
      end: end
    });

    const propNode = xml.get('/CAL:calendar-query/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];
    
    return await eventResponse(ctx, events, calendar, children);
  };
};
