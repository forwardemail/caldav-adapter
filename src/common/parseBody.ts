import raw from 'raw-body';
import { DOMParser } from 'xmldom';
import ical, { FullCalendar } from 'ical';
import { Context } from 'koa';

declare module 'koa' {
  interface Request {
    body?: string;
    xml?: Document;
    ical?: FullCalendar;
  }
}

export default async function(ctx: Context) {
  ctx.request.body = await raw(ctx.req, {
    encoding: true,
    limit: '1mb' // practical
  });

  if (ctx.request.type.includes('xml')) {
    ctx.request.xml = new DOMParser().parseFromString(ctx.request.body);
  } else if (ctx.request.type === 'text/calendar') {
    ctx.request.ical = ical.parseICS(ctx.request.body);
  }
};
