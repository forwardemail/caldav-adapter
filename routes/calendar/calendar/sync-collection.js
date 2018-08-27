const xml = require('../../../lib/xml');

module.exports = function(opts) {
  // const log = require('../../../lib/winston')({ ...opts, label: 'calendar/report/sync-collection' });
  const eventResponse = require('./eventResponse')(opts);
  const tagActions = {
    'sync-token': async (ctx, calendar) => { return { 'D:sync-token': calendar.syncToken }; },
  };

  return async function(ctx, calendar) {
    const propNode = xml.get('/D:sync-collection/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const events = await opts.getEventsForCalendar(ctx.state.params.userId, calendar.calendarId);
    const { responses } = await eventResponse(ctx, events, children);

    const token = await tagActions['sync-token'](ctx, calendar);
    return {
      responses,
      other: token
    };
  };
};
