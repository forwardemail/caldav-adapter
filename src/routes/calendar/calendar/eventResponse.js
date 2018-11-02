const { response, status, missingPropstats } = require('../../../common/xBuild');
const path = require('path');
const _ = require('lodash');

module.exports = function(opts) {
  const tags = require('../../../common/tags')(opts);

  return async function(ctx, events, calendar, children) {
    const eventActions = _.map(events, async (event) => {
      const misses = [];
      const propActions = _.map(children, async (child) => {
        return await tags.getResponse({
          resource: 'event',
          child,
          ctx,
          calendar,
          event
        });
      });
      const pRes = await Promise.all(propActions);
      const url = path.join(ctx.url, `${event.eventId}.ics`);
      const resp = response(url, status[200], _.compact(pRes));
      if (misses.length) {
        resp['D:propstat'].push(missingPropstats(misses));
      }
      return resp;
    });
    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
