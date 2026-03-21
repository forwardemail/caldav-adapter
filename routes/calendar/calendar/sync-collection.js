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
    // RFC 6578 Section 3.2 - parse the client's sync-token
    // to enable incremental sync instead of always returning all events
    const syncTokenNodes = xml.get(
      '/D:sync-collection/D:sync-token',
      ctx.request.xml
    );
    let clientSyncToken = null;
    if (syncTokenNodes && syncTokenNodes.length > 0) {
      const tokenText = syncTokenNodes[0].textContent;
      if (tokenText && tokenText.trim() !== '') {
        clientSyncToken = tokenText.trim();
      }
    }

    const { children } = xml.getWithChildren(
      '/D:sync-collection/D:prop',
      ctx.request.xml
    );
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });

    // Pass the client's sync-token to the data layer so it can
    // return only events changed since that token
    const events = await options.data.getEventsForCalendar(ctx, {
      principalId: ctx.state.params.principalId,
      calendarId: options.data.getCalendarId(ctx, calendar),
      user: ctx.state.user,
      fullData,
      showDeleted: true,
      syncToken: clientSyncToken
    });
    const { responses } = await eventResponse(ctx, events, calendar, children);

    const token = await tagActions['sync-token'](ctx, calendar);
    return {
      responses,
      other: token
    };
  };
};
