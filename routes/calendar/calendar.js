const log = require('../../lib/winston')('calendar');

const { parse } = require('../../lib/xParse');
const { notFound } = require('../../lib/xBuild');

module.exports = function(opts) {
  const methods = {
    propfind: require('./propfind/propfind')(opts),
    report: require('./report/report')(opts)
  };

  return async function(ctx) {
    const reqXml = await parse(ctx.request.body);
    const method = ctx.method.toLowerCase();

    // check calendar exists & user has access
    const calendar = await opts.getCalendar(ctx.state.params.userId, ctx.state.params.calendarId);
    if (!calendar) {
      log.warn(`calendar not found: ${ctx.state.params.calendarId}`);
      return notFound(ctx.url);
    }
    if (!methods[method]) {
      log.warn(`method handler not found: ${method}`);
      return notFound(ctx.url);
    }

    ctx.body = await methods[method](ctx, reqXml, calendar);
  };
};
