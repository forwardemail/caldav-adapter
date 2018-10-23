const xpath = require('xpath');
const _ = require('lodash');

const namespaces = {
  D: 'DAV:',
  CAL: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  ICAL: 'http://apple.com/ns/ical/'
};

const select = xpath.useNamespaces(namespaces);
module.exports.get = function(path, doc) {
  return select(path, doc);
};

module.exports.nsLookup = _.invert(namespaces);
