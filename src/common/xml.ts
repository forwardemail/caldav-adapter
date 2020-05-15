import xpath from 'xpath';
import invert from 'lodash/invert';

export const namespaces = {
  D: 'DAV:',
  CAL: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  ICAL: 'http://apple.com/ns/ical/'
} as const;

const select = xpath.useNamespaces(namespaces);
export const get = function(path, doc) {
  return select(path, doc);
};

export const nsLookup = invert(namespaces);
