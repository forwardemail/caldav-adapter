const { notFound } = require('../../../common/xBuild');

/* https://tools.ietf.org/html/rfc2518#section-8.6 */
module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/delete' });
  const exec = async function(ctx/*, calendar*/) {
    if (!ctx.state.params.eventId) {
      log.warn('eventId param not present');
      return ctx.body = notFound(ctx.url); // make more meaningful
    }
    const existing = await opts.getEvent(ctx.state.params.userId, ctx.state.params.eventId);
    log.debug(`existing event${existing ? '' : ' not'} found`);

    await opts.deleteEvent(ctx.state.params.userId, ctx.state.params.eventId);
  };

  return {
    exec
  };
};
