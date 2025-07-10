const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');

module.exports = function (options) {
  const log = winston({ ...options, label: 'calendar/get' });

  const exec = async function (ctx, calendar) {
    if (!ctx.state.params.eventId) {
      const events = await options.data.getEventsForCalendar(ctx, {
        principalId: ctx.state.params.principalId,
        calendarId: options.data.getCalendarId(ctx, calendar),
        user: ctx.state.user,
        fullData: true
      });

      const ics = await options.data.buildICS(ctx, events, calendar);

      ctx.status = 200;
      ctx.remove('DAV');
      ctx.set('Content-Type', 'text/calendar; charset=utf-8');
      ctx.set('ETag', options.data.getETag(ctx, calendar));
      return ics;
    }

    const event = await options.data.getEvent(ctx, {
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

    const ics = await options.data.buildICS(ctx, event, calendar);

    ctx.status = 200;
    ctx.remove('DAV');
    ctx.set('Content-Type', 'text/calendar; charset=utf-8');
    ctx.set('ETag', options.data.getETag(ctx, calendar));
    return ics;
  };

  return {
    exec
  };
};
