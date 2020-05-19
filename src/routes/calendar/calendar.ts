import { notFound } from '../../common/xBuild';
import { setMultistatusResponse, setOptions } from '../../common/response';
import winston from '../../common/winston';
import { CalDavOptionsModule } from '../..';
import { CalendarContext } from '../../koa';

import routerUserPropfind from './user/propfind';
// import routerUserProppatch from './user/proppatch';
import routerCalPropfind from './calendar/propfind';
import routerCalReport from './calendar/report';
import routerCalGet from './calendar/get';
// import routerCalProppatch from './calendar/proppatch';
import routerCalPut from './calendar/put';
import routerCalDelete from './calendar/delete';

export default function(opts: CalDavOptionsModule) {
  const log = winston({ ...opts, label: 'calendar' });
  const userMethods = {
    propfind: routerUserPropfind(opts),
    // proppatch: routerUserProppatch(opts)
  };
  const calMethods = {
    propfind: routerCalPropfind(opts),
    report: routerCalReport(opts),
    get: routerCalGet(opts),
    // proppatch: routerCalProppatch(opts),
    put: routerCalPut(opts),
    delete: routerCalDelete(opts)
  };

  return async function(ctx: CalendarContext) {
    const method = ctx.method.toLowerCase();
    const calendarId = ctx.state.params.calendarId;
    setMultistatusResponse(ctx);
    
    if (!calendarId) {
      if (method === 'options') {
        setOptions(ctx, ['OPTIONS', 'PROPFIND']);
        return;
      }
      if (!userMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        ctx.body = notFound(ctx.url);
        return;
      }
      ctx.body = await userMethods[method].exec(ctx);
    } else {
      // check calendar exists & user has access
      const calendar = await opts.data.getCalendar({
        principalId: ctx.state.params.principalId,
        calendarId: calendarId,
        user: ctx.state.user
      });
      if (method === 'options') {
        const methods = calendar && calendar.readOnly ?
          ['OPTIONS', 'PROPFIND', 'REPORT'] :
          ['OPTIONS', 'PROPFIND', 'REPORT', 'PUT', 'DELETE'];
        setOptions(ctx, methods);
        return;
      }
      if (!calendar) {
        log.warn(`calendar not found: ${calendarId}`);
        ctx.body = notFound(ctx.url);
        return;
      }
      if (!calMethods[method]) {
        log.warn(`method handler not found: ${method}`);
        ctx.body = notFound(ctx.url);
        return;
      }
      const body = await calMethods[method].exec(ctx, calendar);
      if (body) {
        ctx.body = body;
      }
    }
  };
}
