import xpath from 'xpath';

export const namespaces = {
  D: 'DAV:',
  CAL: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  ICAL: 'http://apple.com/ns/ical/'
} as const;

export const nsLookup = {
  'DAV:': 'D',
  'urn:ietf:params:xml:ns:caldav': 'CAL',
  'http://calendarserver.org/ns/': 'CS',
  'http://apple.com/ns/ical/': 'ICAL'
} as const;

const select = xpath.useNamespaces(namespaces);

export const get = function<T extends Node>(path: string, doc: Document) {
  return select(path, doc) as T[];
};

export const getWithChildren = function(path: string, doc: Document) {
  const propNode = get<Element>('/D:propfind/D:prop', doc);
  const children = propNode[0] ? (Array.from(propNode[0].childNodes) as Element[]) : [];
  return { propNode, children };
};
