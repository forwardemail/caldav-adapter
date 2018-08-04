const { parse } = require('../lib/xParse');

module.exports = function() {
  const propfind = async function(xml) {
    const children = get(xml, 'A:propfind.A:prop[0]');
    if (!children) { return; }

  };


  return async function(ctx/*, params*/) {
    const parsed = await parse(ctx.request.body);
    if (ctx.method === 'PROPFIND') {
      ctx.body = await propfind(parsed);
    } else if (ctx.method === 'PROPPATCH') {

    } else if (ctx.method === 'REPORT') {

    }
  };
};
