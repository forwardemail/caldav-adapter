const path = require('node:path');
const _ = require('lodash');
const xml = require('../../../common/xml');
const {
  build,
  multistatus,
  response,
  status
} = require('../../../common/x-build');
const commonTags = require('../../../common/tags');
const calEventResponse = require('./event-response');

module.exports = function (options) {
  const tags = commonTags(options);
  const eventResponse = calEventResponse(options);

  const calendarResponse = async function (ctx, calendar) {
    const { children } = xml.getWithChildren(
      '/D:propfind/D:prop',
      ctx.request.xml
    );
    const actions = _.map(children, async (child) => {
      return tags.getResponse({
        resource: 'calendar',
        child,
        ctx,
        calendar
      });
    });
    const res = await Promise.all(actions);

    const calendarUrl = path.join(
      ctx.state.calendarHomeUrl,
      options.data.getCalendarId(ctx, calendar),
      '/'
    );
    const props = _.compact(res);
    return response(
      calendarUrl,
      props.length > 0 ? status[200] : status[404],
      props
    );
  };

  const exec = async function (ctx, calendar) {
    const resp = await calendarResponse(ctx, calendar);
    const resps = [resp];

    const { children } = xml.getWithChildren(
      '/D:propfind/D:prop',
      ctx.request.xml
    );
    const fullData = _.some(children, (child) => {
      return child.localName === 'calendar-data';
    });
    const events = await options.data.getEventsForCalendar(ctx, {
      principalId: ctx.state.params.principalId,
      calendarId: options.data.getCalendarId(ctx, calendar),
      user: ctx.state.user,
      fullData
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
