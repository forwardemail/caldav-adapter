const xml = require('../../../common/xml');
const { build, multistatus, response, status } = require('../../../common/xBuild');
const _ = require('lodash');
// const path = require('path');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/user/proppatch' });
  const tagActions = {
    'calendar-order': async (ctx) => {
      return response(ctx.url, status[403], [{
        'D:calendar-order': ''
      }]);
    },
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
    const propNode = xml.get('/D:propertyupdate/D:set/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const actions = _.map(children, async (child) => {
      const tag = child.localName;
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
