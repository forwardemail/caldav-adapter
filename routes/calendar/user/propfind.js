const _ = require('lodash');
const xml = require('../../../common/xml');
const {
  build,
  multistatus,
  response,
  status
} = require('../../../common/x-build');
const calPropfind = require('../calendar/propfind');
const commonTags = require('../../../common/tags');

module.exports = function (options) {
  const { calendarResponse } = calPropfind(options);
  const tags = commonTags(options);

  const exec = async function (ctx) {
    const { children } = xml.getWithChildren(
      '/D:propfind/D:prop',
      ctx.request.xml
    );
    const checksum = _.some(
      children,
      (child) => child.localName === 'checksum-versions'
    );

    const actions = _.map(children, async (child) => {
      return tags.getResponse({
        resource: 'calCollection',
        child,
        ctx
      });
    });
    const res = await Promise.all(actions);
    const props = _.compact(res);
    const responses = [
      response(ctx.url, props.length > 0 ? status[200] : status[404], props)
    ];

    const calendars = await options.data.getCalendarsForPrincipal(ctx, {
      principalId: ctx.state.params.principalId,
      user: ctx.state.user
    });

    const calResponses = checksum
      ? []
      : await Promise.all(
          calendars.map(async (cal) => {
            return calendarResponse(ctx, cal);
          })
        );

    const ms = multistatus([...responses, ..._.compact(calResponses)]);

    return build(ms);
  };

  return {
    exec
  };
};
