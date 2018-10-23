const raw = require('raw-body');
const { DOMParser } = require('xmldom');
const ical = require('node-ical');

module.exports = async function(ctx) {
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
