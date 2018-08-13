const log = require('../../../lib/winston')('calendar/user/proppatch');

const { splitPrefix } = require('../../../lib/util');
const { build, multistatus, response, status } = require('../../../lib/xBuild');
const _ = require('lodash');
// const path = require('path');

module.exports = function() {
  const tagActions = {
    /* https://tools.ietf.org/id/draft-daboo-valarm-extensions-01.html#rfc.section.9 */
    'default-alarm-vevent-date': async (ctx) => {
      return response(ctx.url, status[403], [{
        'CAL:default-alarm-vevent-date': ''
      }]);
    },
    'default-alarm-vevent-datetime': async (ctx) => {
      return response(ctx.url, status[403], [{
        'CAL:default-alarm-vevent-datetime': ''
      }]);
    }
  };

  const exec = async function(ctx) {
    const node = _.get(ctx.request.xml, 'A:propertyupdate.A:set[0].A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx);
    });
    const res = await Promise.all(actions);
    
    const ms = multistatus(_.compact(res));
    return build(ms);
  };

  return {
    exec
  };
};
