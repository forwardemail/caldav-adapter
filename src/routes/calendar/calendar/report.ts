import { build, multistatus, notFound } from '../../../common/xBuild';
import winston from '../../../common/winston';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { CalendarContext } from '../../../koa';

import query from './calendar-query';
import multiget from './calendar-multiget';
import expand from './expand-property';
import sync from './sync-collection';

export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar/report' });
  const rootActions = {
    /* https://tools.ietf.org/html/rfc4791#section-7.8 */
    'calendar-query': query(opts),
    /* https://tools.ietf.org/html/rfc4791#section-7.9 */
    'calendar-multiget': multiget(opts),
    /* https://tools.ietf.org/html/rfc3253#section-3.8 */
    'expand-property': expand(opts),
    /* https://tools.ietf.org/html/rfc6578#section-3.2 */
    'sync-collection': sync(opts)
  };
  const exec = async function(ctx: CalendarContext, calendar: CalDavCalendar) {
    const rootTag = ctx.request.xml.documentElement.localName;
    const rootAction = rootActions[rootTag];
    log.debug(`report ${rootAction ? 'hit' : 'miss'}: ${rootTag}`);
    if (!rootAction) {
      return notFound(ctx.url);
    }
    const { responses, other } = await rootAction(ctx, calendar);
    const ms = multistatus(responses, other);
    return build(ms);
  };
  
  return {
    exec
  };
}
