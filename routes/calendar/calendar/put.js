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

    // TODO: support XML update (?)
    // const { children } = xml.getWithChildren(
    //   '/D:propertyupdate/D:set/D:prop',
    //   ctx.request.xml
    // );

    if (
      ctx.request.type !== 'text/calendar' ||
      typeof ctx.request.body !== 'string'
    ) {
      log.warn('incoming ICS file not present in body');
      // TODO: we may want to rewrite all this
      // so that set `setMultistatusResponse` for example only where appropriate
      // (otherwise it's going to have DAV and XML headers when it doesn't need to)
      setMissingMethod(ctx);
      ctx.body = notFound(ctx.url); // Make more meaningful
      return;
    }

    //
    // NOTE: if there is no `eventId` then it is updating the entire VCALENDAR
    //
    if (!ctx.state.params.eventId) {
      const updatedCalendar = await options.data.updateCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        user: ctx.state.user
      });
      /* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
      ctx.status = 201;
      ctx.set('ETag', options.data.getETag(ctx, updatedCalendar));
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
      //
      // RFC 7232 Section 3.2: If-None-Match
      // When a client sends "If-None-Match: *", the server MUST NOT perform
      // the requested method if the target resource exists.
      // This is used by clients to prevent overwriting existing resources.
      //
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
