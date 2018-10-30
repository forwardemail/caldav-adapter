const { notFound } = require('../../../common/xBuild');
const { setMissingMethod } = require('../../../common/response');

/* https://tools.ietf.org/html/rfc2518#section-8.6 */
module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/delete' });
  const exec = async function(ctx, calendar) {
    if (calendar.readOnly) {
      return setMissingMethod(ctx);
    }

    if (!ctx.state.params.eventId) {
      log.warn('eventId param not present');
      return ctx.body = notFound(ctx.url); // make more meaningful
    }
    const existing = await opts.data.getEvent({
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      eventId: ctx.state.params.eventId,
      user: ctx.state.user
    });
    log.debug(`existing event${existing ? '' : ' not'} found`);

    await opts.data.deleteEvent({
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      eventId: ctx.state.params.eventId,
      user: ctx.state.user
    });
  };

  return {
    exec
  };
};
