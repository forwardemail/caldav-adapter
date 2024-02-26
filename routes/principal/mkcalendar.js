const _ = require('lodash');
const xml = require('../../common/xml');

// TODO: need to implement tests for MKCALENDAR
// <https://github.com/sabre-io/dav/blob/da8c1f226f1c053849540a189262274ef6809d1c/tests/Sabre/CalDAV/PluginTest.php#L142-L428>
module.exports = function (options) {
  return async function (ctx) {
    const { children } = xml.getWithChildren(
      '/CAL:mkcalendar/D:set/D:prop',
      ctx.request.xml
    );

    const calendar = {};
    for (const child of children) {
      if (!child.localName || !child.textContent) continue;
      switch (child.localName) {
        case 'displayname': {
          calendar.name = child.textContent;

          break;
        }

        case 'calendar-description': {
          calendar.description = child.textContent;

          break;
        }

        case 'calendar-timezone': {
          calendar.timezone = child.textContent;

          break;
        }
        // No default
      }
    }

    // TODO: better error handling
    if (_.isEmpty(calendar)) {
      const err = new TypeError('Calendar update was empty');
      err.xml = ctx.request.body;
      throw err;
    }

    // TODO: we may need to implement this similar workaround
    // <https://github.com/sabre-io/dav/blob/da8c1f226f1c053849540a189262274ef6809d1c/lib/CalDAV/Plugin.php#L294-L304>

    // > Clients SHOULD NOT set the DAV: displayname property to be the same as any other calendar collection at the same URI "level".
    // > If a request body is included, it MUST be a CALDAV:mkcalendar XML element.

    // DAV:displayname
    // CALDAV:calendar-description,
    // CALDAV:supported-calendar-component-set
    // CALDAV:calendar-timezone

    // <c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:ca="http://apple.com/ns/ical/">
    //   <d:set>
    //     <d:prop>
    //       <d:displayname>personal calendar</d:displayname>
    //       <c:calendar-description>some calendar description</c:calendar-description>
    //     </d:prop>
    //   </d:set>
    // </c:mkcalendar>

    const calendarObject = await options.data.createCalendar(ctx, calendar);
    ctx.status = 201;
    ctx.set('ETag', options.data.getETag(ctx, calendarObject));
  };
};
