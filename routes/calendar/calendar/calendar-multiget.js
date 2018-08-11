const log = require('../../../lib/winston')('calendar/report/calendar-multiget');

const { response, status } = require('../../../lib/xBuild');
const _ = require('lodash');

module.exports = function(opts) {
  const { buildICS } = require('../../../lib/eventBuild')(opts);

  return async function(ctx, reqXml, calendar) {
    const hrefs = _.get(reqXml, 'B:calendar-multiget.A:href');
    const eventActions = _.map(hrefs, async (node) => {
      const href = node._;
      if (!href) {
        return response(href, status[404]);
      }
      const hrefParts = href.split('/');
      const eventId = hrefParts[hrefParts.length - 1].slice(0, -4);
      const event = await opts.getEvent(ctx.state.params.userId, eventId);
      log.debug(`event ${event ? 'found' : 'missing'}: ${eventId}`);
      if (!event) {
        return response(href, status[404]);
      }
      const ics = buildICS(event, calendar);
      return response(href, status[200], [{
        'D:getetag': event.createdOn
      }, {
        'CAL:calendar-data': ics
      }]);
    });
    
    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
