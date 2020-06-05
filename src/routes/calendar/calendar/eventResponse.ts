import { response, status, missingPropstats } from '../../../common/xBuild';
import { posix as path } from 'path';
import _ from 'lodash';
import commonTags from '../../../common/tags';
import { CalDavOptionsModule, CalDavEvent, CalDavCalendar } from '../../..';
import { CalendarContext } from '../../../koa';

export default function(opts: CalDavOptionsModule) {
  const tags = commonTags(opts);

  return async function(ctx: CalendarContext, events: CalDavEvent[], calendar: CalDavCalendar, children: Element[]) {
    const eventActions = _.map(events, async (event) => {
      const misses = [];
      const propActions = _.map(children, async (child) => {
        return await tags.getResponse({
          resource: 'event',
          child,
          ctx,
          calendar,
          event
        });
      });
      const pRes = await Promise.all(propActions);
      const url = path.join(ctx.url, `${event.eventId}.ics`);
      const resp = response(url, status[200], _.compact(pRes));
      if (misses.length) {
        resp['D:propstat'].push(missingPropstats(misses));
      }
      return resp;
    });
    const responses = await Promise.all(eventActions);
    return { responses };
  };
}
