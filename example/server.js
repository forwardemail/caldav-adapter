const config = require('./config');
const Koa = require('koa');
const app = new Koa();

const morgan = require('koa-morgan');
const winston = require('../lib/winston')('server');
app.use(morgan('tiny', { stream: winston.stream }));

const adapter = require('../index');
const data = require('./data');
app.use(adapter({
  authRealm: config.authRealm,
  caldavRoot: 'caldav',
  domain: 'testServer',
  proId: { company: 'TestCompany', product: 'Calendar', language: 'EN' },
  authMethod: async (user, pass) => {
    winston.debug(`user: ${user}, pass: ${pass}`);
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

app.listen(config.port, () => winston.debug('Server started'));
