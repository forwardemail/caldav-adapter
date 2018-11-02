const xml = require('../../../common/xml');
const { build, multistatus, response, status } = require('../../../common/xBuild');
const _ = require('lodash');

module.exports = function(opts) {
  const { calendarResponse } = require('../calendar/propfind')(opts);
  const tags = require('../../../common/tags')(opts);

  const exec = async function(ctx) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];
    const checksum = _.some(children, (child) => child.localName === 'checksum-versions');

    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
        resource: 'calCollection',
        child,
        ctx
      });
    });
    const res = await Promise.all(actions);
    const props = _.compact(res);
    const responses = [response(ctx.url, props.length ? status[200] : status[404], props)];
    
    const calendars = await opts.data.getCalendarsForPrincipal({
      principalId: ctx.state.params.principalId,
      user: ctx.state.user
    });
    const calResponses = !checksum ? await Promise.all(calendars.map(async (cal) => {
      return await calendarResponse(ctx, cal);
    })) : [];

    const ms = multistatus([...responses, ..._.compact(calResponses)]);
    return build(ms);
  };

  return {
    exec
  };
};
