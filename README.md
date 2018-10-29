# node-caldav-adapter

Middleware to handle CalDAV requests to node web server. Works with

- Node v8 or higher
- Koa v2 or higher

This middleware will intercept any requests to the `caldavRoot` URL, authenticate using Basic Authentication, and exposes the following URLs and methods:

- Principal Methods: `OPTIONS`, `PROPFIND`
- Calendar Home Methods: `OPTIONS`, `PROPFIND`
- Calendar Methods: `OPTIONS`, `PROPFIND`, `REPORT`, `GET`, `PUT` & `DELETE` (if calendar is not read-only)

## Usage

```js
const Koa = require('koa');
const app = new Koa();

const caldav = require('caldav-adapter');
app.use(adapter.koa({
  authenticate: async ({ username, password }) => {
    if (password === 'pass') {
      return {
        user: username,
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

#### Options

| Name | Required | Default | Description |
| ---- | -------- | ------- | ----------- |
| authenticate | yes | - | Function returning user object if successful |
| authRealm | yes | - | Realm for Basic Authentication |
| caldavRoot | no | '/' | Root URL for CalDAV server |
| proId | yes | - | Product Identifier passed to [ical-generator](https://github.com/sebbo2002/ical-generator#prodidstringobject-prodid) |
| logEnabled | no | false | Enables stdout logging via Winston |
| logLevel | no | 'debug' | Log level used by Winston |
| data.getCalendar | yes | - | Function returning calendar object |
| data.getCalendarsForPrincipal | yes | - | Function returning all calendars for the current principal |
| data.getEventsForCalendar | yes | - | Function returning all events for the specified calendar |
| data.getEventsByDate | yes | - | Function returning all events for the specified calendar within dates |
| data.getEvent | yes | - | Function returning specified event |
| data.createEvent | yes | - | Function saving and returning saved event |
| data.updateEvent | yes | - | Function updating specified event |
| data.deleteEvent | yes | - | Function deleting specified event |

## Example

Please see `exampe/server.js` for example middleware implementation, as well as `example/data.js/` for `data.*` function signatures.

## License

MIT
