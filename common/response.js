const setAllowHeader = function (ctx, methods = []) {
  ctx.set('Allow', methods.join(', '));
};

const setDAVHeader = function (ctx) {
  ctx.set(
    'DAV',
    [
      '1',
      // '2',
      '3',
      // 'extended-mkcol',
      'calendar-access',
      'calendar-schedule'
      // 'calendar-auto-schedule',
      /* https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-proxy.txt */
      // 'calendar-proxy',
      // 'calendarserver-sharing',
      // 'calendarserver-subscribed',
      // 'access-control',
      /* https://tools.ietf.org/html/rfc3744#section-9.4 */
      // 'calendarserver-principal-property-search'
    ].join(', ')
  );
};

const setXMLHeader = function (ctx) {
  ctx.set('Content-Type', 'application/xml; charset="utf-8"');
};

module.exports = {};

/* https://tools.ietf.org/html/rfc4791#section-5.1.1 */
module.exports.setOptions = function (ctx, methods = []) {
  ctx.status = 200;
  setAllowHeader(ctx, methods);
  setDAVHeader(ctx);
  ctx.body = '';
};

/* https://tools.ietf.org/html/rfc4791#section-7.8.1 */
module.exports.setMultistatusResponse = function (ctx) {
  ctx.status = 207;
  setDAVHeader(ctx);
  setXMLHeader(ctx);
};

module.exports.setMissingMethod = function (ctx) {
  ctx.status = 404;
  ctx.set('Content-Type', 'text/html; charset="utf-8"');
};
