const test = require('ava');
const caldavAdapter = require('..');

// NOTE: defer to FE for tests

test('exports a function', (t) => {
  t.true(typeof caldavAdapter === 'function');
});

test('VTODO supported component set includes VTODO', (t) => {
  const options = {
    data: {
      getCalendarId: () => 'test',
      buildICS: () => 'test',
      getETag: () => 'test'
    }
  };

  const { tags } = require('../common/tags')(options);
  const supportedComponentSetTag =
    tags['urn:ietf:params:xml:ns:caldav']['supported-calendar-component-set'];

  t.is(typeof supportedComponentSetTag, 'object');
  t.is(typeof supportedComponentSetTag.resp, 'function');
});

test('VTODO content type is dynamic based on component', (t) => {
  const options = {
    data: {
      getCalendarId: () => 'test',
      buildICS: () => 'test',
      getETag: () => 'test'
    }
  };

  const { tags } = require('../common/tags')(options);
  const contentTypeTag = tags['DAV:'].getcontenttype;

  t.is(typeof contentTypeTag, 'object');
  t.is(typeof contentTypeTag.resp, 'function');
});
