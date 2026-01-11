const test = require('ava');
const eventResponseFactory = require('../routes/calendar/calendar/event-response');

// Mock options with minimal required data functions
function createMockOptions() {
  return {
    data: {
      getCalendarId: () => 'test-calendar-id',
      buildICS: () => 'BEGIN:VCALENDAR\nEND:VCALENDAR',
      getETag: () => '"test-etag"'
    }
  };
}

// Mock context
function createMockCtx(url = '/cal/user/calendar') {
  return {
    url,
    state: {
      params: {
        principalId: 'user',
        calendarId: 'calendar'
      }
    }
  };
}

// Mock calendar
function createMockCalendar() {
  return {
    _id: 'calendar-id',
    name: 'Test Calendar',
    synctoken: 'http://example.com/sync/1'
  };
}

test('event-response exports a function', (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  t.is(typeof eventResponse, 'function');
});

test('event-response uses eventId to construct URL when href is not available', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  const events = [
    {
      eventId: 'test-event-123',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  // Empty children array - we just want to test URL construction
  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  // Check that the response contains the correct URL
  const responseObj = result.responses[0];
  t.truthy(responseObj['D:href']);
  t.is(responseObj['D:href'], '/cal/user/calendar/test-event-123.ics');
});

test('event-response uses event.href when available instead of constructing from eventId', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Event with href property (original resource path)
  const events = [
    {
      eventId: 'modified_event_id',
      href: '/cal/user/calendar/original@event.ics',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  // Check that the response uses href, not eventId
  const responseObj = result.responses[0];
  t.truthy(responseObj['D:href']);
  t.is(responseObj['D:href'], '/cal/user/calendar/original@event.ics');
});

test('event-response returns 404 status for deleted events', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  const events = [
    {
      eventId: 'deleted-event',
      deleted_at: new Date(),
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  const responseObj = result.responses[0];
  t.truthy(responseObj['D:href']);
  t.is(responseObj['D:href'], '/cal/user/calendar/deleted-event.ics');

  // Check for 404 status
  t.truthy(responseObj['D:status']);
  t.true(responseObj['D:status'].includes('404'));
});

test('event-response returns 404 for deleted events without href using fallback URL', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Deleted event WITHOUT href - should use fallback URL construction
  // This is critical for backwards compatibility with events created
  // before the href field was added
  const events = [
    {
      eventId: 'deleted-event-no-href',
      deleted_at: new Date(),
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  // Should NOT be skipped - fallback URL construction works for backwards compatibility
  t.is(result.responses.length, 1);

  const responseObj = result.responses[0];
  t.is(responseObj['D:href'], '/cal/user/calendar/deleted-event-no-href.ics');
  t.truthy(responseObj['D:status']);
  t.true(responseObj['D:status'].includes('404'));
});

test('event-response uses href for deleted events when available (critical for sync)', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Deleted event with href - simulates the case where eventId was modified
  // (e.g., @ replaced with _) but we stored the original href
  const events = [
    {
      eventId: 'event123_example.com',
      href: '/cal/user/calendar/event123@example.com.ics',
      deleted_at: new Date(),
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  const responseObj = result.responses[0];
  // Should use href, not eventId
  t.is(responseObj['D:href'], '/cal/user/calendar/event123@example.com.ics');
  t.truthy(responseObj['D:status']);
  t.true(responseObj['D:status'].includes('404'));
});

test('event-response returns 200 status for non-deleted events', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  const events = [
    {
      eventId: 'active-event',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  const responseObj = result.responses[0];
  // Non-deleted events should have propstat, not status
  t.truthy(responseObj['D:propstat']);
});

test('event-response handles multiple events correctly', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  const events = [
    {
      eventId: 'event1',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    },
    {
      eventId: 'event2',
      href: '/cal/user/calendar/custom-path.ics',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    },
    {
      eventId: 'event3',
      deleted_at: new Date(),
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 3);

  // Event 1: uses eventId
  t.is(result.responses[0]['D:href'], '/cal/user/calendar/event1.ics');

  // Event 2: uses href
  t.is(result.responses[1]['D:href'], '/cal/user/calendar/custom-path.ics');

  // Event 3: deleted, uses eventId (no href) - fallback URL construction
  t.is(result.responses[2]['D:href'], '/cal/user/calendar/event3.ics');
  t.true(result.responses[2]['D:status'].includes('404'));
});

test('event-response handles multiple events with mixed deleted states', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Mix of events: active, deleted with href, deleted without href
  const events = [
    {
      eventId: 'active-event',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    },
    {
      eventId: 'deleted-with-href',
      href: '/cal/user/calendar/deleted-with-href.ics',
      deleted_at: new Date(),
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    },
    {
      eventId: 'deleted-no-href',
      deleted_at: new Date(),
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  // All 3 responses - deleted without href is NO LONGER skipped
  t.is(result.responses.length, 3);

  // Active event
  t.is(result.responses[0]['D:href'], '/cal/user/calendar/active-event.ics');

  // Deleted event with href
  t.is(
    result.responses[1]['D:href'],
    '/cal/user/calendar/deleted-with-href.ics'
  );
  t.true(result.responses[1]['D:status'].includes('404'));

  // Deleted event without href - uses fallback URL construction
  t.is(result.responses[2]['D:href'], '/cal/user/calendar/deleted-no-href.ics');
  t.true(result.responses[2]['D:status'].includes('404'));
});

test('event-response handles email-like eventId with @ symbol', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Event with email-like eventId (contains @)
  const events = [
    {
      eventId: 'meeting@company.com',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  // Should preserve the @ in the URL
  t.is(
    result.responses[0]['D:href'],
    '/cal/user/calendar/meeting@company.com.ics'
  );
});

test('event-response handles special characters in eventId', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Event with special characters in eventId
  const events = [
    {
      eventId: 'event-with-special_chars.123',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  t.is(
    result.responses[0]['D:href'],
    '/cal/user/calendar/event-with-special_chars.123.ics'
  );
});

test('backwards compatibility: events without href use eventId', async (t) => {
  const options = createMockOptions();
  const eventResponse = eventResponseFactory(options);
  const ctx = createMockCtx('/cal/user/calendar');
  const calendar = createMockCalendar();

  // Simulate existing event without href field (backwards compatibility)
  const events = [
    {
      eventId: 'legacy-event-id',
      ical: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
      // No href field - simulates existing events before this fix
    }
  ];

  const children = [];

  const result = await eventResponse(ctx, events, calendar, children);

  t.truthy(result.responses);
  t.is(result.responses.length, 1);

  // Should fall back to constructing URL from eventId
  t.is(result.responses[0]['D:href'], '/cal/user/calendar/legacy-event-id.ics');
});
