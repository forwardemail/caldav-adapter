// const log = require('../../../lib/winston')('calendar/report/sync-collection');

const _ = require('lodash');

module.exports = function(opts) {
  const eventResponse = require('./eventResponse')(opts);
  const tagActions = {
    'sync-token': async (ctx, calendar) => { return { 'D:sync-token': calendar.syncToken }; },
  };

  return async function(ctx, calendar) {
    const propTags = _.get(ctx.request.xml, 'A:sync-collection.A:prop[0]');
    const events = await opts.getEventsForCalendar(ctx.state.params.userId, calendar.calendarId);
    const { responses } = await eventResponse(ctx, events, propTags);

    const token = await tagActions['sync-token'](ctx, calendar);
    return {
      responses,
      other: token
    };
  };
};
