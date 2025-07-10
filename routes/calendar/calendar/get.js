const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');
const {
  response,
  status,
  build,
  multistatus
} = require('../../../common/x-build');

/**
 * Encode special characters for XML content to prevent parsing errors
 * @param {string} str - String to encode
 * @returns {string} - XML-safe encoded string
 */
function encodeXMLEntities(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replaceAll('&', '&amp;') // Must be first to avoid double-encoding
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/get' });

  const exec = async function (ctx, calendar) {
    if (!ctx.state.params.eventId) {
      const events = await options.data.getEventsForCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId: options.data.getCalendarId(ctx, calendar),
        user: ctx.state.user,
        fullData: true
      });

      const ics = await options.data.buildICS(ctx, events, calendar);

      const accept = ctx.accepts(['text/xml', 'text/calendar']);

      if (accept === 'text/xml') {
        const responseObj = response(ctx.url, status[200], [
          {
            'D:getetag': options.data.getETag(ctx, calendar)
          },
          {
            'CAL:calendar-data': encodeXMLEntities(ics)
          }
        ]);
        return build(multistatus([responseObj]));
      }

      // text/calendar
      // application/ics
      // text/x-vcalendar
      // application/octet-stream
      return ics;
    }

    const event = await options.data.getEvent(ctx, {
      eventId: ctx.state.params.eventId,
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      user: ctx.state.user,
      fullData: true
    });
    if (!event) {
      log.debug(`event ${ctx.state.params.eventId} not found`);
      setMissingMethod(ctx);
      return;
    }

    const ics = await options.data.buildICS(ctx, event, calendar);

    const accept = ctx.accepts(['text/xml', 'text/calendar']);

    if (accept === 'text/xml') {
      const responseObj = response(ctx.url, status[200], [
        {
          'D:getetag': options.data.getETag(ctx, calendar)
        },
        {
          'CAL:calendar-data': encodeXMLEntities(ics)
        }
      ]);
      return build(multistatus([responseObj]));
    }

    // text/calendar
    // application/ics
    // text/x-vcalendar
    // application/octet-stream
    return ics;
  };

  return {
    exec
  };
};
