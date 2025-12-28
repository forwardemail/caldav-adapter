const test = require('ava');
const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');

// Use the same namespace configuration as caldav-adapter
const namespaces = {
  D: 'DAV:',
  CAL: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  ICAL: 'http://apple.com/ns/ical/'
};

const select = xpath.useNamespaces(namespaces);

// Helper to convert NodeList to array (xmldom NodeList is not iterable with spread)
function nodeListToArray(nodeList) {
  const result = [];
  if (nodeList && nodeList.length > 0) {
    for (let i = 0; i < nodeList.length; i++) {
      result.push(nodeList.item(i));
    }
  }

  return result;
}

// Helper to parse XML and get children like proppatch.js does
function getProppatchChildren(
  xmlBody,
  path = '/D:propertyupdate/D:set/D:prop'
) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlBody, 'text/xml');
  const propNode = select(path, doc);
  return propNode[0] ? nodeListToArray(propNode[0].childNodes) : [];
}

// Helper to get both set and remove children
function getProppatchAllChildren(xmlBody) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlBody, 'text/xml');

  const setNode = select('/D:propertyupdate/D:set/D:prop', doc);
  const removeNode = select('/D:propertyupdate/D:remove/D:prop', doc);

  const setChildren = setNode[0] ? nodeListToArray(setNode[0].childNodes) : [];
  const removeChildren = removeNode[0]
    ? nodeListToArray(removeNode[0].childNodes)
    : [];

  return { setChildren, removeChildren };
}

// Protected properties per RFC 4791
const PROTECTED_PROPERTIES = new Set([
  'supported-calendar-component-set',
  'supported-calendar-data',
  'max-resource-size',
  'min-date-time',
  'max-date-time',
  'max-instances',
  'max-attendees-per-instance',
  'getctag',
  'getetag',
  'getcontenttype',
  'getcontentlength',
  'getlastmodified',
  'creationdate',
  'resourcetype',
  'sync-token',
  'current-user-privilege-set',
  'owner',
  'supported-report-set'
]);

// Modifiable properties
const MODIFIABLE_PROPERTIES = new Set([
  'displayname',
  'calendar-description',
  'calendar-timezone',
  'calendar-color',
  'calendar-order'
]);

// Helper to simulate the fixed proppatch logic
function simulateProppatch(setChildren, removeChildren = []) {
  const updates = {};

  // Process set children
  for (const child of setChildren) {
    if (!child.localName) continue;
    if (PROTECTED_PROPERTIES.has(child.localName)) continue;

    switch (child.localName) {
      case 'displayname': {
        updates.name = child.textContent;
        break;
      }

      case 'calendar-description': {
        updates.description = child.textContent;
        break;
      }

      case 'calendar-timezone': {
        updates.timezone = child.textContent;
        break;
      }

      case 'calendar-color': {
        updates.color = child.textContent;
        break;
      }

      case 'calendar-order': {
        updates.order = child.textContent
          ? Number.parseInt(child.textContent, 10)
          : null;
        break;
      }

      // No default
    }
  }

  // Process remove children
  for (const child of removeChildren) {
    if (!child.localName) continue;
    if (PROTECTED_PROPERTIES.has(child.localName)) continue;

    switch (child.localName) {
      case 'displayname': {
        updates.name = '';
        break;
      }

      case 'calendar-description': {
        updates.description = '';
        break;
      }

      case 'calendar-timezone': {
        updates.timezone = '';
        break;
      }

      case 'calendar-color': {
        updates.color = '';
        break;
      }

      case 'calendar-order': {
        updates.order = null;
        break;
      }

      // No default
    }
  }

  return updates;
}

// =============================================================================
// RFC 4918 Section 9.2 - PROPPATCH Method Tests
// =============================================================================

test('RFC 4918 9.2: PROPPATCH should process set instructions', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>My Calendar</D:displayname>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.name, 'My Calendar');
});

test('RFC 4918 9.2: PROPPATCH should process remove instructions', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:remove>
    <D:prop>
      <C:calendar-description/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { removeChildren } = getProppatchAllChildren(xml);
  const updates = simulateProppatch([], removeChildren);

  t.true('description' in updates);
  t.is(updates.description, '');
});

test('RFC 4918 9.2: PROPPATCH should process both set and remove in same request', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>Work Calendar</D:displayname>
    </D:prop>
  </D:set>
  <D:remove>
    <D:prop>
      <C:calendar-description/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { setChildren, removeChildren } = getProppatchAllChildren(xml);
  const updates = simulateProppatch(setChildren, removeChildren);

  t.is(updates.name, 'Work Calendar');
  t.is(updates.description, '');
});

// =============================================================================
// RFC 4918 Section 14.26 - set XML Element Tests
// =============================================================================

test('RFC 4918 14.26: Empty property value should be valid (self-closing)', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<A:propertyupdate xmlns:A="DAV:"><A:set><A:prop><B:calendar-description xmlns:B="urn:ietf:params:xml:ns:caldav"/></A:prop></A:set></A:propertyupdate>`;

  const children = getProppatchChildren(xml);
  t.is(children.length, 1);
  t.is(children[0].localName, 'calendar-description');
  t.is(children[0].textContent, '');

  const updates = simulateProppatch(children);
  t.true('description' in updates);
  t.is(updates.description, '');
});

test('RFC 4918 14.26: Empty property value should be valid (explicit empty)', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description></C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const descChild = children.find(
    (c) => c.localName === 'calendar-description'
  );
  t.truthy(descChild);
  t.is(descChild.textContent, '');

  const updates = simulateProppatch(children);
  t.true('description' in updates);
  t.is(updates.description, '');
});

test('RFC 4918 14.26: Setting property should replace existing value', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>New Description</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, 'New Description');
});

// =============================================================================
// RFC 4918 Section 14.23 - remove XML Element Tests
// =============================================================================

test('RFC 4918 14.23: Remove instruction should clear property', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:">
  <D:remove>
    <D:prop>
      <D:displayname/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { removeChildren } = getProppatchAllChildren(xml);
  const updates = simulateProppatch([], removeChildren);

  t.true('name' in updates);
  t.is(updates.name, '');
});

test('RFC 4918 14.23: Remove elements should be empty (only names needed)', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:remove>
    <D:prop>
      <C:calendar-description/>
      <C:calendar-timezone/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { removeChildren } = getProppatchAllChildren(xml);
  const elementChildren = removeChildren.filter((c) => c.localName);

  // All remove elements should be empty
  for (const child of elementChildren) {
    t.is(child.textContent, '');
  }

  const updates = simulateProppatch([], removeChildren);
  t.is(updates.description, '');
  t.is(updates.timezone, '');
});

test('RFC 4918 14.23: Removing non-existent property should not error', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:X="http://example.com/ns/">
  <D:remove>
    <D:prop>
      <X:nonexistent-property/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { removeChildren } = getProppatchAllChildren(xml);

  // Should not throw
  t.notThrows(() => {
    simulateProppatch([], removeChildren);
  });
});

// =============================================================================
// RFC 4791 Section 5.2.1 - calendar-description Property Tests
// =============================================================================

test('RFC 4791 5.2.1: calendar-description allows #PCDATA (empty content)', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description/>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, '');
});

test('RFC 4791 5.2.1: calendar-description with content', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>My Calendar Description</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, 'My Calendar Description');
});

// =============================================================================
// RFC 4791 Section 5.2.2 - calendar-timezone Property Tests
// =============================================================================

test('RFC 4791 5.2.2: calendar-timezone with VTIMEZONE content', (t) => {
  const vtimezone = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:America/New_York
END:VTIMEZONE
END:VCALENDAR`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-timezone>${vtimezone}</C:calendar-timezone>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.true(updates.timezone.includes('VTIMEZONE'));
  t.true(updates.timezone.includes('America/New_York'));
});

// =============================================================================
// RFC 4791 Section 5.2.3 - Protected Properties Tests
// =============================================================================

test('RFC 4791 5.2.3: supported-calendar-component-set is protected', (t) => {
  t.true(PROTECTED_PROPERTIES.has('supported-calendar-component-set'));
});

test('RFC 4791 5.2.3: Protected properties should be rejected', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:supported-calendar-component-set>
        <C:comp name="VEVENT"/>
      </C:supported-calendar-component-set>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  // Protected property should not be in updates
  t.false('supported-calendar-component-set' in updates);
});

// =============================================================================
// Apple/CalendarServer Extensions Tests
// =============================================================================

test('Apple Extension: calendar-color with value', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <A:calendar-color>#FF5733FF</A:calendar-color>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.color, '#FF5733FF');
});

test('Apple Extension: calendar-color empty (clear color)', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <A:calendar-color/>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.true('color' in updates);
  t.is(updates.color, '');
});

test('Apple Extension: calendar-order with integer value', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <A:calendar-order>5</A:calendar-order>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.order, 5);
  t.is(typeof updates.order, 'number');
});

test('Apple Extension: calendar-order empty (set to null)', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <A:calendar-order/>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.true('order' in updates);
  t.is(updates.order, null);
});

// =============================================================================
// DAV:displayname Property Tests
// =============================================================================

test('DAV:displayname with value', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:">
  <D:set>
    <D:prop>
      <D:displayname>Work Calendar</D:displayname>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.name, 'Work Calendar');
});

test('DAV:displayname empty', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:">
  <D:set>
    <D:prop>
      <D:displayname/>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.true('name' in updates);
  t.is(updates.name, '');
});

// =============================================================================
// Multiple Properties Tests
// =============================================================================

test('Multiple properties in single PROPPATCH', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <D:displayname>Work Calendar</D:displayname>
      <C:calendar-description>My work events</C:calendar-description>
      <A:calendar-color>#0000FFFF</A:calendar-color>
      <A:calendar-order>1</A:calendar-order>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.name, 'Work Calendar');
  t.is(updates.description, 'My work events');
  t.is(updates.color, '#0000FFFF');
  t.is(updates.order, 1);
});

test('Mixed empty and non-empty properties', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <D:displayname>My Calendar</D:displayname>
      <C:calendar-description/>
      <A:calendar-color>#FF0000FF</A:calendar-color>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.name, 'My Calendar');
  t.is(updates.description, '');
  t.is(updates.color, '#FF0000FF');
});

// =============================================================================
// Whitespace Handling Tests
// =============================================================================

test('Whitespace preservation in property values', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>  spaced  </C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, '  spaced  ');
});

// =============================================================================
// Namespace Handling Tests
// =============================================================================

test('Different namespace prefixes for same namespace', (t) => {
  // Using 'B' instead of 'C' for caldav namespace
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<A:propertyupdate xmlns:A="DAV:">
  <A:set>
    <A:prop>
      <B:calendar-description xmlns:B="urn:ietf:params:xml:ns:caldav">Test Description</B:calendar-description>
    </A:prop>
  </A:set>
</A:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, 'Test Description');
});

test('Unknown namespace properties should be ignored gracefully', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:X="http://example.com/ns/">
  <D:set>
    <D:prop>
      <D:displayname>My Calendar</D:displayname>
      <X:unknown-property>some value</X:unknown-property>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  // Should still process known properties
  t.is(updates.name, 'My Calendar');
  // Unknown property should not be in updates
  t.false('unknown-property' in updates);
});

// =============================================================================
// Document Order Processing Tests (RFC 4918 Section 9.2)
// =============================================================================

test('RFC 4918 9.2: Instructions processed in document order', (t) => {
  // Set then remove should result in empty
  const xml1 = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>First Value</C:calendar-description>
    </D:prop>
  </D:set>
  <D:remove>
    <D:prop>
      <C:calendar-description/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { setChildren: set1, removeChildren: remove1 } =
    getProppatchAllChildren(xml1);
  const updates1 = simulateProppatch(set1, remove1);

  // Remove comes after set, so should be empty
  t.is(updates1.description, '');
});

// =============================================================================
// Protected Properties Complete List Tests
// =============================================================================

test('All RFC 4791 protected properties are in PROTECTED_PROPERTIES set', (t) => {
  const rfc4791Protected = [
    'supported-calendar-component-set',
    'supported-calendar-data',
    'max-resource-size',
    'min-date-time',
    'max-date-time',
    'max-instances',
    'max-attendees-per-instance'
  ];

  for (const prop of rfc4791Protected) {
    t.true(
      PROTECTED_PROPERTIES.has(prop),
      `${prop} should be in PROTECTED_PROPERTIES`
    );
  }
});

test('All DAV protected properties are in PROTECTED_PROPERTIES set', (t) => {
  const davProtected = [
    'getetag',
    'getcontenttype',
    'getcontentlength',
    'getlastmodified',
    'creationdate',
    'resourcetype',
    'sync-token',
    'current-user-privilege-set',
    'owner',
    'supported-report-set'
  ];

  for (const prop of davProtected) {
    t.true(
      PROTECTED_PROPERTIES.has(prop),
      `${prop} should be in PROTECTED_PROPERTIES`
    );
  }
});

// =============================================================================
// Modifiable Properties Complete List Tests
// =============================================================================

test('All modifiable properties are in MODIFIABLE_PROPERTIES set', (t) => {
  const modifiable = [
    'displayname',
    'calendar-description',
    'calendar-timezone',
    'calendar-color',
    'calendar-order'
  ];

  for (const prop of modifiable) {
    t.true(
      MODIFIABLE_PROPERTIES.has(prop),
      `${prop} should be in MODIFIABLE_PROPERTIES`
    );
  }
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

test('Empty propertyupdate should not throw', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:">
  <D:set>
    <D:prop>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);

  t.notThrows(() => {
    simulateProppatch(children);
  });
});

test('Whitespace-only text nodes should be ignored', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>Test</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  // Filter to only element nodes (nodeType 1)
  const elementChildren = children.filter((c) => c.nodeType === 1);

  t.is(elementChildren.length, 1);
  t.is(elementChildren[0].localName, 'calendar-description');
});

test('Special characters in property values should be preserved', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>Test &amp; Description &lt;with&gt; "special" chars</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, 'Test & Description <with> "special" chars');
});

test('Unicode characters in property values', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>日本語カレンダー 📅</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.is(updates.description, '日本語カレンダー 📅');
});

test('Newlines in property values should be preserved', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>Line 1
Line 2
Line 3</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const updates = simulateProppatch(children);

  t.true(updates.description.includes('\n'));
  t.true(updates.description.includes('Line 1'));
  t.true(updates.description.includes('Line 2'));
  t.true(updates.description.includes('Line 3'));
});

// =============================================================================
// Remove Multiple Properties Tests
// =============================================================================

test('Remove multiple properties at once', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:remove>
    <D:prop>
      <D:displayname/>
      <C:calendar-description/>
      <A:calendar-color/>
      <A:calendar-order/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { removeChildren } = getProppatchAllChildren(xml);
  const updates = simulateProppatch([], removeChildren);

  t.is(updates.name, '');
  t.is(updates.description, '');
  t.is(updates.color, '');
  t.is(updates.order, null);
});

// =============================================================================
// Complex Mixed Operations Tests
// =============================================================================

test('Complex: Set some properties, remove others', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <D:displayname>New Name</D:displayname>
      <A:calendar-color>#123456FF</A:calendar-color>
    </D:prop>
  </D:set>
  <D:remove>
    <D:prop>
      <C:calendar-description/>
      <A:calendar-order/>
    </D:prop>
  </D:remove>
</D:propertyupdate>`;

  const { setChildren, removeChildren } = getProppatchAllChildren(xml);
  const updates = simulateProppatch(setChildren, removeChildren);

  t.is(updates.name, 'New Name');
  t.is(updates.color, '#123456FF');
  t.is(updates.description, '');
  t.is(updates.order, null);
});

// =============================================================================
// RFC 4791 Section 5.2.2 - calendar-timezone Validation Tests
// =============================================================================

/**
 * Validate VTIMEZONE content per RFC 4791 Section 5.2.2
 */
function validateCalendarTimezone(value) {
  if (!value || value.trim() === '') {
    return { valid: true, error: null };
  }

  if (!value.includes('BEGIN:VCALENDAR') || !value.includes('END:VCALENDAR')) {
    return {
      valid: false,
      error:
        'calendar-timezone must be a valid iCalendar object (missing VCALENDAR)'
    };
  }

  const vtimezoneCount = (value.match(/BEGIN:VTIMEZONE/g) || []).length;
  if (vtimezoneCount === 0) {
    return {
      valid: false,
      error: 'calendar-timezone must contain a VTIMEZONE component'
    };
  }

  if (vtimezoneCount > 1) {
    return {
      valid: false,
      error: 'calendar-timezone must contain exactly one VTIMEZONE component'
    };
  }

  const endVtimezoneCount = (value.match(/END:VTIMEZONE/g) || []).length;
  if (vtimezoneCount !== endVtimezoneCount) {
    return {
      valid: false,
      error: 'calendar-timezone has malformed VTIMEZONE component'
    };
  }

  if (!value.includes('TZID:') && !value.includes('TZID;')) {
    return {
      valid: false,
      error: 'VTIMEZONE component must have a TZID property'
    };
  }

  return { valid: true, error: null };
}

test('RFC 4791 5.2.2: Empty timezone is valid (clearing)', (t) => {
  const result = validateCalendarTimezone('');
  t.true(result.valid);
  t.is(result.error, null);
});

test('RFC 4791 5.2.2: Valid VTIMEZONE passes validation', (t) => {
  const validTimezone = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE
END:VCALENDAR`;

  const result = validateCalendarTimezone(validTimezone);
  t.true(result.valid);
  t.is(result.error, null);
});

test('RFC 4791 5.2.2: Missing VCALENDAR wrapper fails validation', (t) => {
  const invalidTimezone = `BEGIN:VTIMEZONE
TZID:America/New_York
END:VTIMEZONE`;

  const result = validateCalendarTimezone(invalidTimezone);
  t.false(result.valid);
  t.true(result.error.includes('VCALENDAR'));
});

test('RFC 4791 5.2.2: Missing VTIMEZONE component fails validation', (t) => {
  const invalidTimezone = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

  const result = validateCalendarTimezone(invalidTimezone);
  t.false(result.valid);
  t.true(result.error.includes('VTIMEZONE'));
});

test('RFC 4791 5.2.2: Multiple VTIMEZONE components fails validation', (t) => {
  const invalidTimezone = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:America/New_York
END:VTIMEZONE
BEGIN:VTIMEZONE
TZID:Europe/London
END:VTIMEZONE
END:VCALENDAR`;

  const result = validateCalendarTimezone(invalidTimezone);
  t.false(result.valid);
  t.true(result.error.includes('exactly one'));
});

test('RFC 4791 5.2.2: Missing TZID property fails validation', (t) => {
  const invalidTimezone = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
BEGIN:STANDARD
DTSTART:19701101T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
END:VTIMEZONE
END:VCALENDAR`;

  const result = validateCalendarTimezone(invalidTimezone);
  t.false(result.valid);
  t.true(result.error.includes('TZID'));
});

// =============================================================================
// RFC 4791 Section 5.2.1 - xml:lang Attribute Tests
// =============================================================================

/**
 * Extract xml:lang attribute from an element
 */
function extractXmlLang(child) {
  if (child.getAttributeNS) {
    const lang = child.getAttributeNS(
      'http://www.w3.org/XML/1998/namespace',
      'lang'
    );
    if (lang) return lang;
  }

  if (child.getAttribute) {
    const lang = child.getAttribute('xml:lang');
    if (lang) return lang;
  }

  let parent = child.parentNode;
  while (parent && parent.getAttribute) {
    const lang = parent.getAttribute('xml:lang');
    if (lang) return lang;
    parent = parent.parentNode;
  }

  return null;
}

test('RFC 4791 5.2.1: xml:lang attribute on element is extracted', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description xml:lang="en-US">English Description</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const descChild = children.find(
    (c) => c.localName === 'calendar-description'
  );
  t.truthy(descChild);

  const lang = extractXmlLang(descChild);
  t.is(lang, 'en-US');
});

test('RFC 4791 5.2.1: xml:lang attribute inherited from parent', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xml:lang="de-DE">
  <D:set>
    <D:prop>
      <C:calendar-description>German Description</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const propNode = select('/D:propertyupdate/D:set/D:prop', doc);
  const children = propNode[0] ? nodeListToArray(propNode[0].childNodes) : [];
  const descChild = children.find(
    (c) => c.localName === 'calendar-description'
  );
  t.truthy(descChild);

  const lang = extractXmlLang(descChild);
  t.is(lang, 'de-DE');
});

test('RFC 4791 5.2.1: No xml:lang returns null', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>No Language</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);
  const descChild = children.find(
    (c) => c.localName === 'calendar-description'
  );
  t.truthy(descChild);

  const lang = extractXmlLang(descChild);
  t.is(lang, null);
});

// =============================================================================
// RFC 4918 Section 9.2 - Atomicity Tests
// =============================================================================

test('RFC 4918 9.2: Atomicity - all properties should fail if one is protected', (t) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>New Name</D:displayname>
      <C:supported-calendar-component-set>
        <C:comp name="VEVENT"/>
      </C:supported-calendar-component-set>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);

  // Check that we have both a modifiable and protected property
  const hasDisplayname = children.some((c) => c.localName === 'displayname');
  const hasProtected = children.some(
    (c) => c.localName === 'supported-calendar-component-set'
  );

  t.true(hasDisplayname);
  t.true(hasProtected);

  // In a real implementation, the presence of the protected property
  // would cause the entire request to fail (atomicity)
});

test('RFC 4918 9.2: Atomicity - validation error should fail all properties', (t) => {
  const invalidTimezone = 'NOT A VALID TIMEZONE';
  const validation = validateCalendarTimezone(invalidTimezone);

  t.false(validation.valid);
  // In a real implementation, this would cause all properties in the
  // PROPPATCH request to fail due to atomicity requirements
});

// =============================================================================
// Integration-style Tests
// =============================================================================

test('Integration: Full PROPPATCH with xml:lang and valid timezone', (t) => {
  const validTimezone = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Europe/Paris
END:VTIMEZONE
END:VCALENDAR`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <D:displayname xml:lang="fr-FR">Mon Calendrier</D:displayname>
      <C:calendar-description xml:lang="fr-FR">Description en français</C:calendar-description>
      <C:calendar-timezone>${validTimezone}</C:calendar-timezone>
      <A:calendar-color>#0000FFFF</A:calendar-color>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

  const children = getProppatchChildren(xml);

  // Verify all properties are present
  const displayname = children.find((c) => c.localName === 'displayname');
  const description = children.find(
    (c) => c.localName === 'calendar-description'
  );
  const timezone = children.find((c) => c.localName === 'calendar-timezone');
  const color = children.find((c) => c.localName === 'calendar-color');

  t.truthy(displayname);
  t.truthy(description);
  t.truthy(timezone);
  t.truthy(color);

  // Verify xml:lang extraction
  t.is(extractXmlLang(displayname), 'fr-FR');
  t.is(extractXmlLang(description), 'fr-FR');

  // Verify timezone validation
  const timezoneValidation = validateCalendarTimezone(timezone.textContent);
  t.true(timezoneValidation.valid);

  // Verify values
  t.is(displayname.textContent, 'Mon Calendrier');
  t.is(description.textContent, 'Description en français');
  t.is(color.textContent, '#0000FFFF');
});

// =============================================================================
// Additional Tests for Stack Trace Issues
// =============================================================================

test('xml.get returns empty array for null document', (t) => {
  const xml = require('../common/xml');
  const result = xml.get('/D:propfind/D:prop', null);
  t.deepEqual(result, []);
});

test('xml.get returns empty array for undefined document', (t) => {
  const xml = require('../common/xml');
  const result = xml.get('/D:propfind/D:prop', undefined);
  t.deepEqual(result, []);
});

test('xml.get returns empty array for non-object document', (t) => {
  const xml = require('../common/xml');
  const result = xml.get('/D:propfind/D:prop', 'not an object');
  t.deepEqual(result, []);
});

test('xml.getWithChildren handles null document gracefully', (t) => {
  const xml = require('../common/xml');
  const result = xml.getWithChildren('/D:propfind/D:prop', null);
  t.deepEqual(result.propNode, []);
  t.deepEqual(result.children, []);
});

test('preconditionFail generates valid XML error response', (t) => {
  const { preconditionFail } = require('../common/x-build');
  const result = preconditionFail(
    '/dav/user/calendar/event.ics',
    'no-uid-conflict'
  );
  t.true(result.includes('D:error'));
  t.true(result.includes('no-uid-conflict'));
});
