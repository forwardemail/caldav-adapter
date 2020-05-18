# caldav-adapter

Middleware to handle CalDAV requests to node web server. Works with

* Node v8 or higher
* Koa v2 or higher

This middleware will intercept any requests to the `caldavRoot` URL, authenticate using Basic Authentication, and exposes the following URLs and methods:

* Principal Methods: `OPTIONS`, `PROPFIND`
* Calendar Home Methods: `OPTIONS`, `PROPFIND`
* Calendar Methods: `OPTIONS`, `PROPFIND`, `REPORT`, `GET`, `PUT` & `DELETE` (if calendar is not read-only)

The following CalDAV functionality is supported:

* Creating, updating, deleting one-off (non-recurring) events
* Creating, updating, deleting recurring events (with limited `RRULE` support, see schema)
* Read-only calendars, read-only or read/write events on each calendar

## Installation

```
npm i caldav-adapter
```

## Usage

```js
const Koa = require('koa');
const app = new Koa();

const caldav = require('caldav-adapter');
app.use(adapter.koa({
  authenticate: async ({ username, password }) => {
    if (password === 'pass') {
      return {
        principalId: username,
        principalName: username.toUpperCase()
      };
    }
  },
  authRealm: config.authRealm,
  caldavRoot: 'caldav',
  proId: { company: 'TestCompany', product: 'Calendar', language: 'EN' },
  logEnabled: true,
  logLevel: 'debug',
  data: {
    getCalendar: data.getCalendar,
    getCalendarsForPrincipal: data.getCalendarsForPrincipal,
    getEventsForCalendar: data.getEventsForCalendar,
    getEventsByDate: data.getEventsByDate,
    getEvent: data.getEvent,
    createEvent: data.createEvent,
    updateEvent: data.updateEvent,
    deleteEvent: data.deleteEvent
  }
}));
```

### authenticate(options)

* `options` \<object> Parameters which might have the following properties:
  * `username` \<string>
  * `password` \<string>
* returns: <Promise\<object>> Promise which resolves to the user object, which is passed to all `data.*` functions on each request.

### authRealm

* required: \<string> Realm for Basic Authentication.

### caldavRoot

* optional: \<string> Root URL for CalDAV server (default `/`)

### proId

* required: \<string> Product Identifier passed to [ical-generator](https://github.com/sebbo2002/ical-generator#prodidstringobject-prodid)

### logEnabled

* optional: \<boolean> Enables stdout logging via Winston (default `false`)

### logLevel

* optional: \<string> Log level used by Winston (default `debug`)

### data.getCalendar(options)

* `options` \<object> Parameters which might have the following properties:
  * `calendarId` \<string>
  * `principalId` \<string>
  * `user` \<object>
* returns: <Promise\<[calendar](#calendar-model)>> Promise which resolves to the requested calendar.

### data.getCalendarsForPrincipal(options)

* `options` \<object> Parameters which might have the following properties:
  * `principalId` \<string>
  * `user` \<object>
* returns: <Promise\<[[calendar](#calendar-model)]>> Promise which resolves to an array of the principal's calendars.

### data.getEventsForCalendar(options)

* `options` \<object> Parameters which might have the following properties:
  * `calendarId` \<string>
  * `principalId` \<string>
  * `fullData` \<boolean> Clients will oftentimes request all events for a calendar to check the events' `etag` (lastModifiedOn) field to see whether they need updating. Since this can be an expensive operation for some fields (like description), this will be true if the client is requesting the full `calendar-data`.
  * `user` \<object>
* returns: <Promise\<[[event](#event-model)]>> Promise which resolves to an array of the calendar's events.

### data.getEventsByDate(options)

* `options` \<object> Parameters which might have the following properties:
  * `calendarId` \<string>
  * `principalId` \<string>
  * `start` \<string> ISO date string
  * `end` \<string> ISO date string
  * `fullData` \<object>
  * `user` \<object>
* returns: <Promise\<[[event](#event-model)]>> Promise which resolves to an array of the calendars' events between the given dates.

### data.getEvent(options)

* `options` \<object> Parameters which might have the following properties:
  * `eventId` \<string>
  * `calendarId` \<string>
  * `principalId` \<string>
  * `fullData` \<object>
  * `user` \<object>
* returns: <Promise\<[event](#event-model)>> Promise which resolves to an event.

### data.createEvent(options)

* `options` \<object> Parameters which might have the following properties:
  * `event` \<[event](#event-model)\>
  * `calendarId` \<string>
  * `principalId` \<string>
  * `user` \<object>
* returns: <Promise\<[event](#event-model)>> Promise which resolves to the created event.

### data.deleteEvent(options)

* `options` \<object> Parameters which might have the following properties:
  * `eventId` \<string>
  * `calendarId` \<string>
  * `principalId` \<string>
  * `user` \<object>
* returns: <Promise\<[event](#event-model)\>> Promise which resolves to the deleted event.

### data.updateEvent(options)

* `options` \<object> Parameters which might have the following properties:
  * `event` \<[event](#event-model)\>
  * `calendarId` \<string>
  * `principalId` \<string>
  * `user` \<object>
* returns: <Promise\<[event](#event-model)>> Promise which resolves to the updated event.

## Models

### calendar model

* `order`, `color` are unused for now

```json
{
  "calendarId": "exampleCal1",
  "ownerId": "user@ex.co",
  "calendarName": "Example Calendar 1",
  "timeZone": "America/New_York",
  "order": 1,
  "readOnly": true,
  "color": "#FD8208",
  "syncToken": "https://example.com/ns/sync-token/1",
  "createdOn": "20180802T152540Z"
}
```

### event model

* dates can be anything the `moment` constructor can handle (Date or moment objects, ISO string, etc.)
* `ical` field is only returned from the middleware, it's unused in responses
* `recurring` only supports the `freq`, `until`, and `exdate` fields
* `recurrences` is an optional array of recurrence exceptions

```json
{
      "eventId": "30946424-40f4-47e2-80b1-006fdebbeb25",
      "calendarId": "exampleCal2",
      "summary": "Testing Event 6",
      "location": "Location 6",
      "description": "Recurring event on Friday, 4-6pm",
      "startDate": "20190111T210000Z",
      "endDate": "20190111T230000Z",
      "timeZone": "America/New_York",
      "createdOn": "20190226T203808Z",
      "lastModifiedOn": "20190226T211704Z",
      "ical": "BEGIN:VCALENDAR...",
      "recurring": {
        "freq": "WEEKLY",
        "until": "20190211T170000Z",
        "exdate": [
          "20190301T210000Z",
          "20190315T200000Z",
          "20190308T210000Z"
        ],
        "recurrences": [
          {
            "recurrenceId": "20190322T200000Z",
            "summary": "Testing Event 6",
            "location": "Location 6",
            "description": "Recurring event on Friday, 4-6pm",
            "startDate": "20190322T140000Z",
            "endDate": "20190322T160000Z",
            "timeZone": "America/New_York",
            "createdOn": "20190226T203808Z",
            "lastModifiedOn": "20190226T202744Z"
          }
        ]
      }
    }
```

## Examples

Please see `exampe/server.js` for example middleware implementation, as well as `example/data.js` for `data.*` method examples.

## Tested Clients

* MacOS 10.14
  * Calendar.app
  * Mozilla Thunderbird
* iOS 12
  * Calendar.app
  * Google Calendar

## Next

* Android tests

## Future

* Adding tests (integration tests with a dummy CalDAV client)
* Add scheduling support (inbox/outbox calendars, defined in the [RFC here](https://tools.ietf.org/html/rfc6638)
* Add support for Express and other frameworks

## License

MIT
