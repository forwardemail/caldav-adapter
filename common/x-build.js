const { create } = require('xmlbuilder2');
const mapKeys = require('lodash/mapKeys');
const { nsLookup, namespaces } = require('./xml');

module.exports = {};

const nsMap = function () {
  return mapKeys(namespaces, (v, k) => {
    return `@xmlns:${k}`;
  });
};

function buildTag(namespaceURI, localName) {
  return `${nsLookup[namespaceURI]}:${localName}`;
}

module.exports.buildTag = buildTag;

function href(url) {
  return { [buildTag('DAV:', 'href')]: url };
}

module.exports.href = href;

function build(object) {
  const doc = create(object, {
    version: '1.0',
    // eslint-disable-next-line unicorn/text-encoding-identifier-case
    encoding: 'UTF-8',
    noDoubleEncoding: true
  });
  return doc.end({ prettyPrint: true });
}

module.exports.build = build;

function multistatus(responses, other) {
  const res = {
    [buildTag('DAV:', 'multistatus')]: nsMap()
  };
  if (responses?.length) {
    res[buildTag('DAV:', 'multistatus')][buildTag('DAV:', 'response')] =
      responses;
  }

  if (other) {
    res[buildTag('DAV:', 'multistatus')] = Object.assign(
      res[buildTag('DAV:', 'multistatus')],
      other
    );
  }

  return res;
}

module.exports.multistatus = multistatus;

const status = {
  200: 'HTTP/1.1 200 OK',
  403: 'HTTP/1.1 403 Forbidden',
  404: 'HTTP/1.1 404 Not Found'
};
module.exports.status = status;

function response(url, status, props, deleted) {
  const res = href(url);
  if (deleted) {
    res[buildTag('DAV:', 'status')] = status;
    return res;
  }

  res[buildTag('DAV:', 'propstat')] = [
    {
      [buildTag('DAV:', 'status')]: status
    }
  ];
  if (props && props.length > 0) {
    res[buildTag('DAV:', 'propstat')][0][buildTag('DAV:', 'prop')] =
      Object.assign({}, ...props);
  }

  return res;
}

module.exports.response = response;

module.exports.missingPropstats = function (props) {
  // eslint-disable-next-line unicorn/no-array-reduce
  return props.reduce(
    (res, v) => {
      res[buildTag('DAV:', 'prop')][v] = '';
      return res;
    },
    {
      [buildTag('DAV:', 'status')]: status[404],
      [buildTag('DAV:', 'prop')]: {}
    }
  );
};

module.exports.notFound = function (href) {
  return build(multistatus([response(href, status[404])]));
};

/* https://tools.ietf.org/html/rfc4791#section-5.3.2.1 */
module.exports.preconditionFail = function (url, reason) {
  const res = {
    'D:error': {
      [buildTag('urn:ietf:params:xml:ns:caldav', reason)]: url,
      ...nsMap()
    }
  };
  return build(res);
};
