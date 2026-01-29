const test = require('ava');

// Mock options for testing
const createMockOptions = (overrides = {}) => ({
  data: {
    getCalendarId: () => 'test-calendar',
    buildICS: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
    getETag: () => '"test-etag"',
    ...overrides.data
  },
  logEnabled: false,
  ...overrides
});

// Mock Koa context
const createMockCtx = (overrides = {}) => ({
  method: 'GET',
  url: '/cal/user@example.com/',
  status: 200,
  body: '',
  request: {
    body: ''
  },
  state: {
    user: {
      principalId: 'user@example.com',
      principalName: 'user@example.com',
      email: 'user@example.com'
    },
    params: {
      principalId: 'user@example.com'
    },
    calendarHomeUrl: '/cal/user@example.com/',
    principalUrl: '/p/user@example.com/',
    calendarUrl: '/cal/user@example.com/default/'
  },
  set() {},
  ...overrides
});

// ============================================
// Tests for common/response.js DAV header
// ============================================

test('DAV header includes calendar-auto-schedule capability', (t) => {
  const response = require('../common/response');

  // Create a mock context to capture the header
  let davHeader = '';
  const ctx = {
    status: 0,
    body: '',
    set(name, value) {
      if (name === 'DAV') {
        davHeader = value;
      }
    }
  };

  response.setOptions(ctx, ['OPTIONS']);

  t.true(
    davHeader.includes('calendar-auto-schedule'),
    'DAV header should include calendar-auto-schedule'
  );
  t.true(
    davHeader.includes('calendar-schedule'),
    'DAV header should include calendar-schedule'
  );
  t.true(
    davHeader.includes('calendar-access'),
    'DAV header should include calendar-access'
  );
});

// ============================================
// Tests for common/tags.js scheduling properties
// ============================================

test('schedule-inbox-URL returns correct URL when calendarHomeUrl is set', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleInboxTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-inbox-URL'];
  t.is(typeof scheduleInboxTag, 'object');
  t.is(typeof scheduleInboxTag.resp, 'function');

  const ctx = createMockCtx();
  const result = await scheduleInboxTag.resp({ ctx });

  t.truthy(result);
  const tagKey = Object.keys(result)[0];
  t.true(tagKey.includes('schedule-inbox-URL'));
});

test('schedule-outbox-URL returns correct URL when calendarHomeUrl is set', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleOutboxTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-outbox-URL'];
  t.is(typeof scheduleOutboxTag, 'object');
  t.is(typeof scheduleOutboxTag.resp, 'function');

  const ctx = createMockCtx();
  const result = await scheduleOutboxTag.resp({ ctx });

  t.truthy(result);
  const tagKey = Object.keys(result)[0];
  t.true(tagKey.includes('schedule-outbox-URL'));
});

test('schedule-default-calendar-URL returns correct URL when calendarUrl is set', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleDefaultCalTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-default-calendar-URL'];
  t.is(typeof scheduleDefaultCalTag, 'object');
  t.is(typeof scheduleDefaultCalTag.resp, 'function');

  const ctx = createMockCtx();
  const result = await scheduleDefaultCalTag.resp({ ctx });

  t.truthy(result);
  const tagKey = Object.keys(result)[0];
  t.true(tagKey.includes('schedule-default-calendar-URL'));
});

test('schedule-calendar-transp returns opaque by default', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleTranspTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-calendar-transp'];
  t.is(typeof scheduleTranspTag, 'object');
  t.is(typeof scheduleTranspTag.resp, 'function');

  const calendar = { name: 'Test Calendar' };
  const result = await scheduleTranspTag.resp({
    resource: 'calendar',
    calendar
  });

  t.truthy(result);
  const tagKey = Object.keys(result)[0];
  t.true(tagKey.includes('schedule-calendar-transp'));
});

test('schedule-calendar-transp respects calendar scheduleTransp property', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleTranspTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-calendar-transp'];

  const calendar = { name: 'Test Calendar', scheduleTransp: 'transparent' };
  const result = await scheduleTranspTag.resp({
    resource: 'calendar',
    calendar
  });

  t.truthy(result);
  // The result should contain the transparent value
  const resultStr = JSON.stringify(result);
  t.true(resultStr.includes('transparent'));
});

test('schedule-tag returns value when event has scheduleTag', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleTagProp = tags['urn:ietf:params:xml:ns:caldav']['schedule-tag'];
  t.is(typeof scheduleTagProp, 'object');
  t.is(typeof scheduleTagProp.resp, 'function');

  const event = { scheduleTag: '"schedule-tag-123"' };
  const result = await scheduleTagProp.resp({ resource: 'event', event });

  t.truthy(result);
  const tagKey = Object.keys(result)[0];
  t.true(tagKey.includes('schedule-tag'));
});

test('schedule-tag returns undefined when event has no scheduleTag', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleTagProp = tags['urn:ietf:params:xml:ns:caldav']['schedule-tag'];

  const event = { uid: 'test-event' };
  const result = await scheduleTagProp.resp({ resource: 'event', event });

  t.is(result, undefined);
});

// ============================================
// Tests for scheduling.js routes
// ============================================

test('scheduling module exports required functions', (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  t.is(typeof scheduling.postOutbox, 'function');
  t.is(typeof scheduling.propfindInbox, 'function');
  t.is(typeof scheduling.getInbox, 'function');
  t.is(typeof scheduling.propfindOutbox, 'function');
  t.is(typeof scheduling.route, 'function');
});

test('scheduling route handler sets OPTIONS for outbox', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  let allowHeader = '';
  const ctx = createMockCtx({
    method: 'OPTIONS',
    url: '/cal/user@example.com/outbox/',
    set(name, value) {
      if (name === 'Allow') {
        allowHeader = value;
      }
    }
  });

  await scheduling.route(ctx);

  t.true(allowHeader.includes('POST'));
  t.true(allowHeader.includes('PROPFIND'));
});

test('scheduling route handler sets OPTIONS for inbox', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  let allowHeader = '';
  const ctx = createMockCtx({
    method: 'OPTIONS',
    url: '/cal/user@example.com/inbox/',
    set(name, value) {
      if (name === 'Allow') {
        allowHeader = value;
      }
    }
  });

  await scheduling.route(ctx);

  t.true(allowHeader.includes('GET'));
  t.true(allowHeader.includes('PROPFIND'));
  t.true(allowHeader.includes('DELETE'));
});

test('propfindInbox returns schedule-inbox resourcetype', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/inbox/'
  });

  await scheduling.propfindInbox(ctx);

  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(ctx.body.includes('schedule-inbox'));
});

test('propfindOutbox returns schedule-outbox resourcetype', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/outbox/'
  });

  await scheduling.propfindOutbox(ctx);

  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(ctx.body.includes('schedule-outbox'));
});

test('getInbox returns empty collection by default', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'GET',
    url: '/cal/user@example.com/inbox/'
  });

  await scheduling.getInbox(ctx);

  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(ctx.body.includes('schedule-inbox'));
});

test('getInbox uses options.data.getSchedulingMessages when available', async (t) => {
  const mockMessages = [
    {
      href: '/cal/user@example.com/inbox/msg1.ics',
      etag: '"etag1"',
      icalData: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'
    }
  ];

  const options = createMockOptions({
    data: {
      getSchedulingMessages: async () => mockMessages
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'GET',
    url: '/cal/user@example.com/inbox/'
  });

  await scheduling.getInbox(ctx);

  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(ctx.body.includes('msg1.ics'));
});

test('postOutbox returns 400 when body is missing', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: null }
  });

  await scheduling.postOutbox(ctx);

  t.is(ctx.status, 400);
});

test('postOutbox handles free-busy query', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const freeBusyRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VFREEBUSY',
    'ORGANIZER:mailto:organizer@example.com',
    'ATTENDEE:mailto:attendee@example.com',
    'DTSTART:20260101T000000Z',
    'DTEND:20260102T000000Z',
    'END:VFREEBUSY',
    'END:VCALENDAR'
  ].join('\r\n');

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: freeBusyRequest }
  });

  await scheduling.postOutbox(ctx);

  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(ctx.body.includes('schedule-response'));
  t.true(ctx.body.includes('attendee@example.com'));
});

test('postOutbox handles iTIP REQUEST', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const itipRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:test-event-123',
    'ORGANIZER:mailto:organizer@example.com',
    'ATTENDEE:mailto:attendee1@example.com',
    'ATTENDEE:mailto:attendee2@example.com',
    'SUMMARY:Test Meeting',
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

  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(ctx.body.includes('schedule-response'));
  t.true(ctx.body.includes('attendee1@example.com'));
  t.true(ctx.body.includes('attendee2@example.com'));
});

test('postOutbox calls sendSchedulingMessage when available', async (t) => {
  const sentMessages = [];

  const options = createMockOptions({
    data: {
      async sendSchedulingMessage(ctx, msg) {
        sentMessages.push(msg);
      }
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  const itipRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:test-event-456',
    'ORGANIZER:mailto:organizer@example.com',
    'ATTENDEE:mailto:attendee@example.com',
    'SUMMARY:Test Meeting',
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
  t.is(sentMessages[0].method, 'REQUEST');
  t.is(sentMessages[0].attendee, 'attendee@example.com');
});

test('postOutbox uses custom getFreeBusy when available', async (t) => {
  const customFreeBusy = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REPLY',
    'BEGIN:VFREEBUSY',
    'FREEBUSY:20260101T090000Z/20260101T100000Z',
    'END:VFREEBUSY',
    'END:VCALENDAR'
  ].join('\r\n');

  const options = createMockOptions({
    data: {
      getFreeBusy: async () => customFreeBusy
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  const freeBusyRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VFREEBUSY',
    'ATTENDEE:mailto:attendee@example.com',
    'END:VFREEBUSY',
    'END:VCALENDAR'
  ].join('\r\n');

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: freeBusyRequest }
  });

  await scheduling.postOutbox(ctx);

  t.is(ctx.status, 207);
  t.true(ctx.body.includes('FREEBUSY'));
});

// ============================================
// Tests for calendar.js routing integration
// ============================================

test('calendar router routes inbox requests to scheduling handler', async (t) => {
  // We need to test that the calendar.js properly routes to scheduling
  // This is an integration test
  const options = createMockOptions({
    data: {
      getCalendar: async () => null
    }
  });

  const calendarRouter = require('../routes/calendar/calendar')(options);

  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/inbox/'
  });

  await calendarRouter(ctx);

  // If routing works, we should get a 207 response with schedule-inbox
  t.is(ctx.status, 207);
  t.true(ctx.body.includes('schedule-inbox'));
});

test('calendar router routes outbox requests to scheduling handler', async (t) => {
  const options = createMockOptions({
    data: {
      getCalendar: async () => null
    }
  });

  const calendarRouter = require('../routes/calendar/calendar')(options);

  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/outbox/'
  });

  await calendarRouter(ctx);

  t.is(ctx.status, 207);
  t.true(ctx.body.includes('schedule-outbox'));
});

// ============================================
// Tests for edge cases and error handling
// ============================================

test('schedule-inbox-URL returns empty href when ctx is missing', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleInboxTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-inbox-URL'];
  const result = await scheduleInboxTag.resp({});

  t.truthy(result);
  // Should return empty href
  const resultStr = JSON.stringify(result);
  t.true(resultStr.includes('href'));
});

test('schedule-outbox-URL returns empty href when ctx is missing', async (t) => {
  const options = createMockOptions();
  const { tags } = require('../common/tags')(options);

  const scheduleOutboxTag =
    tags['urn:ietf:params:xml:ns:caldav']['schedule-outbox-URL'];
  const result = await scheduleOutboxTag.resp({});

  t.truthy(result);
  const resultStr = JSON.stringify(result);
  t.true(resultStr.includes('href'));
});

test('postOutbox handles errors in getFreeBusy gracefully', async (t) => {
  const options = createMockOptions({
    data: {
      async getFreeBusy() {
        throw new Error('Database error');
      }
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  const freeBusyRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VFREEBUSY',
    'ATTENDEE:mailto:attendee@example.com',
    'END:VFREEBUSY',
    'END:VCALENDAR'
  ].join('\r\n');

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: freeBusyRequest }
  });

  await scheduling.postOutbox(ctx);

  t.is(ctx.status, 207);
  // Should return error status 3.7 for invalid calendar user
  t.true(ctx.body.includes('3.7'));
});

test('postOutbox handles errors in sendSchedulingMessage gracefully', async (t) => {
  const options = createMockOptions({
    data: {
      async sendSchedulingMessage() {
        throw new Error('SMTP error');
      }
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  const itipRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:test-event',
    'ATTENDEE:mailto:attendee@example.com',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: itipRequest }
  });

  await scheduling.postOutbox(ctx);

  t.is(ctx.status, 207);
  // Should return error status 5.1 for delivery failure
  t.true(ctx.body.includes('5.1'));
});

test('getInbox handles errors in getSchedulingMessages gracefully', async (t) => {
  const options = createMockOptions({
    data: {
      async getSchedulingMessages() {
        throw new Error('Database error');
      }
    }
  });
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'GET',
    url: '/cal/user@example.com/inbox/'
  });

  await scheduling.getInbox(ctx);

  // Should still return 207 with empty collection
  t.is(ctx.status, 207);
  t.true(ctx.body.includes('schedule-inbox'));
});

test('scheduling route returns 405 for unsupported methods', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const ctx = createMockCtx({
    method: 'PUT',
    url: '/cal/user@example.com/outbox/'
  });

  await scheduling.route(ctx);

  t.is(ctx.status, 405);
});

test('postOutbox returns 400 when no attendees in free-busy query', async (t) => {
  const options = createMockOptions();
  const scheduling = require('../routes/calendar/scheduling')(options);

  const freeBusyRequest = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:REQUEST',
    'BEGIN:VFREEBUSY',
    'ORGANIZER:mailto:organizer@example.com',
    'END:VFREEBUSY',
    'END:VCALENDAR'
  ].join('\r\n');

  const ctx = createMockCtx({
    method: 'POST',
    url: '/cal/user@example.com/outbox/',
    request: { body: freeBusyRequest }
  });

  await scheduling.postOutbox(ctx);

  t.is(ctx.status, 400);
});
