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
      'current-user-privilege-set': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.4',
        resp: async ({ resource, calendar }) => {
          if (resource === 'calendar') {
            const privileges = [{ [buildTag(dav, 'read')]: '' }];
            if (!calendar.readOnly) {
              privileges.push(...[
                { [buildTag(dav, 'read')]: '' },
                { [buildTag(dav, 'read-acl')]: '' },
                { [buildTag(dav, 'read-current-user-privilege-set')]: '' },
                { [buildTag(dav, 'write')]: '' },
                { [buildTag(dav, 'write-content')]: '' },
                { [buildTag(dav, 'write-properties')]: '' },
                { [buildTag(dav, 'bind')]: '' }, // PUT - https://tools.ietf.org/html/rfc3744#section-3.9
                { [buildTag(dav, 'unbind')]: '' }, // DELETE - https://tools.ietf.org/html/rfc3744#section-3.10
                { [buildTag(cal, 'read-free-busy')]: '' } // https://tools.ietf.org/html/rfc4791#section-6.1.1
              ]);
            }
            return {
              [buildTag(dav, 'current-user-privilege-set')]: {
                [buildTag(dav, 'privilege')]: privileges
              }
            };
          }          
        }
      },
      'displayname': {
        doc: 'https://tools.ietf.org/html/rfc4918#section-15.2',
        resp: async ({ resource, ctx, calendar }) => {
          if (resource === 'principal') {
            return {
              [buildTag(dav, 'displayname')]: ctx.state.user.principalName
            };
          } else if (resource === 'calendar') {
            return {
              [buildTag(dav, 'displayname')]: calendar.calendarName
            };
          }
        }
      },
      'getcontenttype': {
        doc: 'https://tools.ietf.org/html/rfc2518#section-13.5',
        resp: async ({ resource }) => {
          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'getcontenttype')]: 'text/calendar; charset=utf-8; component=VEVENT'
            };
          }
        }
      },
      'getetag': {

      },
      'owner': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.1',
        resp: async ({ resource, ctx }) => {
          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'owner')]: href(ctx.state.principalUrl)
            };
          }
        }
      },
      'principal-collection-set': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.8',
        resp: async ({ resource, ctx }) => {
          if (resource === 'principal') {
            return {
              [buildTag(dav, 'principal-collection-set')]: href(ctx.state.principalRootUrl)
            };
          }
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
      'resourcetype': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-4.2',
        resp: async ({ resource }) => {
          if (resource === 'calCollection') {
            return {
              [buildTag(dav, 'resourcetype')]: {
                [buildTag(dav, 'collection')]: ''
              }
            };
          } else if (resource === 'calendar') {
            return {
              [buildTag(dav, 'resourcetype')]: {
                [buildTag(dav, 'collection')]: '',
                [buildTag(cal, 'calendar')]: ''
              }
            };
          }
        }
      },
      'supported-report-set': {
        doc: 'https://tools.ietf.org/html/rfc3253#section-3.1.5',
        resp: async ({ resource }) => {
          if (resource === 'calCollection') {
            return {
              [buildTag(dav, 'supported-report-set')]: {
                [buildTag(dav, 'supported-report')]: {
                  // [buildTag(dav, 'report')]: { [buildTag(cal, 'sync-collection')]: '' }
                }
              }
            };
          } else if (resource === 'calendar') {
            return {
              [buildTag(dav, 'supported-report-set')]: {
                [buildTag(dav, 'supported-report')]: [
                  { [buildTag(dav, 'report')]: { [buildTag(cal, 'calendar-query')]: '' } },
                  { [buildTag(dav, 'report')]: { [buildTag(cal, 'calendar-multiget')]: '' } },
                  // { [buildTag(dav, 'report')]: { [buildTag(cal, 'sync-collection')]: '' } }
                ]
              }
            };
          }
        }
      },
      'sync-token': {
        doc: 'https://tools.ietf.org/html/rfc6578#section-3',
        resp: async ({ response, calendar }) => {
          if (response === 'calendar') {
            return {
              [buildTag(dav, 'sync-token')]: calendar.syncToken
            };
          }
        }
      }
    },
    [cal]: {
      'calendar-home-set': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-6.2.1',
        resp: async ({ resource, ctx }) => {
          if (resource === 'principal') {
            return {
              [buildTag(cal, 'calendar-home-set')]: href(ctx.state.calendarHomeUrl)
            };
          }
        }
      },
      'calendar-timezone': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-5.2.2'
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
      },
      'supported-calendar-component-set': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-5.2.3',
        resp: async ({ resource }) => {
          if (resource === 'calendar') {
            return {
              [buildTag(cal, 'supported-calendar-component-set')]: {
                [buildTag(cal, 'comp')]: {
                  '@name': 'VEVENT'
                }
              }
            };
          }
        }
      }
    },
    [cs]: {
      'allowed-sharing-modes': {
        doc: 'https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-sharing.txt',
        resp: async ({ resource }) => {
          if (resource === 'calendar') {
            return {
              [buildTag(cs, 'allowed-sharing-modes')]: ''
            };
          }
        }
      },
      'checksum-versions': {},
      'dropbox-home-URL': {},
      'email-address-set': {},
      'getctag': { // DEPRECATED
        doc: 'https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt',
        resp: async ({ response, calendar }) => {
          if (response === 'calendar') {
            return {
              [buildTag(cs, 'getctag')]: calendar.syncToken
            };
          }
        }
      },
      'notification-URL': {
        doc: 'https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-notifications.txt'
      }
    },
    [ical]: {
      'calendar-color': {
        resp: async ({ response, calendar }) => {
          if (response === 'calendar') {
            return {
              [buildTag(ical, 'calendar-color')]: calendar.color
            };
          }
        }
      },
      'calendar-order': {}
    }
  };
  const getResponse = async ({ resource, child, ctx, calendar }) => {
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
    return await tagAction.resp({ resource, ctx, calendar });
  };
  return { tags, getResponse };
};
