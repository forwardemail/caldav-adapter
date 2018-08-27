const xml = require('../../../lib/xml');
const { response, status } = require('../../../lib/xBuild');
const _ = require('lodash');

module.exports = function(opts) {
  const log = require('../../../lib/winston')({ ...opts, label: 'calendar/report/calendar-multiget' });
  const { buildICS } = require('../../../lib/eventBuild')(opts);

  return async function(ctx, calendar) {
    const hrefs = xml.get('/CAL:calendar-multiget/D:href', ctx.request.xml);
    const eventActions = _.map(hrefs, async (node) => {
      const href = node.textContent;
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
        'D:getetag': event.lastUpdatedOn
      }, {
        'CAL:calendar-data': ics
      }]);
    });
    
    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
