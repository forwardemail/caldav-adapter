import { setMissingMethod } from '../../../common/response';
import winston from '../../../common/winston';
import eventBuild from '../../../common/eventBuild';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { Context } from 'koa';

export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar/get' });
  const { buildICS } = eventBuild(opts);
  
  const exec = async function(ctx:Context, calendar: CalDavCalendar) {
    const event = await opts.data.getEvent({
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      eventId: ctx.state.params.eventId,
      user: ctx.state.user,
      fullData: true
    });
    if (!event) {
      log.debug(`event ${ctx.state.params.eventId} not found`);
      return setMissingMethod(ctx);
    }
    return buildICS(event, calendar);
  };
  
  return {
    exec
  };
}
