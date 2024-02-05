const { notFound } = require('../../../common/x-build');
const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');

/* https://tools.ietf.org/html/rfc2518#section-8.6 */
module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/delete' });
  const exec = async function (ctx, calendar) {
    if (calendar.readonly) {
      setMissingMethod(ctx);
      return;
    }

    if (!ctx.state.params.eventId) {
      log.warn('eventId param not present');
      ctx.body = notFound(ctx.url); // Make more meaningful
      return;
    }

    const existing = await options.data.getEvent({
      eventId: ctx.state.params.eventId,
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      user: ctx.state.user,
      fullData: false
    });
    log.debug(`existing event${existing ? '' : ' not'} found`);

    await options.data.deleteEvent({
      eventId: ctx.state.params.eventId,
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      user: ctx.state.user
    });
  };

  return {
    exec
  };
};
