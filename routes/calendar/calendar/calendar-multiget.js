const _ = require('lodash');
const xml = require('../../../common/xml');
const { response, status } = require('../../../common/x-build');
const winston = require('../../../common/winston');

module.exports = function (options) {
  const log = winston({
    ...options,
    label: 'calendar/report/calendar-multiget'
  });

  return async function (ctx, calendar) {
    const hrefs = xml.get('/CAL:calendar-multiget/D:href', ctx.request.xml);
    const eventActions = _.map(hrefs, async (node) => {
      const href = node.textContent;
      if (!href) {
        return response(href, status[404]);
      }

      const hrefParts = href.split('/');
      const eventId = hrefParts.at(-1).slice(0, -4);
      const event = await options.data.getEvent(ctx, {
        eventId,
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        user: ctx.state.user,
        fullData: true
      });
      log.debug(`event ${event ? 'found' : 'missing'}: ${eventId}`);
      if (!event) {
        return response(href, status[404]);
      }

      const ics = await options.data.buildICS(ctx, event, calendar);
      return response(href, status[200], [
        {
          'D:getetag': options.data.getETag(ctx, event)
        },
        {
          'CAL:calendar-data': { '$cdata': ics }
        }
      ]);
    });

    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
