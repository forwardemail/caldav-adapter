const _ = require('lodash');
const { notFound, preconditionFail } = require('../../../common/x-build');
const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');

/* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/put' });

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

    const incoming = _.find(ctx.request.ical, { type: 'VEVENT' });
    if (!incoming) {
      log.warn('incoming VEVENT not present');
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

    if (existing) {
      if (ctx.get('if-none-match') === '*') {
        log.warn('if-none-match: * header present, precondition failed');
        ctx.status = 412;
        ctx.body = preconditionFail(ctx.url, 'no-uid-conflict');
        return;
      }

      const updateObject = await options.data.updateEvent({
        eventId: ctx.state.params.eventId,
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        event: incoming,
        user: ctx.state.user
      });
      log.debug('event updated');

      /* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
      ctx.status = 201;
      ctx.set('ETag', options.data.getETag(updateObject));
    } else {
      const newObject = await options.data.createEvent({
        eventId: ctx.state.params.eventId,
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        event: incoming,
        user: ctx.state.user
      });
      log.debug('new event created');
      /* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
      ctx.status = 201;
      ctx.set('ETag', options.data.getETag(newObject));
    }
  };

  return {
    exec
  };
};
