const { isEmail } = require('validator');
const { buildTag, href, response, status } = require('./x-build');
const winston = require('./winston');

const dav = 'DAV:';
const cal = 'urn:ietf:params:xml:ns:caldav';
const cs = 'http://calendarserver.org/ns/';
const ical = 'http://apple.com/ns/ical/';

/**
 * Encode special characters for XML content to prevent parsing errors
 * @param {string} str - String to encode
 * @returns {string} - XML-safe encoded string
 */
function encodeXMLEntities(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replaceAll('&', '&amp;') // Must be first to avoid double-encoding
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = function (options) {
  const log = winston({ ...options, label: 'tags' });
  const tags = {
    [dav]: {
      'current-user-principal': {
        doc: 'https://tools.ietf.org/html/rfc5397#section-3',
        async resp({ ctx }) {
          return {
            [buildTag(dav, 'current-user-principal')]: href(
              ctx.state.principalUrl
            )
          };
        }
      },
      'current-user-privilege-set': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.4',
        async resp({ resource, calendar }) {
          if (resource === 'calendar') {
            const privileges = [{ [buildTag(dav, 'read')]: '' }];
            if (!calendar.readonly) {
              privileges.push(
                { [buildTag(dav, 'read')]: '' },
                { [buildTag(dav, 'read-acl')]: '' },
                { [buildTag(dav, 'read-current-user-privilege-set')]: '' },
                { [buildTag(dav, 'write')]: '' },
                { [buildTag(dav, 'write-content')]: '' },
                { [buildTag(dav, 'write-properties')]: '' },
                { [buildTag(dav, 'bind')]: '' }, // PUT - https://tools.ietf.org/html/rfc3744#section-3.9
                { [buildTag(dav, 'unbind')]: '' }, // DELETE - https://tools.ietf.org/html/rfc3744#section-3.10
                { [buildTag(cal, 'read-free-busy')]: '' } // https://tools.ietf.org/html/rfc4791#section-6.1.1
              );
            }

            return {
              [buildTag(dav, 'current-user-privilege-set')]: {
                [buildTag(dav, 'privilege')]: privileges
              }
            };
          }
        }
      },
      displayname: {
        doc: 'https://tools.ietf.org/html/rfc4918#section-15.2',
        async resp({ resource, ctx, calendar }) {
          if (resource === 'principal') {
            return {
              [buildTag(dav, 'displayname')]: ctx.state.user.principalName
            };
          }

          if (resource === 'calendar')
            return {
              [buildTag(dav, 'displayname')]: encodeXMLEntities(calendar.name)
            };

          if (resource === 'calendarProppatch')
            return response(ctx.url, status[200], [
              {
                [buildTag(dav, 'displayname')]: encodeXMLEntities(calendar.name)
              }
            ]);
        }
      },
      getcontenttype: {
        doc: 'https://tools.ietf.org/html/rfc2518#section-13.5',
        async resp({ resource, event }) {
          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'getcontenttype')]: 'text/calendar; charset=utf-8'
            };
          }

          if (resource === 'event') {
            const componentType = event?.componentType || 'VEVENT';
            return {
              [buildTag(dav, 'getcontenttype')]:
                `text/calendar; charset=utf-8; component=${componentType}`
            };
          }
        }
      },
      getetag: {
        doc: 'https://tools.ietf.org/html/rfc4791#section-5.3.4',
        async resp({ resource, ctx, event }) {
          if (resource === 'event') {
            return {
              [buildTag(dav, 'getetag')]: options.data.getETag(ctx, event)
            };
          }
        }
      },
      owner: {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.1',
        async resp({ resource, ctx }) {
          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'owner')]: href(ctx.state.principalUrl)
            };
          }
        }
      },
      'principal-collection-set': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.8',
        async resp({ resource, ctx }) {
          if (resource === 'principal') {
            return {
              [buildTag(dav, 'principal-collection-set')]: href(
                ctx.state.principalRootUrl
              )
            };
          }
        }
      },
      'principal-URL': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-4.2',
        async resp({ ctx }) {
          return {
            [buildTag(dav, 'principal-URL')]: href(ctx.state.principalUrl)
          };
        }
      },
      'resource-id': {
        doc: 'https://tools.ietf.org/html/rfc5842#section-3.1'
      },
      resourcetype: {
        doc: 'https://tools.ietf.org/html/rfc4791#section-4.2',
        async resp({ resource }) {
          if (resource === 'calCollection') {
            return {
              [buildTag(dav, 'resourcetype')]: {
                [buildTag(dav, 'collection')]: ''
              }
            };
          }

          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'resourcetype')]: {
                [buildTag(dav, 'collection')]: '',
                [buildTag(cal, 'calendar')]: ''
              }
            };
          }

          if (resource === 'principal') {
            return {
              [buildTag(dav, 'resourcetype')]: {
                [buildTag(dav, 'principal')]: ''
              }
            };
          }
        }
      },
      'supported-report-set': {
        doc: 'https://tools.ietf.org/html/rfc3253#section-3.1.5',
        async resp({ resource }) {
          if (resource === 'calCollection') {
            return {
              [buildTag(dav, 'supported-report-set')]: {
                [buildTag(dav, 'supported-report')]: {
                  [buildTag(dav, 'report')]: {
                    [buildTag(cal, 'sync-collection')]: ''
                  }
                }
              }
            };
          }

          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'supported-report-set')]: {
                [buildTag(dav, 'supported-report')]: [
                  {
                    [buildTag(dav, 'report')]: {
                      [buildTag(cal, 'calendar-query')]: ''
                    }
                  },
                  {
                    [buildTag(dav, 'report')]: {
                      [buildTag(cal, 'calendar-multiget')]: ''
                    }
                  },
                  {
                    [buildTag(dav, 'report')]: {
                      [buildTag(cal, 'sync-collection')]: ''
                    }
                  }
                ]
              }
            };
          }
        }
      },
      'sync-token': {
        doc: 'https://tools.ietf.org/html/rfc6578#section-3',
        async resp({ resource, calendar }) {
          if (resource === 'calendar') {
            return {
              [buildTag(dav, 'sync-token')]: calendar.synctoken
            };
          }
        }
      }
    },
    [cal]: {
      'calendar-data': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-9.6',
        async resp({ event, ctx, calendar }) {
          const ics = await options.data.buildICS(ctx, event, calendar);
          // Use entity encoding instead of CDATA for better API compatibility
          // This ensures special characters are properly encoded while maintaining
          // compatibility with tsdav and other CalDAV clients that expect string content
          return {
            [buildTag(cal, 'calendar-data')]: encodeXMLEntities(ics)
          };
        }
      },
      'calendar-home-set': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-6.2.1',
        async resp({ resource, ctx }) {
          if (resource === 'principal') {
            return {
              [buildTag(cal, 'calendar-home-set')]: href(
                ctx.state.calendarHomeUrl
              )
            };
          }
        }
      },
      'calendar-description': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-5.2.1',
        async resp({ resource, ctx, calendar }) {
          if (resource === 'calendar')
            return {
              [buildTag(cal, 'calendar-description')]: encodeXMLEntities(
                calendar.description
              )
            };

          if (resource === 'calendarProppatch')
            return response(ctx.url, status[200], [
              {
                [buildTag(cal, 'calendar-description')]: encodeXMLEntities(
                  calendar.description
                )
              }
            ]);
        }
      },
      'calendar-timezone': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-5.2.2',
        async resp({ resource, ctx, calendar }) {
          if (resource === 'calendar')
            return {
              [buildTag(cal, 'calendar-timezone')]: encodeXMLEntities(
                calendar.timezone
              )
            };

          if (resource === 'calendarProppatch')
            return response(ctx.url, status[200], [
              {
                [buildTag(cal, 'calendar-timezone')]: encodeXMLEntities(
                  calendar.timezone
                )
              }
            ]);
        }
      },
      'calendar-user-address-set': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.4.1',
        async resp({ ctx }) {
          if (isEmail(ctx.state.user.principalName))
            return {
              [buildTag(cal, 'calendar-user-address-set')]: href(
                `mailto:${ctx.state.user.principalName}`
              )
            };
          if (isEmail(ctx.state.user.email))
            return {
              [buildTag(cal, 'calendar-user-address-set')]: href(
                `mailto:${ctx.state.user.email}`
              )
            };
          return {
            [buildTag(cal, 'calendar-user-address-set')]: ''
          };
        }
      },
      'default-alarm-vevent-date': {
        doc: 'https://tools.ietf.org/id/draft-daboo-valarm-extensions-01.html#rfc.section.9',
        async resp({ resource, ctx }) {
          if (resource === 'calCollectionProppatch') {
            return response(ctx.url, status[403], [
              {
                [buildTag(cal, 'default-alarm-vevent-date')]: ''
              }
            ]);
          }
        }
      },
      'default-alarm-vevent-datetime': {
        doc: 'https://tools.ietf.org/id/draft-daboo-valarm-extensions-01.html#rfc.section.9',
        async resp({ resource, ctx }) {
          if (resource === 'calCollectionProppatch') {
            return response(ctx.url, status[403], [
              {
                [buildTag(cal, 'default-alarm-vevent-datetime')]: ''
              }
            ]);
          }
        }
      },
      'schedule-inbox-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.2',
        async resp({ ctx }) {
          if (ctx && ctx.state && ctx.state.calendarHomeUrl) {
            return {
              [buildTag(cal, 'schedule-inbox-URL')]: href(
                ctx.state.calendarHomeUrl.replace(/\/$/, '') + '/inbox/'
              )
            };
          }

          return {
            [buildTag(cal, 'schedule-inbox-URL')]: href('')
          };
        }
      },
      'schedule-outbox-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.1',
        async resp({ ctx }) {
          if (ctx && ctx.state && ctx.state.calendarHomeUrl) {
            return {
              [buildTag(cal, 'schedule-outbox-URL')]: href(
                ctx.state.calendarHomeUrl.replace(/\/$/, '') + '/outbox/'
              )
            };
          }

          return {
            [buildTag(cal, 'schedule-outbox-URL')]: href('')
          };
        }
      },
      'supported-calendar-component-set': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-5.2.3',
        async resp({ resource }) {
          if (resource === 'calendar') {
            return {
              [buildTag(cal, 'supported-calendar-component-set')]: {
                [buildTag(cal, 'comp')]: [
                  { '@name': 'VEVENT' },
                  { '@name': 'VTODO' }
                ]
              }
            };
          }
        }
      },
      'schedule-default-calendar-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-9.2',
        async resp({ ctx }) {
          if (ctx && ctx.state && ctx.state.calendarUrl) {
            return {
              [buildTag(cal, 'schedule-default-calendar-URL')]: href(
                ctx.state.calendarUrl
              )
            };
          }

          return {
            [buildTag(cal, 'schedule-default-calendar-URL')]: href('')
          };
        }
      },
      'schedule-calendar-transp': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-9.1',
        async resp({ resource, calendar }) {
          if (resource === 'calendar') {
            // Default to opaque (events affect free-busy)
            const transp = calendar?.scheduleTransp || 'opaque';
            return {
              [buildTag(cal, 'schedule-calendar-transp')]: {
                [buildTag(cal, transp)]: ''
              }
            };
          }
        }
      },
      'schedule-tag': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-3.2.10',
        async resp({ resource, event }) {
          if (resource === 'event' && event?.scheduleTag) {
            return {
              [buildTag(cal, 'schedule-tag')]: event.scheduleTag
            };
          }
        }
      }
    },
    [cs]: {
      'allowed-sharing-modes': {
        doc: 'https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-sharing.txt',
        async resp({ resource }) {
          if (resource === 'calendar') {
            return {
              [buildTag(cs, 'allowed-sharing-modes')]: ''
            };
          }
        }
      },
      'checksum-versions': {},
      'dropbox-home-URL': {},
      'email-address-set': {
        async resp({ resource, ctx }) {
          if (
            resource === 'calendar' &&
            (ctx?.state?.user?.email || ctx?.state?.user?.username)
          ) {
            return {
              [buildTag(cs, 'email-address-set')]:
                ctx?.state?.user?.email || ctx?.state?.user?.username
            };
          }
        }
      },
      getctag: {
        // DEPRECATED
        doc: 'https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt',
        async resp({ resource, calendar }) {
          if (resource === 'calendar') {
            return {
              [buildTag(cs, 'getctag')]: calendar.synctoken
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
        async resp({ resource, ctx, calendar }) {
          if (resource === 'calendar')
            return {
              [buildTag(ical, 'calendar-color')]: encodeXMLEntities(
                calendar.color
              )
            };

          if (resource === 'calendarProppatch')
            return response(ctx.url, status[200], [
              {
                [buildTag(ical, 'calendar-color')]: encodeXMLEntities(
                  calendar.color
                )
              }
            ]);
        }
      },
      'calendar-order': {
        async resp({ resource, ctx, calendar }) {
          if (resource === 'calendar')
            return {
              [buildTag(ical, 'calendar-order')]: calendar.order
            };

          if (resource === 'calendarProppatch')
            return response(ctx.url, status[200], [
              {
                [buildTag(ical, 'calendar-order')]: calendar.order
              }
            ]);
        }
      }
    }
  };

  const getResponse = async ({ resource, child, ctx, calendar, event }) => {
    if (!child.namespaceURI) {
      return null;
    }

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
      log.debug(
        `Tag no response: ${buildTag(child.namespaceURI, child.localName)}`
      );
      return null;
    }

    return tagAction.resp({
      resource,
      ctx,
      calendar,
      event,
      text: child.textContent
    });
  };

  return { tags, getResponse };
};
