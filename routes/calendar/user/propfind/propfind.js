const log = require('../../../../lib/winston')('calendar/user/propfind');

const { splitPrefix } = require('../../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../../lib/xBuild');
const _ = require('lodash');

const tagActions = {
  
};

module.exports = function(/*opts*/) {
  return async function(ctx, reqXml) {
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx);
    });
    const res = await Promise.all(actions);
    
    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
};
