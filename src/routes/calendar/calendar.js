const { notFound } = require('../../common/xBuild');
const { setMultistatusResponse } = require('../../common/response');

module.exports = function(opts) {
  const log = require('../../common/winston')({ ...opts, label: 'calendar' });
  const userMethods = {
    propfind: require('./user/propfind')(opts),
    proppatch: require('./user/proppatch')(opts)
  };
  const calMethods = {
    propfind: require('./calendar/propfind')(opts),
    report: require('./calendar/report')(opts),
    proppatch: require('./calendar/proppatch')(opts),
    put: require('./calendar/put')(opts),
    delete: require('./calendar/delete')(opts)
  };

  return async function(ctx) {
    const method = ctx.method.toLowerCase();
    const calendarId = ctx.state.params.calendarId;
    setMultistatusResponse(ctx);
    
    if (!calendarId) {
      if (!userMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        return ctx.body = notFound(ctx.url);
      }
      ctx.body = await userMethods[method].exec(ctx);
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
      ctx.body = await calMethods[method].exec(ctx, calendar);
    }
  };
};
