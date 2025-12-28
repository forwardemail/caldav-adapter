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
    if (ctx.logger) ctx.logger.warn(err);
    else if (ctx?.app?.emit) ctx.app.emit('error', err, ctx);
    else console.warn(err);
    // Set body to empty string on error to prevent undefined issues
    ctx.request.body = '';
  }

  // Initialize xml to null by default
  ctx.request.xml = null;

  if (
    ctx.request.type.includes('xml') && // Only attempt to parse if we have a non-empty body
    ctx.request.body &&
    typeof ctx.request.body === 'string' &&
    ctx.request.body.trim()
  ) {
    try {
      ctx.request.xml = new DOMParser().parseFromString(ctx.request.body);
      // Ensure we have a valid document, otherwise set to null
      if (!ctx.request.xml || typeof ctx.request.xml !== 'object') {
        ctx.request.xml = null;
      }
    } catch (err) {
      if (ctx.logger) ctx.logger.warn(err);
      else if (ctx?.app?.emit) ctx.app.emit('error', err, ctx);
      else console.warn(err);
      ctx.request.xml = null;
    }
  }
};
