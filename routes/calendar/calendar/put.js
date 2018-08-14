const _ = require('lodash');
const { notFound, preconditionFail } = require('../../../lib/xBuild');
const { setEventPutResponse } = require('../../../lib/response');

/* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
module.exports = function(opts) {
  const log = require('../../../lib/winston')({ ...opts, label: 'calendar/put' });
  const { buildObj } = require('../../../lib/eventBuild')(opts);

  const exec = async function(ctx, calendar) {
    if (!ctx.state.params.eventId) {
      log.warn('eventId param not present');
      return ctx.body = notFound(ctx.url); // make more meaningful
    }

    const incoming = _.find(ctx.request.ical, { type: 'VEVENT' });
    if (!incoming) {
      log.warn('incoming VEVENT not present');
      return ctx.body = notFound(ctx.url); // make more meaningful
    }
    const incomingObj = buildObj(ctx.request.body, incoming, calendar);

    const existing = await opts.getEvent(ctx.state.params.userId, ctx.state.params.eventId);
    log.debug(`existing event${existing ? '' : ' not'} found`);

    if (!existing) {
      const newObj = await opts.createEvent(ctx.state.params.userId, incomingObj);
      log.debug('new event created');
      setEventPutResponse(ctx, newObj);
    } else {
      if (ctx.get('if-none-match') === '*') {
        log.warn('if-none-match: * header present, precondition failed');
        ctx.status = 412;
        return ctx.body = preconditionFail(ctx.url, 'no-uid-conflict');
      }
      const updateObj = await opts.updateEvent(ctx.state.params.userId, incomingObj);
      log.debug('event updated');
      setEventPutResponse(ctx, updateObj);
    }
  };

  return {
    exec
  };
};
