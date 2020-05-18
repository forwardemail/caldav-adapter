import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import * as xml from '../../../common/xml';
import { response, status } from '../../../common/xBuild';
import _ from 'lodash';
import winston from '../../../common/winston';
import eventBuild from '../../../common/eventBuild';
import { Context } from 'koa';

export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar/report/calendar-multiget' });
  const { buildICS } = eventBuild(opts);

  return async function(ctx: Context, calendar: CalDavCalendar) {
    const hrefs = xml.get<Node>('/CAL:calendar-multiget/D:href', ctx.request.xml);
    const eventActions = _.map(hrefs, async (node) => {
      const href = node.textContent;
      if (!href) {
        return response(href, status[404]);
      }
      const hrefParts = href.split('/');
      const eventId = hrefParts[hrefParts.length - 1].slice(0, -4);
      const event = await opts.data.getEvent({
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        eventId: eventId,
        user: ctx.state.user,
        fullData: true
      });
      log.debug(`event ${event ? 'found' : 'missing'}: ${eventId}`);
      if (!event) {
        return response(href, status[404]);
      }
      const ics = buildICS(event, calendar);
      return response(href, status[200], [{
        'D:getetag': event.lastModifiedOn
      }, {
        'CAL:calendar-data': ics
      }]);
    });
    
    const responses = await Promise.all(eventActions);
    return { responses };
  };
}
