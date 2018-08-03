const Koa = require('koa');
const app = new Koa();

const morgan = require('koa-morgan');
const winston = require('./lib/winston')('server');

app.use(morgan('tiny', { stream: winston.stream }));

const adapter = require('./index');

app.use(adapter({
  caldavRoot: '/'
}));

app.use((ctx) => {
  ctx.body = 'outside caldav server';
});

app.listen(3001, () => winston.debug('Server started'));
