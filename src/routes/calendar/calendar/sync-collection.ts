import * as xml from '../../../common/xml';
import _ from 'lodash';
import calEventResponse from './eventResponse';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { CalendarContext } from '../../../koa';

export default function(opts: CalDavOptionsModule) {
  // const log = winston({ ...opts, label: 'calendar/report/sync-collection' });
  const eventResponse = calEventResponse(opts);
  const tagActions = {
    'sync-token': async (ctx: CalendarContext, calendar: CalDavCalendar) => { return { 'D:sync-token': calendar.syncToken }; },
  };

  return async function(ctx: CalendarContext, calendar: CalDavCalendar) {
    const { children } = xml.getWithChildren('/D:sync-collection/D:prop', ctx.request.xml);
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });
    const events = await opts.data.getEventsForCalendar({
      principalId: ctx.state.params.principalId,
      calendarId: calendar.calendarId,
      user: ctx.state.user,
      fullData: fullData
    });
    const { responses } = await eventResponse(ctx, events, calendar, children);

    const token = await tagActions['sync-token'](ctx, calendar);
    return {
      responses,
      other: token
    };
  };
}
