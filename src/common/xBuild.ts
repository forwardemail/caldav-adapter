import { create } from 'xmlbuilder2';
import { nsLookup, namespaces } from './xml';
import mapKeys from 'lodash/mapKeys';

type XmlElement = {
  [tag: string]: any;
};

const nsMap = mapKeys(namespaces, (v, k) => {
  return `@xmlns:${k}`;
});

export const buildTag = function(namespaceURI: string, localName: string) {
  return `${nsLookup[namespaceURI]}:${localName}`;
};
export const href = function(url: string): XmlElement {
  return { [buildTag('DAV:', 'href')]: url };
};

export const build = function(obj: XmlElement) {
  const doc = create(obj, { version: '1.0', encoding: 'UTF-8', noDoubleEncoding: true });
  return doc.end({ prettyPrint: true });
};

export const multistatus = function(responses, other?: object) {
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

export const status = {
  200: 'HTTP/1.1 200 OK',
  403: 'HTTP/1.1 403 Forbidden',
  404: 'HTTP/1.1 404 Not Found'
} as const;

export const response = function(url: string, status: string, props?: object[]) {
  const res = href(url);
  res[buildTag('DAV:', 'propstat')] = [{
    [buildTag('DAV:', 'status')]: status
  }];
  if (props && props.length) {
    res[buildTag('DAV:', 'propstat')][0][buildTag('DAV:', 'prop')] = Object.assign({}, ...props);
  }
  return res;
};

export const missingPropstats = function(props) {
  return props.reduce((res, v) => {
    res[buildTag('DAV:', 'prop')][v] = '';
    return res;
  }, {
    [buildTag('DAV:', 'status')]: status[404],
    [buildTag('DAV:', 'prop')]: {}
  });
};

export const notFound = function(href: string) {
  return build(multistatus([response(href, status[404])]));
};

/* https://tools.ietf.org/html/rfc4791#section-5.3.2.1 */
export const preconditionFail = function(url: string, reason: string) {
  const res = {
    'D:error': Object.assign({
      [buildTag('urn:ietf:params:xml:ns:caldav', reason)]: url
    }, nsMap)
  };
  return build(res);
};
