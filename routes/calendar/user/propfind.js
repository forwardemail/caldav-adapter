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
    // RFC 4918 Section 9.1: an empty PROPFIND body
    // MUST be treated as an allprop request
    let children = [];
    if (ctx.request.xml) {
      ({ children } = xml.getWithChildren(
        '/D:propfind/D:prop',
        ctx.request.xml
      ));
    } else {
      log.warn('PROPFIND request received with missing or invalid XML body');
    }

    //
    // If no properties were requested (allprop or empty body), return
    // the default set of properties that CalDAV clients need for
    // calendar home discovery.
    //
    const dav = 'DAV:';
    const cs = 'http://calendarserver.org/ns/';
    if (children.length === 0) {
      children = [
        { namespaceURI: dav, localName: 'displayname' },
        { namespaceURI: dav, localName: 'resourcetype' },
        { namespaceURI: dav, localName: 'current-user-principal' },
        { namespaceURI: dav, localName: 'current-user-privilege-set' },
        { namespaceURI: dav, localName: 'supported-report-set' },
        { namespaceURI: cs, localName: 'getctag' }
      ];
    }

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

    //
    // Performance: Depth:0 means the client only wants the collection
    // itself, not its children (individual calendars).
    //
    const depth = ctx.get('depth') || 'infinity';
    if (depth === '0') {
      const ms = multistatus(responses);
      return build(ms);
    }

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
