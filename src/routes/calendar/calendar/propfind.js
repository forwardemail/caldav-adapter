const xml = require('../../../common/xml');
const { build, multistatus, response, status } = require('../../../common/xBuild');
const _ = require('lodash');
const path = require('path');

module.exports = function(opts) {
  const tags = require('../../../common/tags')(opts);
  const eventResponse = require('./eventResponse')(opts);

  const calendarResponse = async function(ctx, calendar) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];
    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
        resource: 'calendar',
        child,
        ctx,
        calendar
      });
    });
    const res = await Promise.all(actions);
    
    const calendarUrl = path.join(ctx.state.calendarHomeUrl, calendar.calendarId, '/');
    const props = _.compact(res);
    return response(calendarUrl, props.length ? status[200] : status[404], props);
  };

  const exec = async function(ctx, calendar) {
    const resp = await calendarResponse(ctx, calendar);
    const resps = [resp];
    
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });
    const events = await opts.data.getEventsForCalendar({
      principalId: ctx.state.params.principalId,
      calendarId: calendar.calendarId,
      user: ctx.state.user,
      fullData: fullData
    });
    const { responses } = await eventResponse(ctx, events, calendar, children);
    resps.push(...responses);

    const ms = multistatus(resps);
    return build(ms);
  };

  return {
    exec,
    calendarResponse
  };
};
