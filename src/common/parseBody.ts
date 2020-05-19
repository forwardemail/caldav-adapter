import raw from 'raw-body';
import { DOMParser } from 'xmldom';
import ical from 'ical';
import { CalendarContext } from '../koa';

export default async function(ctx: CalendarContext) {
  ctx.request.body = await raw(ctx.req, {
    encoding: true,
    limit: '1mb' // practical
  });

  if (ctx.request.type.includes('xml')) {
    ctx.request.xml = new DOMParser().parseFromString(ctx.request.body);
  } else if (ctx.request.type === 'text/calendar') {
    ctx.request.ical = ical.parseICS(ctx.request.body);
  }
}
