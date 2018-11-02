const { nsLookup } = require('./xml');

const buildTag = (namespaceURI, localName) => {
  return `${nsLookup[namespaceURI]}:${localName}`;
};

const dav = 'DAV:';
const cal = 'urn:ietf:params:xml:ns:caldav';
const href = (url) => { return { [buildTag(dav, 'href')]: url }; };

module.exports = function(opts) {
  const log = require('./winston')({ ...opts, label: 'tags' });
  const tags = {
    [dav]: {
      'current-user-principal': {
        doc: 'https://tools.ietf.org/html/rfc5397#section-3',
        resp: async (ctx) => {
          return {
            [buildTag(dav, 'current-user-principal')]: href(ctx.state.principalUrl)
          };
        }
      },
      'displayname': {
        doc: 'https://tools.ietf.org/html/rfc4918#section-15.2',
        resp: async (ctx) => {
          return {
            [buildTag(dav, 'displayname')]: ctx.state.user.principalName
          };
        }
      },
      'principal-collection-set': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-5.8',
        resp: async (ctx) => {
          return {
            [buildTag(dav, 'principal-collection-set')]: href(ctx.state.principalRootUrl)
          };
        }
      },
      'principal-URL': {
        doc: 'https://tools.ietf.org/html/rfc3744#section-4.2',
        resp: async (ctx) => {
          return {
            [buildTag(dav, 'principal-URL')]: href(ctx.state.principalUrl)
          };
        }
      }
    },
    [cal]: {
      'calendar-home-set': {
        doc: 'https://tools.ietf.org/html/rfc4791#section-6.2.1',
        resp: async (ctx) => {
          return {
            [buildTag(cal, 'calendar-home-set')]: href(ctx.state.calendarHomeUrl)
          };
        }
      },
      'schedule-inbox-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.2',
        resp: async (/*ctx*/) => {
          return {
            [buildTag(cal, 'schedule-inbox-URL')]: href('')
          };
        }
      },
      'schedule-outbox-URL': {
        doc: 'https://tools.ietf.org/html/rfc6638#section-2.1',
        resp: async (/*ctx*/) => {
          return {
            [buildTag(cal, 'schedule-outbox-URL')]: href('')
          };
        }
      }
    }
  };
  const getResponse = async (child, ctx) => {
    if (!tags[child.namespaceURI]) {
      log.debug(`Namespace miss: ${child.namespaceURI}`);
      return null;
    }
    const tagAction = tags[child.namespaceURI][child.localName];
    log.debug(`Tag ${tagAction ? 'hit' : 'miss'}: ${buildTag(child.namespaceURI, child.localName)}`);
    if (!tagAction || !tagAction.resp) { return null; }
    return await tagAction.resp(ctx);
  };
  return { tags, getResponse };
};
