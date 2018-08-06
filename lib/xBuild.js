const xmlbuilder = require('xmlbuilder');

const build = module.exports.build = function(obj) {
  const doc = xmlbuilder.create(obj, { version: '1.0', encoding: 'UTF-8', noDoubleEncoding: true });
  return doc.end({ pretty: true });
};

const multistatus = module.exports.multistatus = function(responses) {
  const res = {
    'D:multistatus': {
      '@xmlns:D': 'DAV:',
      '@xmlns:CAL': 'urn:ietf:params:xml:ns:caldav',
      '@xmlns:CS': 'http://calendarserver.org/ns/',
      '@xmlns:ICAL': 'http://apple.com/ns/ical/'
    }
  };
  if (responses && responses.length) {
    res['D:multistatus']['D:response'] = responses;
  }
  return res;
};

const status = module.exports.status = {
  200: 'HTTP/1.1 200 OK',
  404: 'HTTP/1.1 404 Not Found'
};

const response = module.exports.response = function(href, status, props) {
  const res = {
    'D:href': href,
    'D:propstat': {
      'D:status': status
    }
  };
  if (props && props.length) {
    res['D:propstat']['D:prop'] = Object.assign({}, ...props);
  }
  return res;
};

module.exports.notFound = function(href) {
  return build(multistatus([response(href, status[404])]));
};
