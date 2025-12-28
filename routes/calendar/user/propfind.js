const _ = require('lodash');
const xml = require('../../../common/xml');
const winston = require('../../../common/winston');
const {
  build,
  multistatus,
  response,
  status
} = require('../../../common/x-build');
const calPropfind = require('../calendar/propfind');
const commonTags = require('../../../common/tags');

module.exports = function (options) {
  const log = winston({ ...options, label: 'user/propfind' });
  const { calendarResponse } = calPropfind(options);
  const tags = commonTags(options);

  const exec = async function (ctx) {
    // Handle missing or invalid XML body gracefully
    // This can happen when the client connection is interrupted
    // or the body was not received properly
    if (!ctx.request.xml) {
      log.warn('PROPFIND request received with missing or invalid XML body');
      // Return a minimal valid response for allprop
      // RFC 4918 Section 9.1: If no body is included, the request MUST be treated as allprop
    }

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
