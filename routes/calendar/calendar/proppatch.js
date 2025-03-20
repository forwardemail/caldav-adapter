const _ = require('lodash');
const xml = require('../../../common/xml');
const { build, multistatus } = require('../../../common/x-build');
const { setMissingMethod } = require('../../../common/response');
const commonTags = require('../../../common/tags');

module.exports = function (options) {
  const tags = commonTags(options);

  const exec = async function (ctx, calendar) {
    if (calendar.readonly) {
      setMissingMethod(ctx);
      return;
    }

    const { children } = xml.getWithChildren(
      '/D:propertyupdate/D:set/D:prop',
      ctx.request.xml
    );

    const actions = _.map(children, async (child) => {
      return tags.getResponse({
        resource: 'calendarProppatch',
        child,
        ctx,
        calendar
      });
    });
    const res = await Promise.all(actions);

    const ms = multistatus(_.compact(res));
    return build(ms);
  };

  return {
    exec
  };
};
