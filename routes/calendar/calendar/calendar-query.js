const _ = require('lodash');
const moment = require('moment');
const xml = require('../../../common/xml');
const calEventResponse = require('./event-response');

module.exports = function (options) {
  // const log = winston({ ...opts, label: 'calendar/report/calendar-query' });
  const eventResponse = calEventResponse(options);
  return async function (ctx, calendar) {
    /* https://tools.ietf.org/html/rfc4791#section-9.9 */
    const filters = xml.get(
      "/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name='VCALENDAR']/CAL:comp-filter[@name='VEVENT']/CAL:time-range",
      ctx.request.xml
    );
    const { children } = xml.getWithChildren(
      '/CAL:calendar-query/D:prop',
      ctx.request.xml
    );
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });

    if (!filters?.[0]) {
      const events = await options.data.getEventsForCalendar({
        principalId: ctx.state.params.principalId,
        calendarId: options.data.getCalendarId(calendar),
        user: ctx.state.user,
        fullData
      });

      return eventResponse(ctx, events, calendar, children);
    }

    //
    // TODO: support rest of calendar-query
    // <https://datatracker.ietf.org/doc/html/rfc4791#section-7.8>
    //
    // TODO: support multiple filters and missing filters:
    //
    // <https://datatracker.ietf.org/doc/html/rfc4791#section-9.7>
    // - [ ] 9.7.1.  CALDAV:comp-filter XML Element . . . . . . . . . . . . 85
    // - [ ] 9.7.2.  CALDAV:prop-filter XML Element . . . . . . . . . . . . 86
    // - [ ] 9.7.3.  CALDAV:param-filter XML Element  . . . . . . . . . . . 87
    // - [ ] 9.7.4.  CALDAV:is-not-defined XML Element  . . . . . . . . . . 88
    // - [ ] 9.7.5.  CALDAV:text-match XML Element  . . . . . . . . . . . . 88
    //
    // TODO: what else (?)
    //

    const filter = filters[0];
    const startAttr = _.find(filter.attributes, { localName: 'start' });
    const endAttr = _.find(filter.attributes, { localName: 'end' });

    //
    // rudimentary validation
    //
    let start = null;
    let end = null;

    if (
      startAttr &&
      startAttr.nodeValue &&
      moment(startAttr.nodeValue).isValid()
    )
      start = moment(startAttr.nodeValue).toDate();

    if (endAttr && endAttr.nodeValue && moment(endAttr.nodeValue).isValid())
      end = moment(endAttr.nodeValue).toDate();

    const events = await options.data.getEventsByDate({
      principalId: ctx.state.params.principalId,
      calendarId: options.data.getCalendarId(calendar),
      start,
      end,
      user: ctx.state.user,
      fullData
    });
    return eventResponse(ctx, events, calendar, children);
  };
};
