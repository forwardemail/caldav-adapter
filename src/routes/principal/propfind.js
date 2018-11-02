const xml = require('../../common/xml');
const { build, multistatus, response, status } = require('../../common/xBuild');
const _ = require('lodash');

module.exports = function(opts) {
  const tags = require('../../common/tags')(opts);
  return async function(ctx) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
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
