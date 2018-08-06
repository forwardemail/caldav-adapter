const setAllowHeader = function(ctx) {
  ctx.set('Allow', [
    'OPTIONS',
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'DELETE',
    'COPY',
    'MOVE',
    'PROPFIND',
    'PROPPATCH',
    'REPORT'
  ].join(', '));
};

const setDAVHeader = function(ctx) {
  ctx.set('DAV', [
    '1',
    // '2',
    '3',
    'extended-mkcol',
    'calendar-access',
    'calendar-schedule',
    /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-proxy.txt */
    // 'calendar-proxy',
    'calendarserver-sharing',
    'calendarserver-subscribed',
    'access-control',
    'calendarserver-principal-property-search'
  ].join(', '));
};

const setXMLHeader = function(ctx) {
  ctx.set('Content-Type', 'application/xml; charset="utf-8"');
};

/* https://tools.ietf.org/html/rfc4791#section-5.1.1 */
module.exports.setOptions = function(ctx) {
  ctx.status = 200;
  setAllowHeader(ctx);
  setDAVHeader(ctx);
  ctx.body = '';
};

/* https://tools.ietf.org/html/rfc4791#section-7.8.1 */
module.exports.setMultistatusResponse = function(ctx) {
  ctx.status = 207;
  setDAVHeader(ctx);
  setXMLHeader(ctx);
};
