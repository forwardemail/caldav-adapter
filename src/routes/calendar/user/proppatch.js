const xml = require('../../../common/xml');
const { build, multistatus } = require('../../../common/xBuild');
const _ = require('lodash');
// const path = require('path');

module.exports = function(opts) {
  const tags = require('../../../common/tags')(opts);

  const exec = async function(ctx) {
    const propNode = xml.get('/D:propertyupdate/D:set/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
        resource: 'calCollectionProppatch',
        child,
        ctx
      });
    });
    const res = await Promise.all(actions);
    
    const ms = multistatus(_.compact(res));
    return build(ms);
  };

  return {
    exec
  };
};
