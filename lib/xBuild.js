const xmlbuilder = require('xmlbuilder');

module.exports.build = function(obj) {
  const doc = xmlbuilder.create(obj, { version: '1.0', encoding: 'UTF-8'});
  return doc.end({ pretty: true });
};

const multistatus = module.exports.multistatus = function(responses) {
  return {
    'D:multistatus': {
      '@xmlns:D': 'DAV:',
      '@xmlns:cal': 'urn:ietf:params:xml:ns:caldav',
      '@xmlns:cs': 'http://calendarserver.org/ns/',
      'D:response': responses || []
    }
  };
};

module.exports.status = {
  OK: 'HTTP/1.1 200 OK'
};

const response = module.exports.response = function(href, status, props) {
  return {
    'D:href': href,
    'D:propstat': {
      'D:status': status,
      'D:prop': props || []
    }
  };
};
