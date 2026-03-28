const test = require('ava');
const { DOMParser } = require('@xmldom/xmldom');

// ============================================
// Shared mock factories (same pattern as rfc-compliance.test.js)
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
    getEventsByDate: async () => [],
    getEvent: async () => null,
    createCalendar: async (ctx, cal) => ({
      calendarId: cal.calendarId || 'new-cal',
      ...cal
    }),
    updateCalendar: async (ctx, cal) => cal,
    ...overrides.data
  }
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
// Sample ICS data for testing
// ============================================
const VTODO_COMPLETED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-completed-1',
  'SUMMARY:Buy groceries',
  'STATUS:COMPLETED',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VTODO_NEEDS_ACTION = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-active-1',
  'SUMMARY:Clean house',
  'STATUS:NEEDS-ACTION',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VTODO_IN_PROCESS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-inprocess-1',
  'SUMMARY:Write report',
  'STATUS:IN-PROCESS',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VTODO_NO_STATUS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-nostatus-1',
  'SUMMARY:Something without status',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VTODO_CANCELLED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-cancelled-1',
  'SUMMARY:Cancelled task',
  'STATUS:CANCELLED',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VTODO_WITH_CATEGORIES = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-cat-1',
  'SUMMARY:Work task',
  'STATUS:NEEDS-ACTION',
  'CATEGORIES:WORK,IMPORTANT',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VTODO_FOLDED_STATUS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTODO',
  'UID:todo-folded-1',
  'SUMMARY:Folded status test',
  'STATUS:COMPL',
  ' ETED',
  'END:VTODO',
  'END:VCALENDAR'
].join('\r\n');

const VEVENT_CONFIRMED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:event-1',
  'SUMMARY:Team meeting',
  'STATUS:CONFIRMED',
  'DTSTART:20260401T100000Z',
  'DTEND:20260401T110000Z',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

// ============================================
// Helper to build mock events
// ============================================
function mockEvent(eventId, ical) {
  return { eventId, ical };
}

// ============================================
// Tests: prop-filter with text-match negate-condition="yes"
// (iOS Reminders: exclude completed VTODOs)
// ============================================

test('prop-filter: text-match negate-condition="yes" excludes completed VTODOs', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION),
    mockEvent('todo-inprocess-1', VTODO_IN_PROCESS),
    mockEvent('todo-cancelled-1', VTODO_CANCELLED)
  ];

  let receivedFullData = null;
  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedFullData = opts.fullData;
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match negate-condition="yes">COMPLETED</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);

  // Should request fullData=true even if client only asked for getetag,
  // because we need ICS data to evaluate prop-filter
  t.is(
    receivedFullData,
    true,
    'Should request fullData when prop-filter is present'
  );

  // Should exclude the COMPLETED todo, keep NEEDS-ACTION, IN-PROCESS, CANCELLED
  t.is(result.responses.length, 3, 'Should return 3 non-completed VTODOs');

  const returnedIds = result.responses.map((r) => {
    const href = r['D:href'];
    return href;
  });
  // Verify completed todo is NOT in the results
  const hasCompleted = returnedIds.some((href) =>
    href.includes('todo-completed-1')
  );
  t.false(hasCompleted, 'Should not include completed VTODO');
});

test('prop-filter: text-match negate-condition="yes" also excludes VTODOs without the property', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION),
    mockEvent('todo-nostatus-1', VTODO_NO_STATUS)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
        <C:calendar-data />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match negate-condition="yes">COMPLETED</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);

  // Per RFC 4791: text-match requires the property to exist.
  // VTODOs without STATUS fail the prop-filter (no value to negate against).
  // So only NEEDS-ACTION should match.
  t.is(
    result.responses.length,
    1,
    'Should return only VTODOs with STATUS != COMPLETED'
  );
});

test('prop-filter: text-match without negate-condition matches substring', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION),
    mockEvent('todo-inprocess-1', VTODO_IN_PROCESS)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // Match VTODOs where STATUS contains "NEEDS"
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match>NEEDS</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  t.is(result.responses.length, 1, 'Should return only the NEEDS-ACTION VTODO');
});

test('prop-filter: text-match is case-insensitive by default (i;ascii-casemap)', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // Use lowercase "completed" — should still match STATUS:COMPLETED
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match>completed</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  t.is(result.responses.length, 1, 'Should match case-insensitively');
});

test('prop-filter: is-not-defined matches VTODOs without the property', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-nostatus-1', VTODO_NO_STATUS),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:is-not-defined />
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  t.is(result.responses.length, 1, 'Should return only VTODOs without STATUS');
});

test('prop-filter: empty prop-filter matches VTODOs that have the property', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-nostatus-1', VTODO_NO_STATUS),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // Empty prop-filter: property must exist (any value)
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS" />
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  // COMPLETED and NEEDS-ACTION have STATUS, NO_STATUS does not
  t.is(
    result.responses.length,
    2,
    'Should return VTODOs that have STATUS property'
  );
});

test('prop-filter: multiple prop-filters are ANDed together', async (t) => {
  const allEvents = [
    mockEvent('todo-cat-1', VTODO_WITH_CATEGORIES),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION),
    mockEvent('todo-completed-1', VTODO_COMPLETED)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // Two prop-filters: STATUS must contain "NEEDS" AND CATEGORIES must exist
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match>NEEDS</C:text-match>
            </C:prop-filter>
            <C:prop-filter name="CATEGORIES" />
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  // Only VTODO_WITH_CATEGORIES has both STATUS:NEEDS-ACTION and CATEGORIES
  t.is(
    result.responses.length,
    1,
    'Should return only VTODOs matching ALL prop-filters'
  );
});

test('prop-filter: handles folded ICS lines correctly', async (t) => {
  const allEvents = [
    mockEvent('todo-folded-1', VTODO_FOLDED_STATUS),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // Exclude COMPLETED — the folded status should be unfolded to "COMPLETED"
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match negate-condition="yes">COMPLETED</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  // The folded VTODO has STATUS:COMPLETED (unfolded), so it should be excluded
  t.is(
    result.responses.length,
    1,
    'Should correctly unfold and filter folded ICS lines'
  );
});

test('prop-filter: no prop-filter returns all events (backward compatibility)', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION),
    mockEvent('todo-nostatus-1', VTODO_NO_STATUS)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // No prop-filter — just a bare VTODO comp-filter
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO"/>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  t.is(
    result.responses.length,
    3,
    'Should return all VTODOs when no prop-filter'
  );
});

test('prop-filter: works with time-range queries too', async (t) => {
  const allEvents = [
    mockEvent('todo-completed-1', VTODO_COMPLETED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION)
  ];

  let receivedFullData = null;
  const options = createMockOptions({
    data: {
      async getEventsByDate(ctx, opts) {
        receivedFullData = opts.fullData;
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  // VTODO with time-range AND prop-filter
  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:time-range start="20260101T000000Z" end="20261231T235959Z"/>
            <C:prop-filter name="STATUS">
              <C:text-match negate-condition="yes">COMPLETED</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  t.is(
    receivedFullData,
    true,
    'Should request fullData when prop-filter is present with time-range'
  );
  t.is(
    result.responses.length,
    1,
    'Should filter completed VTODOs even with time-range'
  );
});

test('prop-filter: events without ical data pass through (etag-only responses)', async (t) => {
  const allEvents = [{ eventId: 'todo-1' }, { eventId: 'todo-2' }];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VTODO">
            <C:prop-filter name="STATUS">
              <C:text-match negate-condition="yes">COMPLETED</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Tasks',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  // Events without ical data should pass through the filter
  t.is(
    result.responses.length,
    2,
    'Events without ICS data should pass through prop-filter'
  );
});

test('prop-filter: VEVENT prop-filter works for STATUS:CONFIRMED', async (t) => {
  const allEvents = [
    mockEvent('event-1', VEVENT_CONFIRMED),
    mockEvent('todo-active-1', VTODO_NEEDS_ACTION)
  ];

  const options = createMockOptions({
    data: {
      async getEventsForCalendar() {
        return allEvents;
      },
      getCalendarId: (ctx, cal) => cal.calendarId
    }
  });

  const calendarQuery = require('../routes/calendar/calendar/calendar-query')(
    options
  );

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop>
        <D:getetag />
      </D:prop>
      <C:filter>
        <C:comp-filter name="VCALENDAR">
          <C:comp-filter name="VEVENT">
            <C:prop-filter name="STATUS">
              <C:text-match>CONFIRMED</C:text-match>
            </C:prop-filter>
          </C:comp-filter>
        </C:comp-filter>
      </C:filter>
    </C:calendar-query>`;

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
    name: 'Calendar',
    synctoken: 'http://example.com/sync/1'
  };

  const result = await calendarQuery(ctx, calendar);
  t.is(
    result.responses.length,
    1,
    'Should return only VEVENT with STATUS:CONFIRMED'
  );
});
