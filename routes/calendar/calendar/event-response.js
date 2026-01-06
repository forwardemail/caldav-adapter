const path = require('node:path');
const _ = require('lodash');
const {
  response,
  status,
  missingPropstats
} = require('../../../common/x-build');
const commonTags = require('../../../common/tags');

module.exports = function (options) {
  const tags = commonTags(options);

  return async function (ctx, events, calendar, children) {
    const eventActions = _.map(events, async (event) => {
      const misses = [];
      const propActions = _.map(children, async (child) => {
        return tags.getResponse({
          resource: 'event',
          child,
          ctx,
          calendar,
          event
        });
      });

      //
      // <https://www.rfc-editor.org/rfc/rfc6578.html#page-14:~:text=The%20content%20of%20each%20DAV%3Aresponse%20element%20differs%20depending%20on%20how%0A%20%20%20%20%20%20the%20member%20was%20altered%3A>
      //
      //  > For members that have changed (i.e., are new or have had their
      //  mapped resource modified), the DAV:response MUST contain at
      //  least one DAV:propstat element and MUST NOT contain any
      //  DAV:status element.

      //  > For members that have been removed, the DAV:response MUST
      //  contain one DAV:status with a value set to '404 Not Found' and
      //  MUST NOT contain any DAV:propstat element.
      //
      const pRes = await Promise.all(propActions);

      //
      // Construct the event URL for the response.
      //
      // The URL must match the original resource path that the client used when
      // creating the event. This is critical for sync-collection responses where
      // deleted events are reported with a 404 status - the client needs to match
      // the URL to its local cache to know which event to remove.
      //
      // Priority order:
      // 1. event.href - the original resource path (if stored by the data layer)
      // 2. Constructed from event.eventId - fallback for backwards compatibility
      //
      // See: https://www.rfc-editor.org/rfc/rfc6578.html (sync-collection)
      //
      const url = event.href || path.join(ctx.url, `${event.eventId}.ics`);
      const resp = event.deleted_at
        ? response(url, status[404], [], true)
        : response(url, status[200], _.compact(pRes));

      // TODO: misses is not used and this condition never occurs
      //       (artifact from old codebase)
      if (misses.length > 0) {
        resp['D:propstat'].push(missingPropstats(misses));
      }

      return resp;
    });
    const responses = await Promise.all(eventActions);
    return { responses };
  };
};
