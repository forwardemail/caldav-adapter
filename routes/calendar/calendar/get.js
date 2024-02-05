const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/get' });

  const exec = async function (ctx, calendar) {
    const event = await options.data.getEvent({
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

    return options.data.buildICS(event, calendar);
  };

  return {
    exec
  };
};
