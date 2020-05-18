import _ from 'lodash';
import { notFound, preconditionFail } from '../../../common/xBuild';
import { setEventPutResponse, setMissingMethod } from '../../../common/response';
import winston from '../../../common/winston';
import eventBuild from '../../../common/eventBuild';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { CalendarContext } from '../../../koa';

/* https://tools.ietf.org/html/rfc4791#section-5.3.2 */
export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar/put' });
  const { buildObj } = eventBuild(opts);

  const exec = async function(ctx: CalendarContext, calendar: CalDavCalendar) {
    if (calendar.readOnly) {
      return setMissingMethod(ctx);
    }
    if (!ctx.state.params.eventId) {
      log.warn('eventId param not present');
      return ctx.body = notFound(ctx.url); // make more meaningful
    }

    const incoming = _.find(ctx.request.ical, { type: 'VEVENT' });
    if (!incoming) {
      log.warn('incoming VEVENT not present');
      ctx.body = notFound(ctx.url); // make more meaningful
      return;
    }
    const incomingObj = buildObj(ctx.request.body, incoming, calendar);

    const existing = await opts.data.getEvent({
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      eventId: ctx.state.params.eventId,
      user: ctx.state.user,
      fullData: false
    });
    log.debug(`existing event${existing ? '' : ' not'} found`);

    if (!existing) {
      const newObj = await opts.data.createEvent({
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        event: incomingObj,
        user: ctx.state.user
      });
      log.debug('new event created');
      setEventPutResponse(ctx, newObj);
    } else {
      if (ctx.get('if-none-match') === '*') {
        log.warn('if-none-match: * header present, precondition failed');
        ctx.status = 412;
        return ctx.body = preconditionFail(ctx.url, 'no-uid-conflict');
      }
      const updateObj = await opts.data.updateEvent({
        principalId: ctx.state.params.principalId,
        calendarId: ctx.state.params.calendarId,
        event: incomingObj,
        user: ctx.state.user
      });
      log.debug('event updated');
      setEventPutResponse(ctx, updateObj);
    }
  };

  return {
    exec
  };
}
