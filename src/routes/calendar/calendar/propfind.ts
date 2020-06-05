import * as xml from '../../../common/xml';
import { build, multistatus, response, status } from '../../../common/xBuild';
import _ from 'lodash';
import { posix as path } from 'path';
import commonTags from '../../../common/tags';
import calEventResponse from './eventResponse';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { CalendarContext } from '../../../koa';

export default function(opts: CalDavOptionsModule) {
  const tags = commonTags(opts);
  const eventResponse = calEventResponse(opts);

  const calendarResponse = async function(ctx: CalendarContext, calendar: CalDavCalendar) {
    const { children } = xml.getWithChildren('/D:propfind/D:prop', ctx.request.xml);
    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
        resource: 'calendar',
        child,
        ctx,
        calendar
      });
    });
    const res = await Promise.all(actions);
    
    const calendarUrl = path.join(ctx.state.calendarHomeUrl, calendar.calendarId, '/');
    const props = _.compact(res);
    return response(calendarUrl, props.length ? status[200] : status[404], props);
  };

  const exec = async function(ctx: CalendarContext, calendar: CalDavCalendar) {
    const resp = await calendarResponse(ctx, calendar);
    const resps = [resp];
    
    const { children } = xml.getWithChildren('/D:propfind/D:prop', ctx.request.xml);
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
    resps.push(...responses);

    const ms = multistatus(resps);
    return build(ms);
  };

  return {
    exec,
    calendarResponse
  };
}
