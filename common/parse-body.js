const ical = require('node-ical');
const raw = require('raw-body');
const { DOMParser } = require('@xmldom/xmldom');

module.exports = async function (ctx) {
  ctx.request.body = await raw(ctx.req, {
    encoding: true,
    limit: '1mb' // Practical
  });

  if (ctx.request.type.includes('xml')) {
    ctx.request.xml = new DOMParser().parseFromString(ctx.request.body);
  } else if (ctx.request.type === 'text/calendar') {
    ctx.request.ical = await ical.async.parseICS(ctx.request.body);
  }
};
