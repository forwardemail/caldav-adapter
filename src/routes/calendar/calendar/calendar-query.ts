import * as xml from '../../../common/xml';
import { formatted } from '../../../common/date';
import _ from 'lodash';
import calEventResponse from './eventResponse';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { CalendarContext } from '../../../koa';

export default function(opts: CalDavOptionsModule) {
  // const log = require('../../../common/winston')({ ...opts, label: 'calendar/report/calendar-query' });
  const eventResponse = calEventResponse(opts);
  return async function(ctx: CalendarContext, calendar: CalDavCalendar) {
    /* https://tools.ietf.org/html/rfc4791#section-9.9 */
    const filters = xml.get<Element>('/CAL:calendar-query/CAL:filter/CAL:comp-filter[@name=\'VCALENDAR\']/CAL:comp-filter[@name=\'VEVENT\']/CAL:time-range', ctx.request.xml);
    if (!filters || !filters[0]) { return { responses: [] }; }
    const filter = filters[0];
    const startAttr = _.find(filter.attributes, { localName: 'start' });
    const start = startAttr ? formatted(startAttr.nodeValue) : null;
    const endAttr = _.find(filter.attributes, { localName: 'end' });
    const end = endAttr ? formatted(endAttr.nodeValue) : null;

    const { children } = xml.getWithChildren('/CAL:calendar-query/D:prop', ctx.request.xml);
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });
    const events = await opts.data.getEventsByDate({
      principalId: ctx.state.params.principalId,
      calendarId: calendar.calendarId,
      start: start,
      end: end,
      user: ctx.state.user,
      fullData: fullData
    });
    return await eventResponse(ctx, events, calendar, children);
  };
}
