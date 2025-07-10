const {
  build,
  multistatus,
  response,
  status,
  href,
  buildTag
} = require('../../common/x-build');

module.exports = function (_options) {
  return async function (ctx) {
    // GET requests to principals should return the current user principal
    // This is what CalDAV clients expect when they follow redirects from root URL

    const principalInfo = [
      {
        [buildTag('DAV:', 'current-user-principal')]: href(
          ctx.state.principalUrl
        )
      }
    ];

    const resps = response(ctx.url, status[200], principalInfo);
    const ms = multistatus([resps]);
    return build(ms);
  };
};
