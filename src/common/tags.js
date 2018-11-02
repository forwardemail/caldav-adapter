const { nsLookup } = require('./xml');

const buildTag = (namespaceURI, localName) => {
  return `${nsLookup[namespaceURI]}:${localName}`;
};

const dav = 'DAV:';
const cal = 'urn:ietf:params:xml:ns:caldav';
const cs = 'http://calendarserver.org/ns/';
const ical = 'http://apple.com/ns/ical/';
const href = (url) => { return { [buildTag(dav, 'href')]: url }; };

module.exports = function(opts) {
  const log = require('./winston')({ ...opts, label: 'tags' });
  const tags = {
    [dav]: {
      'current-user-principal': {
        doc: 'https://tools.ietf.org/html/rfc5397#section-3',
        resp: async ({ ctx }) => {
          return {
            [buildTag(dav, 'current-user-principal')]: href(ctx.state.principalUrl)
          };
        }
      },
      'displayname': {
        doc: 'https://tools.ietf.org/html/rfc4918#section-15.2',
        resp: async ({ ctx }) => {
          return {
            [buildTag(dav, 'displayname')]: ctx.state.user.principalName
          };
        }
      },
      'getcontenttype': {
        doc: 'https://tools.ietf.org/html/rfc2518#section-13.5'
      },
      'principal-collection-set': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.8',
        resp: async ({ ctx }) => {
          return {
            [buildTag(dav, 'principal-collection-set')]: href(ctx.state.principalRootUrl)
          };
        }
      },
      'principal-URL': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-4.2',
        resp: async ({ ctx }) => {
          return {
            [buildTag(dav, 'principal-URL')]: href(ctx.state.principalUrl)
          };
        }
      },
      'resource-id': {
        doc: 'https://tools.ietf.org/html/rfc5842#section-3.1'
      },
      'supported-report-set': {
        doc: 'https://tools.ietf.org/html/rfc3253#section-3.1.5'
      },
      'sync-token': {
        doc: 'https://tools.ietf.org/html/rfc6578#section-3',
        resp: async () => {
          return null;
        }
      }
    },
    [cal]: {
      'calendar-home-set': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-6.2.1',
        resp: async ({ ctx }) => {
          return {
            [buildTag(cal, 'calendar-home-set')]: href(ctx.state.calendarHomeUrl)
          };
        }
      },
      'calendar-user-address-set': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.4.1'
      },
      'schedule-inbox-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.2',
        resp: async () => {
          return {
            [buildTag(cal, 'schedule-inbox-URL')]: href('')
          };
        }
      },
      'schedule-outbox-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.1',
        resp: async () => {
          return {
            [buildTag(cal, 'schedule-outbox-URL')]: href('')
          };
        }
      }
    },
    [cs]: {
      'checksum-versions': {},
      'dropbox-home-URL': {},
      'email-address-set': {},
      'notification-URL': {
        doc: 'https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt'
      }
    }
  };
  const getResponse = async ({ child, ctx }) => {
    if (!child.namespaceURI) { return null; }
    if (!tags[child.namespaceURI]) {
      log.debug(`Namespace miss: ${child.namespaceURI}`);
      return null;
    }
    const tagAction = tags[child.namespaceURI][child.localName];
    if (!tagAction) {
      log.debug(`Tag miss: ${buildTag(child.namespaceURI, child.localName)}`);
      return null;
    }
    if (!tagAction.resp) {
      log.debug(`Tag no response: ${buildTag(child.namespaceURI, child.localName)}`);
      return null;
    }
    return await tagAction.resp({ ctx });
  };
  return { tags, getResponse };
};
