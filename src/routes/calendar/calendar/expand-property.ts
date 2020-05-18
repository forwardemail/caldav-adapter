import { response, status } from '../../../common/xBuild';
import winston from '../../../common/winston';
import { CalDavOptionsModule } from '../../..';
import { CalendarContext } from '../../../koa';

export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar/report/expand-property' });
  return async function(ctx: CalendarContext/*, calendar*/) {
    log.debug('returning blank 200 response');
    return { responses: [response(ctx.url, status[200])] };
  };
}
