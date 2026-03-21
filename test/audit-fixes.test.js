const test = require('ava');

// ============================================
// Shared mock factories
// ============================================

const createMockOptions = (overrides = {}) => ({
  data: {
    getCalendarId: (ctx, cal) => cal?.calendarId || 'test-calendar',
    buildICS: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
    getETag: (ctx, obj) =>
      `"etag-${obj?.eventId || obj?.calendarId || 'default'}"`,
    getCalendar: async () => ({
      calendarId: 'test-calendar',
      name: 'Test Calendar',
      synctoken: 'http://example.com/sync/1'
    }),
    getCalendarsForPrincipal: async () => [
      {
        calendarId: 'cal-1',
        name: 'Calendar 1',
        synctoken: 'http://example.com/sync/1'
      }
    ],
    getEventsForCalendar: async () => [],
    getEvent: async () => null,
    createCalendar: async (ctx, cal) => ({
      calendarId: cal.calendarId || 'new-cal',
      name: cal.name || 'New Calendar',
      synctoken: 'http://example.com/sync/1'
    }),
    updateCalendar: async (ctx, opts) => ({
      calendarId: opts.calendarId,
      name: opts.updates?.name || 'Updated Calendar',
      synctoken: 'http://example.com/sync/2'
    }),
    createEvent: async (ctx, opts) => ({
      eventId: opts.eventId,
      updated_at: new Date()
    }),
    updateEvent: async (ctx, opts) => ({
      eventId: opts.eventId,
      updated_at: new Date()
    }),
    async deleteEvent() {},
    async deleteCalendar() {},
    ...overrides.data
  },
  logEnabled: false,
  ...overrides
});

const createMockCtx = (overrides = {}) => {
  const headers = {};
  return {
    method: 'GET',
    url: '/cal/user@example.com/',
    path: '/cal/user@example.com/',
    status: 200,
    body: '',
    request: {
      body: '',
      type: 'text/calendar',
      xml: null
    },
    state: {
      user: {
        principalId: 'user@example.com',
        principalName: 'user@example.com',
        email: 'user@example.com'
      },
      params: {
        principalId: 'user@example.com',
        calendarId: null,
        eventId: null
      },
      calendarHomeUrl: '/cal/user@example.com/',
      principalUrl: '/p/user@example.com/',
      calendarUrl: '/cal/user@example.com/default/'
    },
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    remove(name) {
      delete headers[name.toLowerCase()];
    },
    accepts() {
      return true;
    },
    throw(status, msg) {
      const err = new Error(msg);
      err.status = status;
      throw err;
    },
    redirect(url) {
      this.status = 302;
      this.body = url;
    },
    ...overrides
  };
};

// ============================================
// well-known redirect should be 301
// ============================================

test('/.well-known/caldav returns 301 permanent redirect', async (t) => {
  const adapter = require('../index')({
    ...createMockOptions(),
    caldavRoot: '/',
    calendarRoot: 'cal',
    principalRoot: 'p',
    authenticate: async () => ({
      principalId: 'user@example.com',
      principalName: 'user@example.com'
    })
  });

  const headers = {};
  const ctx = {
    path: '/.well-known/caldav',
    url: '/.well-known/caldav',
    method: 'GET',
    status: 200,
    body: '',
    state: {},
    request: { body: '' },
    get() {
      return '';
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    redirect(url) {
      this.redirectUrl = url;
    }
  };

  await adapter(ctx, async () => {});

  t.is(ctx.status, 301);
});

// ============================================
// empty PROPFIND body treated as allprop
// ============================================

test('principal propfind with no XML body returns allprop', async (t) => {
  const options = createMockOptions();
  const propfind = require('../routes/principal/propfind')(options);

  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/p/user@example.com/',
    request: { xml: null }
  });

  const result = await propfind(ctx);

  t.truthy(result);
  // Should return XML with default properties
  t.true(result.includes('displayname'));
  t.true(result.includes('resourcetype'));
});

// ============================================
// MKCALENDAR with empty body
// ============================================

test('MKCALENDAR with no XML body creates calendar', async (t) => {
  let createdCalendar = null;
  const options = createMockOptions({
    data: {
      async createCalendar(ctx, cal) {
        createdCalendar = cal;
        return { calendarId: 'new-cal', name: 'New Calendar' };
      },
      getETag: () => '"etag-new"'
    }
  });
  const mkcalendar = require('../routes/principal/mkcalendar')(options);

  const headers = {};
  const ctx = createMockCtx({
    method: 'MKCALENDAR',
    url: '/cal/user@example.com/new-cal/',
    request: { xml: null },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'new-cal'
      }
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    }
  });

  await mkcalendar(ctx);

  t.is(ctx.status, 201);
  t.truthy(createdCalendar);
  t.is(createdCalendar.calendarId, 'new-cal');
});

// ============================================
// principal report null XML guard
// ============================================

test('principal report with null XML returns 400', async (t) => {
  const options = createMockOptions();
  const report = require('../routes/principal/report')(options);

  const ctx = createMockCtx({
    method: 'REPORT',
    url: '/p/user@example.com/',
    request: { xml: null }
  });

  await report(ctx);

  t.is(ctx.status, 400);
});

// ============================================
// inbox/outbox routing by calendarId
// ============================================

test('calendar named "inbox-tasks" is not routed to scheduling', async (t) => {
  const options = createMockOptions({
    data: {
      getCalendar: async () => ({
        calendarId: 'inbox-tasks',
        name: 'Inbox Tasks',
        synctoken: 'http://example.com/sync/1'
      }),
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarRouter = require('../routes/calendar/calendar')(options);

  const ctx = createMockCtx({
    method: 'OPTIONS',
    url: '/cal/user@example.com/inbox-tasks/',
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'inbox-tasks'
      }
    },
    set() {}
  });

  await calendarRouter(ctx);

  // Should be treated as a regular calendar (200 OPTIONS), not scheduling
  t.is(ctx.status, 200);
});

test('exact "inbox" calendarId routes to scheduling', async (t) => {
  const options = createMockOptions({
    data: {
      getCalendar: async () => null
    }
  });

  const calendarRouter = require('../routes/calendar/calendar')(options);

  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/inbox/',
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'inbox'
      }
    },
    set() {}
  });

  await calendarRouter(ctx);

  t.is(ctx.status, 207);
  t.true(ctx.body.includes('schedule-inbox'));
});

// ============================================
// Depth:0 on user propfind skips calendar listing
// ============================================

test('user propfind with Depth:0 does not list calendars', async (t) => {
  let calendarsFetched = false;
  const { DOMParser } = require('@xmldom/xmldom');

  const options = createMockOptions({
    data: {
      async getCalendarsForPrincipal() {
        calendarsFetched = true;
        return [{ calendarId: 'cal-1', name: 'Cal 1', synctoken: 'tok' }];
      }
    }
  });

  const userPropfind = require('../routes/calendar/user/propfind')(options);

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:propfind xmlns:D="DAV:">
      <D:prop>
        <D:displayname />
        <D:resourcetype />
      </D:prop>
    </D:propfind>`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const headers = { depth: '0' };
  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/',
    request: { xml: doc },
    get(name) {
      return headers[name.toLowerCase()] || '';
    }
  });

  const result = await userPropfind.exec(ctx);

  t.false(calendarsFetched, 'Should not fetch calendars for Depth:0');
  t.truthy(result);
});

// ============================================
// PUT update returns 204 not 201
// ============================================

test('PUT update on existing event returns 204', async (t) => {
  const options = createMockOptions({
    data: {
      getEvent: async () => ({
        eventId: 'event-1',
        updated_at: new Date()
      }),
      updateEvent: async () => ({
        eventId: 'event-1',
        updated_at: new Date()
      }),
      getETag: () => '"etag-updated"'
    }
  });

  const put = require('../routes/calendar/calendar/put')(options);

  const headers = {};
  const ctx = createMockCtx({
    method: 'PUT',
    url: '/cal/user@example.com/test-calendar/event-1.ics',
    request: {
      body: 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:event-1\r\nEND:VEVENT\r\nEND:VCALENDAR',
      type: 'text/calendar'
    },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar',
        eventId: 'event-1'
      }
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    get() {
      return '';
    }
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await put.exec(ctx, calendar);

  t.is(ctx.status, 204);
  t.truthy(headers.etag);
});

test('PUT create new event returns 201', async (t) => {
  const options = createMockOptions({
    data: {
      getEvent: async () => null,
      createEvent: async () => ({
        eventId: 'new-event',
        updated_at: new Date()
      }),
      getETag: () => '"etag-new"'
    }
  });

  const put = require('../routes/calendar/calendar/put')(options);

  const headers = {};
  const ctx = createMockCtx({
    method: 'PUT',
    url: '/cal/user@example.com/test-calendar/new-event.ics',
    request: {
      body: 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:new-event\r\nEND:VEVENT\r\nEND:VCALENDAR',
      type: 'text/calendar'
    },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar',
        eventId: 'new-event'
      }
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    get() {
      return '';
    }
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await put.exec(ctx, calendar);

  t.is(ctx.status, 201);
});

// ============================================
// If-Match ETag validation
// ============================================

test('PUT with mismatched If-Match returns 412', async (t) => {
  const options = createMockOptions({
    data: {
      getEvent: async () => ({
        eventId: 'event-1',
        updated_at: new Date()
      }),
      getETag: () => '"current-etag"'
    }
  });

  const put = require('../routes/calendar/calendar/put')(options);

  const ctx = createMockCtx({
    method: 'PUT',
    url: '/cal/user@example.com/test-calendar/event-1.ics',
    request: {
      body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
      type: 'text/calendar'
    },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar',
        eventId: 'event-1'
      }
    },
    set() {},
    get(name) {
      if (name.toLowerCase() === 'if-match') return '"stale-etag"';
      if (name.toLowerCase() === 'if-none-match') return '';
      return '';
    }
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await put.exec(ctx, calendar);

  t.is(ctx.status, 412);
});

test('PUT with matching If-Match proceeds', async (t) => {
  const options = createMockOptions({
    data: {
      getEvent: async () => ({
        eventId: 'event-1',
        updated_at: new Date()
      }),
      updateEvent: async () => ({
        eventId: 'event-1',
        updated_at: new Date()
      }),
      getETag: () => '"current-etag"'
    }
  });

  const put = require('../routes/calendar/calendar/put')(options);

  const headers = {};
  const ctx = createMockCtx({
    method: 'PUT',
    url: '/cal/user@example.com/test-calendar/event-1.ics',
    request: {
      body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
      type: 'text/calendar'
    },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar',
        eventId: 'event-1'
      }
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    get(name) {
      if (name.toLowerCase() === 'if-match') return '"current-etag"';
      if (name.toLowerCase() === 'if-none-match') return '';
      return '';
    }
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await put.exec(ctx, calendar);

  t.is(ctx.status, 204);
});

// ============================================
// DELETE returns 204 with no body
// ============================================

test('DELETE event returns 204 with null body', async (t) => {
  const options = createMockOptions();
  const del = require('../routes/calendar/calendar/delete')(options);

  const ctx = createMockCtx({
    method: 'DELETE',
    url: '/cal/user@example.com/test-calendar/event-1.ics',
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar',
        eventId: 'event-1'
      }
    },
    set() {}
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await del.exec(ctx, calendar);

  t.is(ctx.status, 204);
  t.is(ctx.body, null);
});

// ============================================
// multiget handles .ics extension safely
// ============================================

test('multiget handles href without .ics extension', async (t) => {
  let requestedEventId = null;
  const { DOMParser } = require('@xmldom/xmldom');

  const options = createMockOptions({
    data: {
      async getEvent(ctx, opts) {
        requestedEventId = opts.eventId;
        return {
          eventId: opts.eventId,
          ical: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
          updated_at: new Date()
        };
      },
      buildICS: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
      getETag: () => '"etag-1"'
    }
  });

  const multiget = require('../routes/calendar/calendar/calendar-multiget')(
    options
  );

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <CAL:calendar-multiget xmlns:D="DAV:" xmlns:CAL="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
        <CAL:calendar-data />
      </D:prop>
      <D:href>/cal/user@example.com/test-calendar/event-no-ext</D:href>
    </CAL:calendar-multiget>`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const ctx = createMockCtx({
    method: 'REPORT',
    url: '/cal/user@example.com/test-calendar/',
    request: { xml: doc },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar'
      }
    }
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await multiget(ctx, calendar);

  // Should NOT have stripped 4 chars from the eventId
  t.is(requestedEventId, 'event-no-ext');
});

// ============================================
// sync-collection passes syncToken
// ============================================

test('sync-collection passes client sync-token to data layer', async (t) => {
  let receivedSyncToken = null;
  const { DOMParser } = require('@xmldom/xmldom');

  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedSyncToken = opts.syncToken;
        return [];
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const sync = require('../routes/calendar/calendar/sync-collection')(options);

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:sync-collection xmlns:D="DAV:" xmlns:CAL="urn:ietf:params:xml:ns:caldav">
      <D:sync-token>http://example.com/sync/5</D:sync-token>
      <D:prop>
        <D:getetag />
      </D:prop>
    </D:sync-collection>`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const ctx = createMockCtx({
    method: 'REPORT',
    url: '/cal/user@example.com/test-calendar/',
    request: { xml: doc },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar'
      }
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/10'
  };
  await sync(ctx, calendar);

  t.is(receivedSyncToken, 'http://example.com/sync/5');
});

test('sync-collection with empty sync-token passes null', async (t) => {
  let receivedSyncToken = 'not-null';
  const { DOMParser } = require('@xmldom/xmldom');

  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedSyncToken = opts.syncToken;
        return [];
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const sync = require('../routes/calendar/calendar/sync-collection')(options);

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:sync-collection xmlns:D="DAV:" xmlns:CAL="urn:ietf:params:xml:ns:caldav">
      <D:sync-token></D:sync-token>
      <D:prop>
        <D:getetag />
      </D:prop>
    </D:sync-collection>`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const ctx = createMockCtx({
    method: 'REPORT',
    url: '/cal/user@example.com/test-calendar/',
    request: { xml: doc },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar'
      }
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/10'
  };
  await sync(ctx, calendar);

  t.is(receivedSyncToken, null);
});

// ============================================
// ICS parsing handles folded lines
// ============================================

test('scheduling handles folded ATTENDEE lines', async (t) => {
  const sentMessages = [];
  const options = createMockOptions({
    data: {
      async sendSchedulingMessage(ctx, msg) {
        sentMessages.push(msg);
      }
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  // Folded line: ATTENDEE line wraps across two lines
  const itipRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:test-folded',
    'ORGANIZER:mailto:org@example.com',
    'ATTENDEE;CN=Long Name;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:',
    ' mailto:folded@example.com',
    'SUMMARY:Test',
    'DTSTART:20260115T100000Z',
    'DTEND:20260115T110000Z',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: itipRequest }
  });

  await scheduling.postOutbox(ctx);

  t.is(sentMessages.length, 1);
  t.is(sentMessages[0].attendee, 'folded@example.com');
});

// ============================================
// xml-encode module exists and works
// ============================================

test('xml-encode module properly encodes entities', (t) => {
  const { encodeXMLEntities } = require('../common/xml-encode');

  t.is(encodeXMLEntities('Hello & World'), 'Hello &amp; World');
  t.is(encodeXMLEntities('<script>'), '&lt;script&gt;');
  t.is(encodeXMLEntities('"quoted"'), '&quot;quoted&quot;');
  t.is(encodeXMLEntities("it's"), 'it&#39;s');
  t.is(encodeXMLEntities(null), null);
  t.is(encodeXMLEntities(undefined), undefined);
  t.is(encodeXMLEntities(42), 42);
});

// ============================================
// Depth:0 on calendar propfind skips events
// ============================================

test('calendar propfind with Depth:0 does not load events', async (t) => {
  let eventsFetched = false;
  const { DOMParser } = require('@xmldom/xmldom');

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        eventsFetched = true;
        return [];
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calPropfind = require('../routes/calendar/calendar/propfind')(options);

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:displayname />
        <D:resourcetype />
      </D:prop>
    </D:propfind>`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const headers = { depth: '0' };
  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/test-calendar/',
    request: { xml: doc },
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar'
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test Calendar',
    synctoken: 'http://example.com/sync/1'
  };
  const result = await calPropfind.exec(ctx, calendar);

  t.false(eventsFetched, 'Should not fetch events for Depth:0');
  t.truthy(result);
  t.true(result.includes('displayname'));
});

// ============================================
// unsupported report returns 403
// ============================================

test('unsupported REPORT type returns 403', async (t) => {
  const { DOMParser } = require('@xmldom/xmldom');

  const options = createMockOptions();
  const report = require('../routes/calendar/calendar/report')(options);

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:unsupported-report xmlns:D="DAV:">
      <D:prop><D:displayname /></D:prop>
    </D:unsupported-report>`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const ctx = createMockCtx({
    method: 'REPORT',
    url: '/cal/user@example.com/test-calendar/',
    request: { xml: doc }
  });

  const calendar = { calendarId: 'test-calendar', name: 'Test' };
  await report.exec(ctx, calendar);

  t.is(ctx.status, 403);
});

// ============================================
// calendar object passed via ctx.state
// ============================================

test('calendar router sets ctx.state.calendar', async (t) => {
  const mockCalendar = {
    calendarId: 'test-calendar',
    name: 'Test Calendar',
    synctoken: 'http://example.com/sync/1'
  };
  const options = createMockOptions({
    data: {
      getCalendar: async () => mockCalendar,
      getCalendarId: (ctx, cal) => cal.calendarId,
      getEventsForCalendar: async () => [],
      buildICS: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
      getETag: () => '"etag-1"'
    }
  });

  const calendarRouter = require('../routes/calendar/calendar')(options);

  const ctx = createMockCtx({
    method: 'GET',
    url: '/cal/user@example.com/test-calendar/',
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com',
        calendarId: 'test-calendar'
      },
      calendarHomeUrl: '/cal/user@example.com/'
    },
    set() {},
    remove() {},
    accepts() {
      return true;
    }
  });

  await calendarRouter(ctx);

  t.is(ctx.state.calendar, mockCalendar);
});
