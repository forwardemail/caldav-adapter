const _ = require('lodash');
const xml = require('../../common/xml');
const {
  build,
  multistatus,
  response,
  status
} = require('../../common/x-build');
const commonTags = require('../../common/tags');

module.exports = function (options) {
  const tags = commonTags(options);
  return async function (ctx) {
    // RFC 4918 Section 9.1 says an empty PROPFIND body
    // MUST be treated as an allprop request, not rejected with 400
    let children = [];
    if (ctx.request.xml) {
      ({ children } = xml.getWithChildren(
        '/D:propfind/D:prop',
        ctx.request.xml
      ));
    }

    // If no properties requested (allprop), return a default set
    // Each entry must include namespaceURI so getResponse() can resolve the tag handler
    const dav = 'DAV:';
    const cal = 'urn:ietf:params:xml:ns:caldav';
    if (children.length === 0) {
      children = [
        { namespaceURI: dav, localName: 'displayname' },
        { namespaceURI: dav, localName: 'resourcetype' },
        { namespaceURI: dav, localName: 'current-user-principal' },
        { namespaceURI: dav, localName: 'current-user-privilege-set' },
        { namespaceURI: cal, localName: 'calendar-home-set' },
        { namespaceURI: cal, localName: 'calendar-user-address-set' },
        { namespaceURI: cal, localName: 'schedule-inbox-URL' },
        { namespaceURI: cal, localName: 'schedule-outbox-URL' }
      ];
    }

    const actions = _.map(children, async (child) => {
      return tags.getResponse({
        resource: 'principal',
        child,
        ctx
      });
    });
    const res = await Promise.all(actions);

    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
};
