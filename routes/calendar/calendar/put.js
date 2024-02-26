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

    if (
      ctx.request.type !== 'text/calendar' ||
      typeof ctx.request.body !== 'string'
    ) {
      log.warn('incoming VEVENT not present');
      ctx.body = notFound(ctx.url); // Make more meaningful
      return;
    }

    const existing = await options.data.getEvent(ctx, {
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

      const updateObject = await options.data.updateEvent(ctx, {
        eventId: ctx.state.params.eventId,
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        user: ctx.state.user
      });
      log.debug('event updated');

      /* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
      ctx.status = 201;
      ctx.set('ETag', options.data.getETag(ctx, updateObject));
    } else {
      const newObject = await options.data.createEvent(ctx, {
        eventId: ctx.state.params.eventId,
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        user: ctx.state.user
      });
      log.debug('new event created');
      /* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
      ctx.status = 201;
      ctx.set('ETag', options.data.getETag(ctx, newObject));
    }
  };

  return {
    exec
  };
};
