const xml2js = require('libxmljs');

module.exports.parse = function(str) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(str, (err, res) => {
      if (err) { return reject(err); }
      return resolve(res);
    });
  });
};

module.exports.get = function(xml, path) {
  return xml.get(path, {
    A: 'DAV:',
    B: 'urn:ietf:params:xml:ns:caldav',
    C: 'http://calendarserver.org/ns/',
    D: 'http://apple.com/ns/ical/',
    E: 'http://me.com/_namespace/'
  });
};
