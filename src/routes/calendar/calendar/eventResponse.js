const xml = require('../../../common/xml');
const { response, status, missingPropstats } = require('../../../common/xBuild');
const path = require('path');
const _ = require('lodash');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/event-response' });
  const { buildICS } = require('../../../common/eventBuild')(opts);

  const tagActions = {
    /* https://tools.ietf.org/html/rfc4791#section-5.3.4 */
    'getetag': async (event) => {
      return { 'D:getetag': event.lastUpdatedOn };
    },
    'getcontenttype': async () => {
      return { 'D:getcontenttype': 'text/calendar; charset=utf-8; component=VEVENT' };
    },
    /* https://tools.ietf.org/html/rfc4791#section-9.6 */
    'calendar-data': async (event, calendar) => {
      return {
        'CAL:calendar-data': buildICS(event, calendar)
      };
    }
  };

  return async function(ctx, events, calendar, children) {
    const eventActions = _.map(events, async (event) => {
      const misses = [];
      const propActions = _.map(children, async (child) => {
        const tag = child.localName;
        const tagAction = tagActions[tag];
        log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
        if (!tagAction) {
          if (tag) {
            const missing = `${xml.nsLookup[child.namespaceURI]}:${child.localName}`;
            misses.push(missing);
          }
          return null;
        }
        return await tagAction(event, calendar);
      });
      const pRes = await Promise.all(propActions);
      const url = path.join(ctx.url, `${event.eventId}.ics`);
      const resp = response(url, status[200], _.compact(pRes));
      resp['D:propstat'].push(missingPropstats(misses));
      return resp;
    });
    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
