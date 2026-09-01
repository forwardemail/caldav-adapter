const { Buffer } = require('node:buffer');
const test = require('ava');
const { DOMParser } = require('@xmldom/xmldom');

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
    getEventsByDate: async () => [],
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
// calendar-query: comp-filter WITHOUT time-range
// RFC 4791 Section 7.8
// ============================================

test('calendar-query with bare VEVENT comp-filter (no time-range) passes componentType=VEVENT', async (t) => {
  let receivedComponentType = null;
  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedComponentType = opts.componentType;
        return [];
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
          <C:comp-filter name="VEVENT"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.is(
    receivedComponentType,
    'VEVENT',
    'Should detect VEVENT from bare comp-filter without time-range'
  );
});

test('calendar-query with bare VTODO comp-filter (no time-range) passes componentType=VTODO', async (t) => {
  let receivedComponentType = null;
  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedComponentType = opts.componentType;
        return [];
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.is(
    receivedComponentType,
    'VTODO',
    'Should detect VTODO from bare comp-filter without time-range'
  );
});

test('calendar-query with VEVENT time-range filter calls getEventsByDate with componentType=VEVENT', async (t) => {
  let receivedOpts = null;
  const options = createMockOptions({
    data: {
      async getEventsByDate(ctx, opts) {
        receivedOpts = opts;
        return [];
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
          <C:comp-filter name="VEVENT">
            <C:time-range start="20260101T000000Z" end="20260201T000000Z"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.truthy(receivedOpts, 'Should have called getEventsByDate');
  t.is(receivedOpts.componentType, 'VEVENT');
  t.truthy(receivedOpts.start, 'Should have parsed start date');
  t.truthy(receivedOpts.end, 'Should have parsed end date');
});

test('calendar-query with VTODO time-range filter calls getEventsByDate with componentType=VTODO', async (t) => {
  let receivedOpts = null;
  const options = createMockOptions({
    data: {
      async getEventsByDate(ctx, opts) {
        receivedOpts = opts;
        return [];
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
            <C:time-range start="20260101T000000Z" end="20260201T000000Z"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.truthy(receivedOpts, 'Should have called getEventsByDate');
  t.is(receivedOpts.componentType, 'VTODO');
});

test('calendar-query with only VCALENDAR comp-filter (no nested type) passes componentType=null', async (t) => {
  let receivedComponentType = 'not-called';
  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedComponentType = opts.componentType;
        return [];
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
        <C:comp-filter name="VCALENDAR"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.is(
    receivedComponentType,
    null,
    'Should pass null componentType when no nested comp-filter'
  );
});

// ============================================
// supported-calendar-component-set respects calendar config
// RFC 4791 Section 5.2.3
// ============================================

test('supported-calendar-component-set returns only VEVENT when has_vtodo=false', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calendar',
    child: {
      namespaceURI: 'urn:ietf:params:xml:ns:caldav',
      localName: 'supported-calendar-component-set'
    },
    ctx: createMockCtx(),
    calendar: {
      calendarId: 'events-only',
      has_vevent: true,
      has_vtodo: false
    }
  });

  const xml = JSON.stringify(result);
  t.true(xml.includes('VEVENT'), 'Should include VEVENT');
  t.false(xml.includes('VTODO'), 'Should NOT include VTODO');
});

test('supported-calendar-component-set returns only VTODO when has_vevent=false', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calendar',
    child: {
      namespaceURI: 'urn:ietf:params:xml:ns:caldav',
      localName: 'supported-calendar-component-set'
    },
    ctx: createMockCtx(),
    calendar: {
      calendarId: 'tasks-only',
      has_vevent: false,
      has_vtodo: true
    }
  });

  const xml = JSON.stringify(result);
  t.false(xml.includes('VEVENT'), 'Should NOT include VEVENT');
  t.true(xml.includes('VTODO'), 'Should include VTODO');
});

test('supported-calendar-component-set returns both when both are true', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calendar',
    child: {
      namespaceURI: 'urn:ietf:params:xml:ns:caldav',
      localName: 'supported-calendar-component-set'
    },
    ctx: createMockCtx(),
    calendar: {
      calendarId: 'both',
      has_vevent: true,
      has_vtodo: true
    }
  });

  const xml = JSON.stringify(result);
  t.true(xml.includes('VEVENT'), 'Should include VEVENT');
  t.true(xml.includes('VTODO'), 'Should include VTODO');
});

test('supported-calendar-component-set defaults to both when fields are absent', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calendar',
    child: {
      namespaceURI: 'urn:ietf:params:xml:ns:caldav',
      localName: 'supported-calendar-component-set'
    },
    ctx: createMockCtx(),
    calendar: {
      calendarId: 'legacy-no-flags'
      // no has_vevent or has_vtodo fields
    }
  });

  const xml = JSON.stringify(result);
  t.true(xml.includes('VEVENT'), 'Should default to VEVENT');
  t.true(xml.includes('VTODO'), 'Should default to VTODO');
});

// ============================================
// Principal REPORT handler is wired
// RFC 3744 Section 9.4/9.5
// ============================================

test('principal router accepts REPORT method', async (t) => {
  const options = createMockOptions({
    caldavRoot: '/',
    calendarRoot: 'cal',
    principalRoot: 'p',
    authenticate: async () => ({
      principalId: 'user@example.com',
      principalName: 'user@example.com'
    })
  });

  const principal = require('../routes/principal/principal')(options);

  const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:principal-search-property-set xmlns:D="DAV:" />`;

  const doc = new DOMParser().parseFromString(xmlBody, 'application/xml');

  const ctx = createMockCtx({
    method: 'REPORT',
    url: '/p/user@example.com/',
    request: { xml: doc },
    state: {
      ...createMockCtx().state,
      params: {
        principalId: 'user@example.com'
      }
    }
  });

  await principal(ctx);

  // Should return 207 multistatus (not 404)
  t.is(ctx.status, 207);
  t.truthy(ctx.body);
  t.true(
    ctx.body.includes('principal-search-property-set'),
    'Should return principal-search-property-set response'
  );
});

test('principal OPTIONS includes REPORT', async (t) => {
  const options = createMockOptions();
  const principal = require('../routes/principal/principal')(options);

  const headers = {};
  const ctx = createMockCtx({
    method: 'OPTIONS',
    url: '/p/user@example.com/',
    set(name, value) {
      headers[name.toLowerCase()] = value;
    }
  });

  await principal(ctx);

  t.is(ctx.status, 200);
  t.truthy(headers.allow);
  t.true(
    headers.allow.includes('REPORT'),
    'Allow header should include REPORT'
  );
});

// ============================================
// Calendar home PROPFIND allprop handling
// RFC 4918 Section 9.1
// ============================================

test('calendar home propfind with empty body returns allprop defaults', async (t) => {
  const options = createMockOptions();
  const userPropfind = require('../routes/calendar/user/propfind')(options);

  const headers = { depth: '0' };
  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/',
    request: { xml: null },
    get(name) {
      return headers[name.toLowerCase()] || '';
    }
  });

  const result = await userPropfind.exec(ctx);

  t.truthy(result, 'Should return a response');
  t.true(result.includes('resourcetype'), 'Should include resourcetype');
  t.true(
    result.includes('current-user-principal'),
    'Should include current-user-principal'
  );
  t.true(
    result.includes('supported-report-set'),
    'Should include supported-report-set'
  );
});

test('calendar home propfind with null XML returns properties not empty', async (t) => {
  const options = createMockOptions();
  const userPropfind = require('../routes/calendar/user/propfind')(options);

  const headers = { depth: '0' };
  const ctx = createMockCtx({
    method: 'PROPFIND',
    url: '/cal/user@example.com/',
    request: { xml: null },
    get(name) {
      return headers[name.toLowerCase()] || '';
    }
  });

  const result = await userPropfind.exec(ctx);

  // Should NOT have an empty 404 propstat
  t.truthy(result);
  t.true(
    result.includes('HTTP/1.1 200'),
    'Should have 200 propstat with properties'
  );
});

// ============================================
// Calendar home supported-report-set
// ============================================

test('calendar home supported-report-set is empty (not sync-collection)', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calCollection',
    child: {
      namespaceURI: 'DAV:',
      localName: 'supported-report-set'
    },
    ctx: createMockCtx()
  });

  const xml = JSON.stringify(result);
  t.false(
    xml.includes('sync-collection'),
    'Calendar home should NOT advertise sync-collection'
  );
  t.false(
    xml.includes('calendar-query'),
    'Calendar home should NOT advertise calendar-query'
  );
});

test('individual calendar supported-report-set includes all three reports', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calendar',
    child: {
      namespaceURI: 'DAV:',
      localName: 'supported-report-set'
    },
    ctx: createMockCtx(),
    calendar: { calendarId: 'test' }
  });

  const xml = JSON.stringify(result);
  t.true(xml.includes('calendar-query'), 'Should include calendar-query');
  t.true(xml.includes('calendar-multiget'), 'Should include calendar-multiget');
  t.true(xml.includes('sync-collection'), 'Should include sync-collection');
});

// ============================================
// calendar-query time-range edge cases
// ============================================

test('calendar-query with time-range start only (no end) works', async (t) => {
  let receivedOpts = null;
  const options = createMockOptions({
    data: {
      async getEventsByDate(ctx, opts) {
        receivedOpts = opts;
        return [];
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
            <C:time-range start="20260101T000000Z"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.truthy(receivedOpts, 'Should call getEventsByDate');
  t.truthy(receivedOpts.start, 'Should have start date');
  t.is(receivedOpts.end, null, 'Should have null end date');
  t.is(receivedOpts.componentType, 'VEVENT');
});

test('calendar-query with time-range end only (no start) works', async (t) => {
  let receivedOpts = null;
  const options = createMockOptions({
    data: {
      async getEventsByDate(ctx, opts) {
        receivedOpts = opts;
        return [];
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
            <C:time-range end="20260201T000000Z"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.truthy(receivedOpts, 'Should call getEventsByDate');
  t.is(receivedOpts.start, null, 'Should have null start date');
  t.truthy(receivedOpts.end, 'Should have end date');
});

// ============================================
// calendar-query fullData detection
// ============================================

test('calendar-query detects fullData=true when calendar-data is requested', async (t) => {
  let receivedFullData = null;
  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedFullData = opts.fullData;
        return [];
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
          <C:comp-filter name="VEVENT"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.true(
    receivedFullData,
    'Should detect fullData=true from calendar-data prop'
  );
});

test('calendar-query detects fullData=false when only getetag is requested', async (t) => {
  let receivedFullData = null;
  const options = createMockOptions({
    data: {
      async getEventsForCalendar(ctx, opts) {
        receivedFullData = opts.fullData;
        return [];
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
          <C:comp-filter name="VEVENT"/>
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
      },
      calendarHomeUrl: '/cal/user@example.com/'
    }
  });

  const calendar = {
    calendarId: 'test-calendar',
    name: 'Test',
    synctoken: 'http://example.com/sync/1'
  };
  await calendarQuery(ctx, calendar);

  t.false(
    receivedFullData,
    'Should detect fullData=false when calendar-data not requested'
  );
});

// ============================================
// supported-calendar-component-set safety fallback
// ============================================

test('supported-calendar-component-set falls back to both when both flags are false', async (t) => {
  const options = createMockOptions();
  const tags = require('../common/tags')(options);

  const result = await tags.getResponse({
    resource: 'calendar',
    child: {
      namespaceURI: 'urn:ietf:params:xml:ns:caldav',
      localName: 'supported-calendar-component-set'
    },
    ctx: createMockCtx(),
    calendar: {
      calendarId: 'broken',
      has_vevent: false,
      has_vtodo: false
    }
  });

  const xml = JSON.stringify(result);
  t.true(
    xml.includes('VEVENT'),
    'Safety fallback: should include VEVENT when both false'
  );
  t.true(
    xml.includes('VTODO'),
    'Safety fallback: should include VTODO when both false'
  );
});

// ============================================
// Root PROPFIND returns 207 with current-user-principal
// RFC 6764 Section 5 / RFC 4918 Section 9.1
// ============================================

test('root PROPFIND returns 207 with current-user-principal instead of redirect', async (t) => {
  const options = createMockOptions({
    caldavRoot: '/',
    calendarRoot: 'cal',
    principalRoot: 'p',
    authRealm: 'test',
    authenticate: async () => ({
      principalId: 'user@example.com',
      principalName: 'user@example.com',
      email: 'user@example.com'
    })
  });

  const middleware = require('../index')(options);

  const headers = {
    authorization:
      'Basic ' + Buffer.from('user@example.com:password').toString('base64'),
    'content-type': 'application/xml',
    depth: '0'
  };

  const ctx = {
    method: 'PROPFIND',
    url: '/',
    path: '/',
    status: 200,
    body: '',
    headers,
    request: {
      body: `<?xml version="1.0" encoding="utf-8" ?>
        <D:propfind xmlns:D="DAV:">
          <D:prop>
            <D:current-user-principal/>
          </D:prop>
        </D:propfind>`,
      type: 'application/xml',
      is(type) {
        return type === 'application/xml' || type === 'text/xml';
      }
    },
    state: {},
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    remove(name) {
      delete headers[name.toLowerCase()];
    },
    response: {
      get(name) {
        return headers[name.toLowerCase()] || '';
      },
      set(name, value) {
        headers[name.toLowerCase()] = value;
      }
    },
    accepts() {
      return true;
    },
    throw(s, msg) {
      const err = new Error(msg);
      err.status = s;
      throw err;
    },
    redirect(url) {
      this.status = 302;
      this.body = url;
    }
  };

  await middleware(ctx, async () => {});

  t.is(ctx.status, 207, 'Should return 207 Multi-Status, not 302 redirect');
  t.truthy(ctx.body, 'Should have a response body');
  t.true(
    ctx.body.includes('current-user-principal'),
    'Response should include current-user-principal'
  );
  t.true(
    ctx.body.includes('/p/user@example.com/'),
    'Response should include the principal URL'
  );
});

test('root PROPFIND includes calendar-home-set in response', async (t) => {
  const options = createMockOptions({
    caldavRoot: '/',
    calendarRoot: 'cal',
    principalRoot: 'p',
    authRealm: 'test',
    authenticate: async () => ({
      principalId: 'user@example.com',
      principalName: 'user@example.com',
      email: 'user@example.com'
    })
  });

  const middleware = require('../index')(options);

  const headers = {
    authorization:
      'Basic ' + Buffer.from('user@example.com:password').toString('base64'),
    'content-type': 'application/xml',
    depth: '0'
  };

  const ctx = {
    method: 'PROPFIND',
    url: '/',
    path: '/',
    status: 200,
    body: '',
    headers,
    request: {
      body: `<?xml version="1.0" encoding="utf-8" ?>
        <D:propfind xmlns:D="DAV:">
          <D:prop>
            <D:current-user-principal/>
          </D:prop>
        </D:propfind>`,
      type: 'application/xml',
      is(type) {
        return type === 'application/xml' || type === 'text/xml';
      }
    },
    state: {},
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    remove(name) {
      delete headers[name.toLowerCase()];
    },
    response: {
      get(name) {
        return headers[name.toLowerCase()] || '';
      },
      set(name, value) {
        headers[name.toLowerCase()] = value;
      }
    },
    accepts() {
      return true;
    },
    throw(s, msg) {
      const err = new Error(msg);
      err.status = s;
      throw err;
    },
    redirect(url) {
      this.status = 302;
      this.body = url;
    }
  };

  await middleware(ctx, async () => {});

  t.is(ctx.status, 207);
  t.true(
    ctx.body.includes('calendar-home-set'),
    'Response should include calendar-home-set'
  );
  t.true(
    ctx.body.includes('/cal/user@example.com/'),
    'calendar-home-set should point to the correct URL'
  );
});

test('root non-PROPFIND method still redirects to principals', async (t) => {
  const options = createMockOptions({
    caldavRoot: '/',
    calendarRoot: 'cal',
    principalRoot: 'p',
    authRealm: 'test',
    authenticate: async () => ({
      principalId: 'user@example.com',
      principalName: 'user@example.com',
      email: 'user@example.com'
    })
  });

  const middleware = require('../index')(options);

  const headers = {
    authorization:
      'Basic ' + Buffer.from('user@example.com:password').toString('base64')
  };

  const ctx = {
    method: 'GET',
    url: '/',
    path: '/',
    status: 200,
    body: '',
    headers,
    request: {
      body: '',
      type: '',
      is() {
        return false;
      }
    },
    state: {},
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
    set(name, value) {
      headers[name.toLowerCase()] = value;
    },
    remove(name) {
      delete headers[name.toLowerCase()];
    },
    response: {
      get(name) {
        return headers[name.toLowerCase()] || '';
      },
      set(name, value) {
        headers[name.toLowerCase()] = value;
      }
    },
    accepts() {
      return true;
    },
    throw(s, msg) {
      const err = new Error(msg);
      err.status = s;
      throw err;
    },
    redirect(url) {
      this.status = 302;
      this.body = url;
    }
  };

  await middleware(ctx, async () => {});

  t.is(ctx.status, 302, 'Non-PROPFIND should still redirect');
});
