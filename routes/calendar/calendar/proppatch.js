const log = require('../../../lib/winston')('calendar/proppatch');

const { splitPrefix } = require('../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../lib/xBuild');
const _ = require('lodash');
// const path = require('path');

module.exports = function(opts) {
  const tagActions = {
    'calendar-color': async (ctx, calendar, val) => {
      await opts.updateCalendar(ctx.state.params.userId, calendar.calendarId, { 'calendar-color': val });
      return response(ctx.url, status[200], [{
        'ICAL:calendar-color': val
      }]);
    }
  };

  const exec = async function(ctx, reqXml, calendar) {
    const node = _.get(reqXml, 'A:propertyupdate.A:set[0].A:prop[0]');
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
