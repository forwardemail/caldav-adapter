const log = require('../../lib/winston')('principal/report');

const { splitPrefix } = require('../../lib/xParse');
const { build, notFound } = require('../../lib/xBuild');

module.exports = function() {
  return async function(ctx, reqXml) {
    const root = Object.keys(reqXml)[0];
    const rootTag = splitPrefix(root);
    if (rootTag === 'principal-search-property-set') {
      log.debug('principal-search-property-set');
      /* https://tools.ietf.org/html/rfc3744#section-9.5 */
      return build({
        'D:principal-search-property-set': {
          '@xmlns:D': 'DAV:'
        }
      });
    } else {
      return notFound(ctx.url);
    }
  };
};
