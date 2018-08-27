const xpath = require('xpath');
const select = xpath.useNamespaces({
  D: 'DAV:',
  CAL: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  ICAL: 'http://apple.com/ns/ical/'
});

module.exports.get = function(path, doc) {
  return select(path, doc);
};

