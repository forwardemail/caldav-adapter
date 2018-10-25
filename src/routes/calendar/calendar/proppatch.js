const xml = require('../../../common/xml');
const { build, multistatus, response, status } = require('../../../common/xBuild');
const _ = require('lodash');
// const path = require('path');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/proppatch' });
  const tagActions = {
    'calendar-color': async (ctx, calendar, val) => {
      await opts.data.updateCalendar({
        principalId: ctx.state.params.principalId,
        calendarId: calendar.calendarId,
        calendarValue: { 'calendar-color': val }
      });
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
    const propNode = xml.get('/D:propertyupdate/D:set/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];

    const actions = _.map(children, async (child) => {
      const tag = child.localName;
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx, calendar, child.textContent);
    });
    const res = await Promise.all(actions);
    
    const ms = multistatus(_.compact(res));
    return build(ms);
  };

  return {
    exec
  };
};
