const log = require('../../lib/winston')('calendar');

const { parse } = require('../../lib/xParse');
const { notFound } = require('../../lib/xBuild');

module.exports = function(opts) {
  const userMethods = {
    propfind: require('./user/propfind/propfind')(opts),
  };
  const calMethods = {
    propfind: require('./calendar/propfind/propfind')(opts),
    report: require('./calendar/report/report')(opts)
  };

  return async function(ctx) {
    const reqXml = await parse(ctx.request.body);
    const method = ctx.method.toLowerCase();
    const calendarId = ctx.state.params.calendarId;

    
    if (!calendarId) {
      if (!userMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        return ctx.body = notFound(ctx.url);
      }
      ctx.body = await userMethods[method].exec(ctx, reqXml);
    } else {
      // check calendar exists & user has access
      const calendar = await opts.getCalendar(ctx.state.params.userId, calendarId);
      if (!calendar) {
        log.warn(`calendar not found: ${calendarId}`);
        return ctx.body = notFound(ctx.url);
      }
      if (!calMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        return ctx.body = notFound(ctx.url);
      }
      ctx.body = await calMethods[method].exec(ctx, reqXml, calendar);
    }
  };
};
