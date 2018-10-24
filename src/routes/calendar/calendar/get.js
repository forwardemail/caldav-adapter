const { setMissingMethod } = require('../../../common/response');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/get' });
  const { buildICS } = require('../../../common/eventBuild')(opts);
  
  const exec = async function(ctx, calendar) {
    const event = await opts.getEvent(ctx.state.params.principalId, ctx.state.params.eventId);
    if (!event) {
      log.debug(`event ${ctx.state.params.eventId} not found`);
      return setMissingMethod(ctx);
    }
    return buildICS(event, calendar);
  };
  
  return {
    exec
  };
};
