const xml = require('../../../common/xml');
const { build, multistatus, response, status } = require('../../../common/xBuild');
const _ = require('lodash');
const path = require('path');

module.exports = function(opts) {
  const log = require('../../../common/winston')({ ...opts, label: 'calendar/user/propfind' });
  const { calendarResponse } = require('../calendar/propfind')(opts);

  const tagActions = {
    /* https://tools.ietf.org/html/rfc3744#section-5.4 */
    // 'current-user-privilege-set': async () => {
    //   return {
    //     'D:current-user-privilege-set': {
    //       'D:privilege': [
    //         { 'D:read': '' },
    //         { 'D:read-acl': '' },
    //         { 'D:read-current-user-privilege-set': '' },
    //         { 'D:write': '' },
    //         { 'D:write-content': '' },
    //         { 'D:write-properties': '' },
    //         { 'D:bind': '' }, // PUT - https://tools.ietf.org/html/rfc3744#section-3.9
    //         { 'D:unbind': '' }, // DELETE - https://tools.ietf.org/html/rfc3744#section-3.10
    //         { 'CAL:read-free-busy': '' }, // https://tools.ietf.org/html/rfc4791#section-6.1.1
    //       ]
    //     }
    //   };
    // },
    /* https://tools.ietf.org/html/rfc3744#section-5.1 */
    // 'owner': async (ctx) => {
    //   return { 'D:owner': { 'D:href': path.join(opts.principalRoute, ctx.state.params.userId, '/') } };
    // },
    /* https://tools.ietf.org/html/rfc3744#section-5.8 */
    'principal-collection-set': async () => {
      return {
        'D:principal-collection-set': {
          'D:href': opts.principalRoute
        }
      };
    },
    /* https://tools.ietf.org/html/rfc3744#section-4.2 */
    'principal-URL': async (ctx) => {
      return { 'D:principal-URL': path.join(opts.principalRoute, ctx.state.params.userId, '/') };
    },
    /* https://tools.ietf.org/html/rfc4791#section-4.2 */
    'resourcetype': async () => {
      return { 'D:resourcetype': { 'D:collection': '' } };
    },
    /* https://tools.ietf.org/html/rfc3253#section-3.1.5 */
    'supported-report-set': async () => {
      return {
        'D:supported-report-set': {
          'D:supported-report': [
            { 'D:report': { 'CAL:sync-collection': '' } }
          ]
        }
      };
    },
  };

  const exec = async function(ctx) {
    const propNode = xml.get('/D:propfind/D:prop', ctx.request.xml);
    const children = propNode[0] ? propNode[0].childNodes : [];
    const checksum = _.some(children, (child) => child.localName === 'checksum-versions');

    const actions = _.map(children, async (child) => {
      const tag = child.localName;
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx);
    });
    const res = await Promise.all(actions);
    const props = _.compact(res);
    const responses = [response(ctx.url, props.length ? status[200] : status[404], props)];
    
    const calendars = await opts.getCalendarsForUser(ctx.state.params.userId);
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
