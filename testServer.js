const Koa = require('koa');
const app = new Koa();

const adapter = require('./index');

// response
app.use(adapter());

app.use((ctx) => {
  ctx.body = 'outside caldav server';
});

app.listen(3001);
