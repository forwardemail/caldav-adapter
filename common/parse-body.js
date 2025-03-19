const raw = require('raw-body');
const { DOMParser } = require('@xmldom/xmldom');

module.exports = async function (ctx) {
  try {
    ctx.request.body = await raw(ctx.req, {
      encoding: true,
      limit: '10mb' // Practical
    });
  } catch (err) {
    // <https://github.com/stream-utils/raw-body/blob/f62e660e7c50891844f5615de075ab145c1f6129/README.md?plain=1#L82-L116>
    if (ctx?.app?.emit) ctx.app.emit('error', err, ctx);
    else throw err;
  }

  if (ctx.request.type.includes('xml')) {
    try {
      ctx.request.xml = new DOMParser().parseFromString(ctx.request.body);
    } catch (err) {
      if (ctx?.app?.emit) ctx.app.emit('error', err, ctx);
      else throw err;
    }
  }
};
