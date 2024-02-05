const xpath = require('xpath');

module.exports = {};

const namespaces = {
  D: 'DAV:',
  CAL: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  ICAL: 'http://apple.com/ns/ical/'
};
module.exports.namespaces = namespaces;

const nsLookup = {
  'DAV:': 'D',
  'urn:ietf:params:xml:ns:caldav': 'CAL',
  'http://calendarserver.org/ns/': 'CS',
  'http://apple.com/ns/ical/': 'ICAL'
};
module.exports.nsLookup = nsLookup;

const select = xpath.useNamespaces(namespaces);

function get(path, doc) {
  return select(path, doc);
}

module.exports.get = get;

function getWithChildren(path, doc) {
  const propNode = get(path, doc);
  // eslint-disable-next-line unicorn/prefer-spread
  const children = propNode[0] ? Array.from(propNode[0].childNodes) : [];
  return { propNode, children };
}

module.exports.getWithChildren = getWithChildren;
