const path = require('node:path');
const _ = require('lodash');
const {
  response,
  status,
  missingPropstats
} = require('../../../common/x-build');
const commonTags = require('../../../common/tags');

module.exports = function (options) {
  const tags = commonTags(options);

  return async function (ctx, events, calendar, children) {
    const eventActions = _.map(events, async (event) => {
      const misses = [];
      const propActions = _.map(children, async (child) => {
        return tags.getResponse({
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
      if (misses.length > 0) {
        resp['D:propstat'].push(missingPropstats(misses));
      }

      return resp;
    });
    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
