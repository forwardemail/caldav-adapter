const xmlbuilder = require('xmlbuilder');
const { nsLookup, namespaces } = require('./xml');
const _ = require('lodash');

const buildTag = module.exports.buildTag = function(namespaceURI, localName) {
  return `${nsLookup[namespaceURI]}:${localName}`;
};
const href = module.exports.href = function(url) {
  return { [buildTag('DAV:', 'href')]: url };
};

const build = module.exports.build = function(obj) {
  const doc = xmlbuilder.create(obj, { version: '1.0', encoding: 'UTF-8', noDoubleEncoding: true });
  return doc.end({ pretty: true });
};

const nsMap = _.mapKeys(namespaces, (v, k) => {
  return `@xmlns:${k}`;
});

const multistatus = module.exports.multistatus = function(responses, other) {
  const res = {
    [buildTag('DAV:', 'multistatus')]: nsMap
  };
  if (responses && responses.length) {
    res[buildTag('DAV:', 'multistatus')][buildTag('DAV:', 'response')] = responses;
  }
  if (other) {
    res[buildTag('DAV:', 'multistatus')] = Object.assign(res[buildTag('DAV:', 'multistatus')], other);
  }
  return res;
};

const status = module.exports.status = {
  200: 'HTTP/1.1 200 OK',
  403: 'HTTP/1.1 403 Forbidden',
  404: 'HTTP/1.1 404 Not Found'
};

const response = module.exports.response = function(url, status, props) {
  const res = href(url);
  res[buildTag('DAV:', 'propstat')] = [{
    [buildTag('DAV:', 'status')]: status
  }];
  if (props && props.length) {
    res[buildTag('DAV:', 'propstat')][0][buildTag('DAV:', 'prop')] = Object.assign({}, ...props);
  }
  return res;
};

module.exports.missingPropstats = function(props) {
  return props.reduce((res, v) => {
    res[buildTag('DAV:', 'prop')][v] = '';
    return res;
  }, {
    [buildTag('DAV:', 'status')]: status[404],
    [buildTag('DAV:', 'prop')]: {}
  });
};

module.exports.notFound = function(href) {
  return build(multistatus([response(href, status[404])]));
};

/* https://tools.ietf.org/html/rfc4791#section-5.3.2.1 */
module.exports.preconditionFail = function(url, reason) {
  const res = {
    'D:error': Object.assign({
      [buildTag('urn:ietf:params:xml:ns:caldav', reason)]: url
    }, nsMap)
  };
  return build(res);
};
