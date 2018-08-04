const config = require('./test.config');
const Koa = require('koa');
const app = new Koa();

const morgan = require('koa-morgan');
const winston = require('./lib/winston')('server');
app.use(morgan('tiny', { stream: winston.stream }));

const adapter = require('./index');
app.use(adapter({
  caldavRoot: 'caldav'
}));

app.use((ctx) => {
  ctx.body = 'outside caldav server';
});

app.listen(config.port, () => winston.debug('Server started'));
