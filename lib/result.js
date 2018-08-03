const setAllowHeader = module.exports.setAllowHeader = function(ctx) {
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

const setDAVHeader = module.exports.setDAVHeader = function(ctx) {
  ctx.set('DAV', [
    '1',
    // '2',
    '3',
    'extended-mkcol',
    'calendar-access',
    'calendar-schedule',
    'calendar-proxy',
    'calendarserver-sharing',
    'calendarserver-subscribed',
    'access-control',
    'calendarserver-principal-property-search'
  ].join(', '));
};

/* https://tools.ietf.org/html/rfc4791#section-5.1.1 */
module.exports.setOptions = function(ctx) {
  setAllowHeader(ctx);
  setDAVHeader(ctx);
  ctx.status = 200;
  ctx.body = '';
};
