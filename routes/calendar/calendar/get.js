const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/get' });

  const exec = async function (ctx, calendar) {
    if (!ctx.state.params.eventId) {
      const events = await options.data.getEventsForCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId: options.data.getCalendarId(ctx, calendar),
        user: ctx.state.user,
        fullData: true
      });

      return options.data.buildICS(ctx, events, calendar);
    }

    const event = await options.data.getEvent(ctx, {
      eventId: ctx.state.params.eventId,
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      user: ctx.state.user,
      fullData: true
    });
    if (!event) {
      log.debug(`event ${ctx.state.params.eventId} not found`);
      setMissingMethod(ctx);
      return;
    }

    return options.data.buildICS(ctx, event, calendar);
  };

  return {
    exec
  };
};
