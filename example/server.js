const config = require('./config');
const Koa = require('koa');
const compress = require('koa-compress');
const app = new Koa();

const morgan = require('koa-morgan');
const log = require('../lib/winston')({ logEnabled: true, label: 'server' });
app.use(morgan('tiny', { stream: log.stream }));

const adapter = require('../index');
const data = require('./data');
app.use(compress());
app.use(adapter({
  logEnabled: true,
  logLevel: 'verbose',
  authRealm: config.authRealm,
  // caldavRoot: 'caldav',
  domain: 'testServer',
  proId: { company: 'TestCompany', product: 'Calendar', language: 'EN' },
  authMethod: async (user, pass) => {
    log.verbose(`user: ${user}, pass: ${pass}`);
    if (pass === 'pass') {
      return {
        user: user
      };
    }
  },
  getCalendar: data.getCalendar,
  getCalendarsForUser: data.getCalendarsForUser,
  updateCalendar: data.updateCalendar,
  getEventsForCalendar: data.getEventsForCalendar,
  getEventsByDate: data.getEventsByDate,
  getEvent: data.getEvent,
  createEvent: data.createEvent,
  updateEvent: data.updateEvent,
  deleteEvent: data.deleteEvent
}));

app.use((ctx) => {
  ctx.body = 'outside caldav server';
});

app.listen(config.port, () => log.info(`Server started on ${config.port}`));
