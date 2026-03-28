const _ = require('lodash');
const moment = require('moment');
const xml = require('../../../common/xml');
const calEventResponse = require('./event-response');

//
// RFC 4791 Section 9.7.2 - CALDAV:prop-filter
// RFC 4791 Section 9.7.5 - CALDAV:text-match
//
// Extract an iCalendar property value from raw ICS text.
// Handles folded lines (RFC 5545 Section 3.1) and parameters
// (e.g. STATUS;VALUE=TEXT:COMPLETED).
//
// Returns the property value string, or null if the property
// is not present in the given component block.
//
function getICSPropertyValue(ical, componentType, propertyName) {
  if (!ical || typeof ical !== 'string') return null;

  // Unfold continuation lines (CRLF + whitespace)
  const unfolded = ical.replaceAll(/\r?\n[ \t]/g, '');

  //
  // Find the component block (e.g. BEGIN:VTODO ... END:VTODO)
  // to avoid matching properties from other components.
  //
  const compStart = new RegExp(`^BEGIN:${componentType}\\s*$`, 'mi');
  const compEnd = new RegExp(`^END:${componentType}\\s*$`, 'mi');

  const startMatch = compStart.exec(unfolded);
  if (!startMatch) return null;

  const endMatch = compEnd.exec(unfolded.slice(startMatch.index));
  const block = endMatch
    ? unfolded.slice(startMatch.index, startMatch.index + endMatch.index)
    : unfolded.slice(startMatch.index);

  //
  // Match the property line.  Property names are case-insensitive per RFC 5545.
  // The property may have parameters separated by semicolons before the colon.
  // e.g. STATUS:COMPLETED  or  STATUS;VALUE=TEXT:COMPLETED
  //
  const propRegex = new RegExp(
    `^${_.escapeRegExp(propertyName)}(?:;[^:]*)?:(.*)$`,
    'mi'
  );
  const match = propRegex.exec(block);
  return match ? match[1].trim() : null;
}

//
// Parse prop-filter elements from a comp-filter node.
// Returns an array of { name, isNotDefined, textMatch } objects.
//
// RFC 4791 Section 9.7.2 defines prop-filter matching:
//   - Empty prop-filter: property must exist
//   - is-not-defined child: property must NOT exist
//   - text-match child: property value must match the text
//
function parsePropFilters(compFilterNodes) {
  const propFilters = [];
  if (!compFilterNodes || compFilterNodes.length === 0) return propFilters;

  const compFilterNode = compFilterNodes[0];
  if (!compFilterNode || !compFilterNode.childNodes) return propFilters;

  // eslint-disable-next-line unicorn/prefer-spread
  for (const child of Array.from(compFilterNode.childNodes)) {
    // Only process prop-filter elements in the CalDAV namespace
    if (
      child.localName !== 'prop-filter' ||
      (child.namespaceURI &&
        child.namespaceURI !== 'urn:ietf:params:xml:ns:caldav')
    ) {
      continue;
    }

    const nameAttr = _.find(
      // eslint-disable-next-line unicorn/prefer-spread
      Array.from(child.attributes || []),
      (a) => a.localName === 'name'
    );
    if (!nameAttr) continue;

    const filter = {
      name: nameAttr.nodeValue,
      isNotDefined: false,
      textMatch: null
    };

    // Check for child elements (is-not-defined or text-match)
    if (child.childNodes) {
      // eslint-disable-next-line unicorn/prefer-spread
      for (const grandChild of Array.from(child.childNodes)) {
        if (grandChild.localName === 'is-not-defined') {
          filter.isNotDefined = true;
        } else if (grandChild.localName === 'text-match') {
          const negateAttr = _.find(
            // eslint-disable-next-line unicorn/prefer-spread
            Array.from(grandChild.attributes || []),
            (a) => a.localName === 'negate-condition'
          );
          const collationAttr = _.find(
            // eslint-disable-next-line unicorn/prefer-spread
            Array.from(grandChild.attributes || []),
            (a) => a.localName === 'collation'
          );

          filter.textMatch = {
            value: grandChild.textContent || '',
            negate: negateAttr ? negateAttr.nodeValue === 'yes' : false,
            // Default collation is i;ascii-casemap (case-insensitive)
            collation: collationAttr
              ? collationAttr.nodeValue
              : 'i;ascii-casemap'
          };
        }
      }
    }

    propFilters.push(filter);
  }

  return propFilters;
}

//
// Apply prop-filters to a list of events.
// Each event must have an `ical` property containing the raw ICS text.
// Returns only events that match ALL prop-filter conditions (AND logic per RFC 4791).
//
function applyPropFilters(events, propFilters, componentType) {
  if (!propFilters || propFilters.length === 0) return events;

  return events.filter((event) => {
    // Skip events without ICS data (e.g. etag-only responses)
    if (!event.ical) return true;

    for (const pf of propFilters) {
      const value = getICSPropertyValue(event.ical, componentType, pf.name);
      const propertyExists = value !== null;

      // is-not-defined: property must NOT exist
      if (pf.isNotDefined) {
        if (propertyExists) return false;
        continue;
      }

      // Empty prop-filter (no text-match, no is-not-defined): property must exist
      if (!pf.textMatch) {
        if (!propertyExists) return false;
        continue;
      }

      // text-match: property must exist AND value must match
      if (!propertyExists) return false;

      const caseInsensitive =
        !pf.textMatch.collation || pf.textMatch.collation === 'i;ascii-casemap';

      const eventValue = caseInsensitive ? value.toLowerCase() : value;
      const matchValue = caseInsensitive
        ? pf.textMatch.value.toLowerCase()
        : pf.textMatch.value;

      // Substring match per RFC 4790 Section 4.2
      const contains = eventValue.includes(matchValue);

      // negate-condition inverts the result
      if (pf.textMatch.negate) {
        if (contains) return false;
      } else if (!contains) {
        return false;
      }
    }

    return true;
  });
}

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

    //
    // Step 1b: Parse prop-filter elements from the comp-filter.
    //
    // RFC 4791 Section 9.7.2 - prop-filter specifies search criteria
    // on calendar properties within the matched component.
    //
    // Example (iOS Reminders - exclude completed tasks):
    //   <C:comp-filter name="VCALENDAR">
    //     <C:comp-filter name="VTODO">
    //       <C:prop-filter name="STATUS">
    //         <C:text-match negate-condition="yes">COMPLETED</C:text-match>
    //       </C:prop-filter>
    //     </C:comp-filter>
    //   </C:comp-filter>
    //
    const activeCompFilter =
      componentType === 'VTODO' ? vtodoCompFilter : veventCompFilter;
    const propFilters = parsePropFilters(activeCompFilter);

    const { children } = xml.getWithChildren(
      '/CAL:calendar-query/D:prop',
      ctx.request.xml
    );
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });

    //
    // When prop-filters are present, we need the full ICS data to evaluate
    // property values, even if the client only requested etags.
    //
    const needsFullData = fullData || propFilters.length > 0;

    //
    // Step 2: If no time-range filter, return all events for the
    // requested component type (or all types if no comp-filter).
    //
    if (timeRangeFilters.length === 0) {
      let events = await options.data.getEventsForCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId: options.data.getCalendarId(ctx, calendar),
        user: ctx.state.user,
        fullData: needsFullData,
        componentType
      });

      // Apply prop-filter conditions (RFC 4791 Section 9.7.2)
      if (propFilters.length > 0 && componentType) {
        events = applyPropFilters(events, propFilters, componentType);
      }

      return eventResponse(ctx, events, calendar, children);
    }

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

    let events = await options.data.getEventsByDate(ctx, {
      principalId: ctx.state.params.principalId,
      calendarId: options.data.getCalendarId(ctx, calendar),
      start,
      end,
      user: ctx.state.user,
      fullData: needsFullData,
      componentType
    });

    // Apply prop-filter conditions (RFC 4791 Section 9.7.2)
    if (propFilters.length > 0 && componentType) {
      events = applyPropFilters(events, propFilters, componentType);
    }

    return eventResponse(ctx, events, calendar, children);
  };
};
