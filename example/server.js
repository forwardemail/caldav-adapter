const config = require('./config');
const Koa = require('koa');
const compress = require('koa-compress');
const app = new Koa();

const morgan = require('koa-morgan');
const log = require('../src/common/winston')({ logEnabled: true, label: 'server' });
app.use(morgan('tiny', { stream: log.stream }));

const adapter = require('../index');
const data = require('./data');
app.use(compress());
app.use(adapter.koa({
  logEnabled: true,
  logLevel: 'verbose',
  // logLevel: 'debug',
  // caldavRoot: 'caldav',
  proId: { company: 'TestCompany', product: 'Calendar', language: 'EN' },
  authRealm: config.authRealm,
  authenticate: async ({ username, password }) => {
    log.verbose(`user: ${username}, pass: ${password}`);
    if (password === 'pass') {
      return {
        principalId: username,
        principalName: username.toUpperCase()
      };
    }
  },
  data: {
    getCalendar: data.getCalendar,
    getCalendarsForPrincipal: data.getCalendarsForPrincipal,
    updateCalendar: data.updateCalendar,
    getEventsForCalendar: data.getEventsForCalendar,
    getEventsByDate: data.getEventsByDate,
    getEvent: data.getEvent,
    createEvent: data.createEvent,
    // updateEvent: data.updateEvent,
    deleteEvent: data.deleteEvent
  }
}));

app.use((ctx) => {
  ctx.body = 'outside caldav server';
});

app.listen(config.port, () => log.info(`Server started on ${config.port}`));
