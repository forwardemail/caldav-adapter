const { build, multistatus, notFound } = require('../../common/xBuild');

module.exports = function(opts) {
  const log = require('../../common/winston')({ ...opts, label: 'principal/report' });
  return async function(ctx) {
    const rootTag = ctx.request.xml.documentElement.localName;
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
