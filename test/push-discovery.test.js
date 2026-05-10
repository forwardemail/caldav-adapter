'use strict';

//
// Tests for Apple CalDAV push-discovery (caldav-pubsubdiscovery.txt).
//
// The adapter exposes <CS:push-transports> + <CS:pushkey> properties under
// the http://calendarserver.org/ns/ namespace.  iOS Calendar reads them from
// PROPFIND on the calendar-home (`calCollection` in this adapter's
// nomenclature) and then POSTs to the advertised subscription URL to register
// for silent push notifications.
//
// Apple's reference implementation:
//   https://github.com/apple/ccs-calendarserver/blob/master/calendarserver/push/applepush.py
//
// These tests guard against the regression where push-transports was only
// returned for `principal` and `calendar` resources but NOT for
// `calCollection` -- which is the resource passed by
// routes/calendar/user/propfind.js (the calendar-home handler).  Without the
// fix, iOS never saw the advertisement on the home and never registered.
//

const test = require('ava');
const tagsFactory = require('../common/tags');

const cs = 'http://calendarserver.org/ns/';

test('push-transports: emitted on calCollection (calendar-home) -- regression', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider: () =>
      'com.apple.calendar.XServer.deadbeef-1234-5678-9abc-def012345678',
    pushSubscriptionURL: 'https://caldav.example.com/apns',
    pushEnv: 'PRODUCTION',
    pushRefreshInterval: '172800'
  });

  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'calCollection',
    calendar: undefined,
    ctx: { state: { params: { principalId: 'alice@example.com' } } }
  });

  t.truthy(
    result,
    'push-transports MUST be emitted on the calendar-home (calCollection) -- regression: previously returned undefined here so iOS never registered'
  );

  const transport = result['CS:push-transports']['CS:transport'];
  t.is(transport['@type'], 'APSD');
  t.is(
    transport['CS:subscription-url']['D:href'],
    'https://caldav.example.com/apns'
  );
  t.is(
    transport['CS:apsbundleid'],
    'com.apple.calendar.XServer.deadbeef-1234-5678-9abc-def012345678'
  );
  t.is(transport['CS:env'], 'PRODUCTION');
  t.is(transport['CS:refresh-interval'], '172800');
});

test('push-transports: emitted on principal', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider: () => 'topic-uid',
    pushSubscriptionURL: '/apns'
  });
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'principal',
    ctx: { state: { params: { principalId: 'alice@example.com' } } }
  });
  t.truthy(result);
});

test('push-transports: emitted on per-calendar collection (legacy clients)', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider: () => 'topic-uid'
  });
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'calendar',
    calendar: { calendarId: 'cal-1' },
    ctx: {}
  });
  t.truthy(result);
});

test('push-transports: NOT emitted for unknown resource types', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider: () => 'topic-uid'
  });
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'event',
    ctx: {}
  });
  t.is(result, undefined);
});

test('push-transports: NOT emitted when pushTopicProvider is omitted (back-compat)', async (t) => {
  const tags = tagsFactory({});
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'calCollection',
    ctx: { state: { params: { principalId: 'a' } } }
  });
  t.is(
    result,
    undefined,
    'When pushTopicProvider is not configured, push-discovery MUST be silent (back-compat)'
  );
});

test('push-transports: NOT emitted when pushTopicProvider returns falsy topic', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider: () => null
  });
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'calCollection',
    ctx: { state: { params: { principalId: 'a' } } }
  });
  t.is(result, undefined);
});

test('push-transports: pushTopicProvider error degrades gracefully', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider() {
      throw new Error('cert lookup failed');
    }
  });
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'calCollection',
    ctx: { state: { params: { principalId: 'a' } } }
  });
  t.is(result, undefined, 'pushTopicProvider throwing must NOT break PROPFIND');
});

test('push-transports: defaults match Apple ccs-calendarserver stdconfig (3600/PRODUCTION/apns)', async (t) => {
  const tags = tagsFactory({
    pushTopicProvider: () => 'topic-uid'
  });
  const result = await tags.tags[cs]['push-transports'].resp({
    resource: 'calCollection',
    ctx: { state: { params: { principalId: 'a' } } }
  });
  const transport = result['CS:push-transports']['CS:transport'];
  t.is(transport['CS:subscription-url']['D:href'], '/apns');
  t.is(transport['CS:env'], 'PRODUCTION');
  t.is(transport['CS:refresh-interval'], '3600');
});

test('pushkey: emitted on calCollection using principalId (home-level key)', async (t) => {
  const tags = tagsFactory({ pushTopicProvider: () => 'topic-uid' });
  const result = await tags.tags[cs].pushkey.resp({
    resource: 'calCollection',
    calendar: undefined,
    ctx: { state: { params: { principalId: 'alice@example.com' } } }
  });
  t.is(result['CS:pushkey'], 'alice@example.com');
});

test('pushkey: emitted on per-calendar using calendarId', async (t) => {
  const tags = tagsFactory({ pushTopicProvider: () => 'topic-uid' });
  const result = await tags.tags[cs].pushkey.resp({
    resource: 'calendar',
    calendar: { calendarId: 'work-cal' },
    ctx: {}
  });
  t.is(result['CS:pushkey'], 'work-cal');
});

test('pushkey: falls back to calendar._id.toString()', async (t) => {
  const tags = tagsFactory({ pushTopicProvider: () => 'topic-uid' });
  const result = await tags.tags[cs].pushkey.resp({
    resource: 'calendar',
    calendar: { _id: { toString: () => 'mongo-objectid' } },
    ctx: {}
  });
  t.is(result['CS:pushkey'], 'mongo-objectid');
});

test('pushkey: NOT emitted when calCollection has no principalId', async (t) => {
  const tags = tagsFactory({ pushTopicProvider: () => 'topic-uid' });
  const result = await tags.tags[cs].pushkey.resp({
    resource: 'calCollection',
    calendar: undefined,
    ctx: {}
  });
  t.is(result, undefined);
});

test('pushkey: NOT emitted when pushTopicProvider absent (back-compat)', async (t) => {
  const tags = tagsFactory({});
  const result = await tags.tags[cs].pushkey.resp({
    resource: 'calCollection',
    ctx: { state: { params: { principalId: 'a' } } }
  });
  t.is(result, undefined);
});

test('pushkey: NOT emitted on unknown resource types', async (t) => {
  const tags = tagsFactory({ pushTopicProvider: () => 'topic-uid' });
  const result = await tags.tags[cs].pushkey.resp({
    resource: 'event',
    ctx: {}
  });
  t.is(result, undefined);
});

//
// End-to-end regression test: the top-level adapter factory must forward
// push-related options through to the route initializers (which build the
// shared tags() instance via commonTags(options)).  Previously, index.js
// only forwarded { logEnabled, logLevel, data } to cal()/pri(), so even if
// the consumer passed pushTopicProvider, the tags handler always saw
// `options.pushTopicProvider === undefined` and short-circuited via:
//
//     if (typeof options.pushTopicProvider !== 'function') return;
//
// The symptom in production: iOS Calendar (com.apple.mobilecal) never
// receives <CS:push-transports> on the calendar-home, so it never POSTs
// to /apns to register for silent push notifications.  Mail and CardDAV
// (which do not depend on caldav-adapter) continued to work, masking the
// bug for some time.
//
test('index.js forwards push options to cal() and pri() route initializers (regression)', (t) => {
  // Stub the route modules to capture what options they receive.
  const calPath = require.resolve('../routes/calendar/calendar');
  const priPath = require.resolve('../routes/principal/principal');
  const origCal = require.cache[calPath];
  const origPri = require.cache[priPath];
  delete require.cache[calPath];
  delete require.cache[priPath];

  const calls = { cal: null, pri: null };
  require.cache[calPath] = {
    id: calPath,
    filename: calPath,
    loaded: true,
    exports(opts) {
      calls.cal = opts;
      return async () => {};
    }
  };
  require.cache[priPath] = {
    id: priPath,
    filename: priPath,
    loaded: true,
    exports(opts) {
      calls.pri = opts;
      return async () => {};
    }
  };

  // Re-require the adapter so it picks up our stubs.
  delete require.cache[require.resolve('..')];
  const caldavAdapter = require('..');

  const pushTopicProvider = () => 'com.apple.calendar.XServer.deadbeef';

  caldavAdapter({
    data: { stub: true },
    authenticate: () => null,
    pushTopicProvider,
    pushSubscriptionURL: 'https://caldav.example.com/apns',
    pushEnv: 'PRODUCTION',
    pushRefreshInterval: '172800'
  });

  // Restore caches
  delete require.cache[calPath];
  delete require.cache[priPath];
  delete require.cache[require.resolve('..')];
  if (origCal) require.cache[calPath] = origCal;
  if (origPri) require.cache[priPath] = origPri;

  t.truthy(calls.cal, 'cal() must be called');
  t.truthy(calls.pri, 'pri() must be called');

  for (const target of ['cal', 'pri']) {
    t.is(
      calls[target].pushTopicProvider,
      pushTopicProvider,
      `${target}() must receive pushTopicProvider (was silently dropped pre-fix)`
    );
    t.is(calls[target].pushSubscriptionURL, 'https://caldav.example.com/apns');
    t.is(calls[target].pushEnv, 'PRODUCTION');
    t.is(calls[target].pushRefreshInterval, '172800');
  }
});

//
// Sanity check the older option set is still forwarded (no regression).
//
test('index.js still forwards data, logEnabled, logLevel to route initializers', (t) => {
  const calPath = require.resolve('../routes/calendar/calendar');
  const priPath = require.resolve('../routes/principal/principal');
  const origCal = require.cache[calPath];
  const origPri = require.cache[priPath];
  delete require.cache[calPath];
  delete require.cache[priPath];

  const calls = { cal: null, pri: null };
  require.cache[calPath] = {
    id: calPath,
    filename: calPath,
    loaded: true,
    exports(opts) {
      calls.cal = opts;
      return async () => {};
    }
  };
  require.cache[priPath] = {
    id: priPath,
    filename: priPath,
    loaded: true,
    exports(opts) {
      calls.pri = opts;
      return async () => {};
    }
  };

  delete require.cache[require.resolve('..')];
  const caldavAdapter = require('..');

  const data = { fingerprint: Symbol('data') };
  caldavAdapter({
    data,
    authenticate: () => null,
    logEnabled: true,
    logLevel: 'verbose'
  });

  delete require.cache[calPath];
  delete require.cache[priPath];
  delete require.cache[require.resolve('..')];
  if (origCal) require.cache[calPath] = origCal;
  if (origPri) require.cache[priPath] = origPri;

  for (const target of ['cal', 'pri']) {
    t.is(calls[target].data, data);
    t.is(calls[target].logEnabled, true);
    t.is(calls[target].logLevel, 'verbose');
  }
});
