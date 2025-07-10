const _ = require('lodash');
const xml = require('../../common/xml');
const {
  build,
  multistatus,
  response,
  status
} = require('../../common/x-build');
const commonTags = require('../../common/tags');

module.exports = function (options) {
  const tags = commonTags(options);
  return async function (ctx) {
    // Validate XML document before processing
    if (!ctx.request.xml) {
      ctx.throw(400, 'Invalid or missing XML in PROPFIND request');
    }

    const { children } = xml.getWithChildren(
      '/D:propfind/D:prop',
      ctx.request.xml
    );

    const actions = _.map(children, async (child) => {
      return tags.getResponse({
        resource: 'principal',
        child,
        ctx
      });
    });
    const res = await Promise.all(actions);

    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
};
