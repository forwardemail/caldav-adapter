const log = require('../../lib/winston')('principal/report');

const { splitPrefix } = require('../../lib/util');
const { build, multistatus, notFound } = require('../../lib/xBuild');

module.exports = function() {
  return async function(ctx) {
    const root = Object.keys(ctx.request.xml)[0];
    const rootTag = splitPrefix(root);
    if (rootTag === 'principal-search-property-set') {
      log.debug('principal-search-property-set');
      /* https://tools.ietf.org/html/rfc3744#section-9.5 */
      return build({
        'D:principal-search-property-set': {
          '@xmlns:D': 'DAV:'
        }
      });
    } else if (rootTag === 'principal-property-search') {
      log.debug('principal-property-search');
      /* https://tools.ietf.org/html/rfc3744#section-9.4 */
      const blank = multistatus();
      return build(blank);
    } else {
      return notFound(ctx.url);
    }
  };
};
