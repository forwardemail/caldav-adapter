const _ = require('lodash');
const { notFound, preconditionFail } = require('../../../common/xBuild');
const { setEventPutResponse, setMissingMethod } = require('../../../common/response');

/* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/put' });
  const { buildObj } = require('../../../common/eventBuild')(opts);

  const exec = async function(ctx, calendar) {
    if (calendar.readOnly) {
      return setMissingMethod(ctx);
    }
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

    const existing = await opts.data.getEvent(ctx.state.params.principalId, ctx.state.params.eventId);
    log.debug(`existing event${existing ? '' : ' not'} found`);

    if (!existing) {
      const newObj = await opts.data.createEvent(ctx.state.params.principalId, incomingObj);
      log.debug('new event created');
      setEventPutResponse(ctx, newObj);
    } else {
      if (ctx.get('if-none-match') === '*') {
        log.warn('if-none-match: * header present, precondition failed');
        ctx.status = 412;
        return ctx.body = preconditionFail(ctx.url, 'no-uid-conflict');
      }
      const updateObj = await opts.data.updateEvent(ctx.state.params.principalId, incomingObj);
      log.debug('event updated');
      setEventPutResponse(ctx, updateObj);
    }
  };

  return {
    exec
  };
};
