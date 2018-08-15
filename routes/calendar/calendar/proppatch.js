const { splitPrefix } = require('../../../lib/util');
const { build, multistatus, response, status } = require('../../../lib/xBuild');
const _ = require('lodash');
// const path = require('path');

module.exports = function(opts) {
  const log = require('../../../lib/winston')({ ...opts, label: 'calendar/proppatch' });
  const tagActions = {
    'calendar-color': async (ctx, calendar, val) => {
      await opts.updateCalendar(ctx.state.params.userId, calendar.calendarId, { 'calendar-color': val });
      return response(ctx.url, status[200], [{
        'ICAL:calendar-color': val
      }]);
    },
    'calendar-order': async (ctx) => {
      return response(ctx.url, status[403], [{
        'D:calendar-order': ''
      }]);
    },
    'calendar-timezone': async (ctx) => {
      return response(ctx.url, status[403], [{
        'CAL:calendar-order': ''
      }]);
    }
  };

  const exec = async function(ctx, calendar) {
    const node = _.get(ctx.request.xml, 'A:propertyupdate.A:set[0].A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx, calendar, _.get(v, '[0]._'));
    });
    const res = await Promise.all(actions);
    
    const ms = multistatus(_.compact(res));
    return build(ms);
  };

  return {
    exec
  };
};
