const _ = require('lodash');
const moment = require('moment');
const xml = require('../../../common/xml');
const calEventResponse = require('./event-response');

module.exports = function (options) {
  // const log = winston({ ...opts, label: 'calendar/report/calendar-query' });
  const eventResponse = calEventResponse(options);
  return async function (ctx, calendar) {
    /* https://tools.ietf.org/html/rfc4791#section-9.9 */

    //
    // Step 1: Detect which component type the client is filtering on.
    //
    // Clients may send comp-filter with or without a nested time-range.
    // We first check for time-range filters (used for date-bounded queries),
    // then fall back to bare comp-filter elements (used for type-only queries).
    //
    // Example with time-range (Fantastical, iOS date-range sync):
    //   <C:comp-filter name="VCALENDAR">
    //     <C:comp-filter name="VEVENT">
    //       <C:time-range start="..." end="..."/>
    //     </C:comp-filter>
    //   </C:comp-filter>
    //
    // Example without time-range (iOS initial sync, etag-only fetch):
    //   <C:comp-filter name="VCALENDAR">
    //     <C:comp-filter name="VEVENT"/>
    //   </C:comp-filter>
    //
    const veventTimeRange = xml.get(
      "/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name='VCALENDAR']/CAL:comp-filter[@name='VEVENT']/CAL:time-range",
      ctx.request.xml
    );
    const vtodoTimeRange = xml.get(
      "/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name='VCALENDAR']/CAL:comp-filter[@name='VTODO']/CAL:time-range",
      ctx.request.xml
    );

    // Also detect bare comp-filter (no time-range child) for component type
    const veventCompFilter = xml.get(
      "/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name='VCALENDAR']/CAL:comp-filter[@name='VEVENT']",
      ctx.request.xml
    );
    const vtodoCompFilter = xml.get(
      "/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name='VCALENDAR']/CAL:comp-filter[@name='VTODO']",
      ctx.request.xml
    );

    // Time-range filters take priority (date-bounded query)
    const timeRangeFilters =
      veventTimeRange.length > 0 ? veventTimeRange : vtodoTimeRange;

    // Determine component type from either time-range or bare comp-filter
    let componentType = null;
    if (veventTimeRange.length > 0 || veventCompFilter.length > 0) {
      componentType = 'VEVENT';
    } else if (vtodoTimeRange.length > 0 || vtodoCompFilter.length > 0) {
      componentType = 'VTODO';
    }

    const { children } = xml.getWithChildren(
      '/CAL:calendar-query/D:prop',
      ctx.request.xml
    );
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });

    //
    // Step 2: If no time-range filter, return all events for the
    // requested component type (or all types if no comp-filter).
    //
    if (timeRangeFilters.length === 0) {
      const events = await options.data.getEventsForCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId: options.data.getCalendarId(ctx, calendar),
        user: ctx.state.user,
        fullData,
        componentType
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

    //
    // Step 3: Parse time-range attributes and query by date.
    //
    const filter = timeRangeFilters[0];
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

    const events = await options.data.getEventsByDate(ctx, {
      principalId: ctx.state.params.principalId,
      calendarId: options.data.getCalendarId(ctx, calendar),
      start,
      end,
      user: ctx.state.user,
      fullData,
      componentType
    });
    return eventResponse(ctx, events, calendar, children);
  };
};
