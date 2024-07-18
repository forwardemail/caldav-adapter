const { setMissingMethod } = require('../../../common/response');
const winston = require('../../../common/winston');
const { response, status } = require('../../../common/x-build');

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

      if (ctx.accepts('xml')) {
        const ics = await options.data.buildICS(ctx, events, calendar);
        return response(ctx.url, status[200], [
          {
            'D:getetag': options.data.getETag(ctx, calendar)
          },
          {
            'CAL:calendar-data': ics
          }
        ]);
      }

      return options.data.buildICS(ctx, events, calendar);
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

    if (ctx.accepts('xml')) {
      const ics = await options.data.buildICS(ctx, event, calendar);
      return response(ctx.url, status[200], [
        {
          // TODO: should E-Tag here be of calendar or event?
          // 'D:getetag': options.data.getETag(ctx, calendar)
          'D:getetag': options.data.getETag(ctx, calendar)
        },
        {
          'CAL:calendar-data': ics
        }
      ]);
    }

    return options.data.buildICS(ctx, event, calendar);
  };

  return {
    exec
  };
};
