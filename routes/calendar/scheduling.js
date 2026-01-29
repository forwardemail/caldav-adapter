/**
 * RFC 6638 Scheduling Extensions to CalDAV
 * Scheduling inbox/outbox routes handler
 *
 * @see https://tools.ietf.org/html/rfc6638
 */

const {
  build,
  buildTag,
  href,
  multistatus,
  response,
  status
} = require('../../common/x-build');
const { setMultistatusResponse, setOptions } = require('../../common/response');
const winston = require('../../common/winston');

const dav = 'DAV:';
const cal = 'urn:ietf:params:xml:ns:caldav';

module.exports = function (options) {
  const log = winston({ ...options, label: 'scheduling' });

  /**
   * Handle POST to scheduling outbox for iTIP and free-busy queries
   * POST /cal/:principalId/outbox/
   *
   * @see https://tools.ietf.org/html/rfc6638#section-3.2
   */
  async function postOutbox(ctx) {
    log.debug('POST outbox request', { url: ctx.url });

    const { body } = ctx.request;
    if (!body) {
      ctx.status = 400;
      ctx.body = 'Missing request body';
      return;
    }

    // Check if this is a free-busy query
    if (body.includes('VFREEBUSY') && body.includes('METHOD:REQUEST')) {
      return handleFreeBusyQuery(ctx, body);
    }

    // Handle iTIP scheduling request
    return handleItipRequest(ctx, body);
  }

  /**
   * Get free-busy data for a single attendee
   */
  async function getFreeBusyForAttendee(ctx, attendee) {
    let scheduleStatus = '2.0'; // Success
    let freeBusyData = '';

    try {
      freeBusyData =
        typeof options.data.getFreeBusy === 'function'
          ? await options.data.getFreeBusy(ctx, attendee)
          : generateEmptyFreeBusy(attendee);
    } catch (err) {
      log.warn('Error getting free-busy data', {
        attendee,
        error: err.message
      });
      scheduleStatus = '3.7'; // Invalid calendar user
    }

    return {
      [buildTag(cal, 'response')]: {
        [buildTag(cal, 'recipient')]: href(`mailto:${attendee}`),
        [buildTag(cal, 'request-status')]: scheduleStatus,
        [buildTag(cal, 'calendar-data')]: freeBusyData
      }
    };
  }

  /**
   * Handle free-busy query
   * @see https://tools.ietf.org/html/rfc6638#section-3.2.1
   */
  async function handleFreeBusyQuery(ctx, body) {
    log.debug('Processing free-busy query');

    // Extract attendees from the request
    const attendeeMatches =
      body.match(/attendee[^:]*:mailto:([^\r\n]+)/gi) || [];
    const attendees = attendeeMatches
      .map((match) => {
        const email = match.match(/mailto:([^\r\n]+)/i);
        return email ? email[1].toLowerCase() : null;
      })
      .filter(Boolean);

    if (attendees.length === 0) {
      ctx.status = 400;
      ctx.body = 'No attendees specified in free-busy query';
      return;
    }

    // Build schedule-response for each attendee (in parallel)
    const responses = await Promise.all(
      attendees.map((attendee) => getFreeBusyForAttendee(ctx, attendee))
    );

    setMultistatusResponse(ctx);
    ctx.body = build(
      multistatus([
        {
          [buildTag(cal, 'schedule-response')]: responses
        }
      ])
    );
  }

  /**
   * Send scheduling message to a single attendee
   */
  async function sendMessageToAttendee(ctx, method, attendee, icalData) {
    let scheduleStatus = '1.1'; // Pending - message queued for delivery

    try {
      if (typeof options.data.sendSchedulingMessage === 'function') {
        await options.data.sendSchedulingMessage(ctx, {
          method,
          attendee,
          icalData
        });
        scheduleStatus = '1.2'; // Delivered
      }
    } catch (err) {
      log.warn('Error sending scheduling message', {
        attendee,
        error: err.message
      });
      scheduleStatus = '5.1'; // Could not complete delivery
    }

    return {
      [buildTag(cal, 'response')]: {
        [buildTag(cal, 'recipient')]: href(`mailto:${attendee}`),
        [buildTag(cal, 'request-status')]: scheduleStatus
      }
    };
  }

  /**
   * Handle iTIP scheduling request (REQUEST, REPLY, CANCEL, etc.)
   * @see https://tools.ietf.org/html/rfc6638#section-3.2.2
   */
  async function handleItipRequest(ctx, body) {
    log.debug('Processing iTIP request');

    // Extract METHOD from the iCalendar data
    const methodMatch = body.match(/method:([a-z]+)/i);
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'REQUEST';

    // Extract attendees
    const attendeeMatches =
      body.match(/attendee[^:]*:mailto:([^\r\n]+)/gi) || [];
    const attendees = attendeeMatches
      .map((match) => {
        const email = match.match(/mailto:([^\r\n]+)/i);
        return email ? email[1].toLowerCase() : null;
      })
      .filter(Boolean);

    // Send messages in parallel
    const responses = await Promise.all(
      attendees.map((attendee) =>
        sendMessageToAttendee(ctx, method, attendee, body)
      )
    );

    setMultistatusResponse(ctx);
    ctx.body = build(
      multistatus([
        {
          [buildTag(cal, 'schedule-response')]: responses
        }
      ])
    );
  }

  /**
   * Handle PROPFIND on scheduling inbox
   * PROPFIND /cal/:principalId/inbox/
   *
   * @see https://tools.ietf.org/html/rfc6638#section-2.2
   */
  async function propfindInbox(ctx) {
    log.debug('PROPFIND inbox request', { url: ctx.url });

    const props = [
      {
        [buildTag(dav, 'resourcetype')]: {
          [buildTag(dav, 'collection')]: '',
          [buildTag(cal, 'schedule-inbox')]: ''
        }
      },
      { [buildTag(dav, 'displayname')]: 'Schedule Inbox' },
      { [buildTag(cal, 'calendar-free-busy-set')]: '' },
      {
        [buildTag(dav, 'current-user-privilege-set')]: {
          [buildTag(dav, 'privilege')]: [
            { [buildTag(dav, 'read')]: '' },
            { [buildTag(cal, 'schedule-deliver')]: '' }
          ]
        }
      }
    ];

    setMultistatusResponse(ctx);
    ctx.body = build(multistatus([response(ctx.url, status[200], props)]));
  }

  /**
   * Handle GET on scheduling inboxbox - list scheduling messages
   * GET /cal/:principalId/inbox/
   *
   * @see https://tools.ietf.org/html/rfc6638#section-2.2
   */
  async function getInbox(ctx) {
    log.debug('GET inbox request', { url: ctx.url });

    // Return empty collection by default
    // Implementations can override via options.data.getSchedulingMessages
    let messages = [];

    try {
      if (typeof options.data.getSchedulingMessages === 'function') {
        messages = await options.data.getSchedulingMessages(ctx);
      }
    } catch (err) {
      log.warn('Error getting scheduling messages', { error: err.message });
    }

    const responses = messages.map((msg) => {
      return response(msg.href, status[200], [
        { [buildTag(dav, 'getetag')]: msg.etag },
        { [buildTag(dav, 'getcontenttype')]: 'text/calendar; charset=utf-8' },
        { [buildTag(cal, 'calendar-data')]: msg.icalData }
      ]);
    });

    // Add collection response
    responses.unshift(
      response(ctx.url, status[200], [
        {
          [buildTag(dav, 'resourcetype')]: {
            [buildTag(dav, 'collection')]: '',
            [buildTag(cal, 'schedule-inbox')]: ''
          }
        }
      ])
    );

    setMultistatusResponse(ctx);
    ctx.body = build(multistatus(responses));
  }

  /**
   * Handle PROPFIND on scheduling outbox
   * PROPFIND /cal/:principalId/outbox/
   *
   * @see https://tools.ietf.org/html/rfc6638#section-2.1
   */
  async function propfindOutbox(ctx) {
    log.debug('PROPFIND outbox request', { url: ctx.url });

    const props = [
      {
        [buildTag(dav, 'resourcetype')]: {
          [buildTag(dav, 'collection')]: '',
          [buildTag(cal, 'schedule-outbox')]: ''
        }
      },
      { [buildTag(dav, 'displayname')]: 'Schedule Outbox' },
      {
        [buildTag(dav, 'current-user-privilege-set')]: {
          [buildTag(dav, 'privilege')]: [
            { [buildTag(dav, 'read')]: '' },
            { [buildTag(cal, 'schedule-send')]: '' }
          ]
        }
      }
    ];

    setMultistatusResponse(ctx);
    ctx.body = build(multistatus([response(ctx.url, status[200], props)]));
  }

  /**
   * Generate empty VFREEBUSY response
   */
  function generateEmptyFreeBusy(attendee) {
    const now = new Date();
    const dtstamp = now
      .toISOString()
      .replaceAll(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const uid = `freebusy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Forward Email//CalDAV Adapter//EN',
      'METHOD:REPLY',
      'BEGIN:VFREEBUSY',
      `DTSTAMP:${dtstamp}`,
      `UID:${uid}`,
      `ATTENDEE:mailto:${attendee}`,
      'END:VFREEBUSY',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  return {
    postOutbox,
    propfindInbox,
    getInbox,
    propfindOutbox,

    /**
     * Route handler for scheduling endpoints
     */
    async route(ctx) {
      const method = ctx.method.toLowerCase();
      const url = ctx.url.toLowerCase();

      // Determine if this is inbox or outbox
      const isInbox = url.includes('/inbox');
      const isOutbox = url.includes('/outbox');

      if (method === 'options') {
        if (isOutbox) {
          setOptions(ctx, ['OPTIONS', 'POST', 'PROPFIND']);
        } else if (isInbox) {
          setOptions(ctx, ['OPTIONS', 'GET', 'PROPFIND', 'DELETE']);
        }

        return;
      }

      if (isOutbox) {
        if (method === 'post') {
          return postOutbox(ctx);
        }

        if (method === 'propfind') {
          return propfindOutbox(ctx);
        }
      }

      if (isInbox) {
        if (method === 'get') {
          return getInbox(ctx);
        }

        if (method === 'propfind') {
          return propfindInbox(ctx);
        }
      }

      ctx.status = 405;
      ctx.body = 'Method Not Allowed';
    }
  };
};
