const _ = require('lodash');
const xml = require('../../../common/xml');
const calEventResponse = require('./event-response');

module.exports = function (options) {
  // const log = winston({ ...opts, label: 'calendar/report/sync-collection' });
  const eventResponse = calEventResponse(options);
  const tagActions = {
    async 'sync-token'(ctx, calendar) {
      return { 'D:sync-token': calendar.synctoken };
    }
  };

  return async function (ctx, calendar) {
    const { children } = xml.getWithChildren(
      '/D:sync-collection/D:prop',
      ctx.request.xml
    );
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });
    const events = await options.data.getEventsForCalendar({
      principalId: ctx.state.params.principalId,
      calendarId: options.data.getCalendarId(calendar),
      user: ctx.state.user,
      fullData
    });
    const { responses } = await eventResponse(ctx, events, calendar, children);

    const token = await tagActions['sync-token'](ctx, calendar);
    return {
      responses,
      other: token
    };
  };
};
