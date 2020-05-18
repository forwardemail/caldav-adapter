import { notFound } from '../../../common/xBuild';
import { setMissingMethod } from '../../../common/response';
import winston from '../../../common/winston';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { Context } from 'koa';

/* https://tools.ietf.org/html/rfc2518#section-8.6 */
export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar/delete' });
  const exec = async function(ctx: Context, calendar: CalDavCalendar) {
    if (calendar.readOnly) {
      return setMissingMethod(ctx);
    }

    if (!ctx.state.params.eventId) {
      log.warn('eventId param not present');
      ctx.body = notFound(ctx.url); // make more meaningful
      return;
    }
    const existing = await opts.data.getEvent({
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      eventId: ctx.state.params.eventId,
      user: ctx.state.user,
      fullData: false
    });
    log.debug(`existing event${existing ? '' : ' not'} found`);

    await opts.data.deleteEvent({
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      eventId: ctx.state.params.eventId,
      user: ctx.state.user
    });
  };

  return {
    exec
  };
};
