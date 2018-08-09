const log = require('../../../../lib/winston')('calendar/user/propfind');

const { splitPrefix } = require('../../../../lib/xParse');
const { build, multistatus, response, status } = require('../../../../lib/xBuild');
const _ = require('lodash');
const path = require('path');

module.exports = function(opts) {
  const { calendarResponse } = require('../../calendar/propfind/propfind')(opts);

  const tagActions = {
    /* https://tools.ietf.org/html/rfc3744#section-5.4 */
    'current-user-privilege-set': async () => {
      return {
        'D:current-user-privilege-set': {
          'D:privilege': [
            { 'D:read': '' },
            { 'D:read-acl': '' },
            { 'D:read-current-user-privilege-set': '' },
            { 'D:write': '' },
            { 'D:write-content': '' },
            { 'D:write-properties': '' },
            { 'CAL:read-free-busy': '' }, // https://tools.ietf.org/html/rfc4791#section-6.1.1
          ]
        }
      };
    },
    /* https://tools.ietf.org/html/rfc3744#section-5.1 */
    'owner': async (ctx) => {
      return { 'D:owner': { href: path.join(opts.principalRoute, ctx.state.params.userId) } };
    },
    /* https://tools.ietf.org/html/rfc3744#section-4.2 */
    'principal-URL': async (ctx) => {
      return { 'D:principal-URL': path.join(opts.principalRoute, ctx.state.params.userId) };
    },
    /* https://tools.ietf.org/html/rfc4791#section-4.2 */
    'resourcetype': async () => {
      return { 'D:resourcetype': { 'D:collection': '' } };
    },
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

  const exec = async function(ctx, reqXml) {
    const node = _.get(reqXml, 'A:propfind.A:prop[0]');
    const actions = _.map(node, async (v, k) => {
      const tag = splitPrefix(k);
      const tagAction = tagActions[tag];
      log.debug(`${tagAction ? 'hit' : 'miss'}: ${tag}`);
      if (!tagAction) { return null; }
      return await tagAction(ctx);
    });
    const res = await Promise.all(actions);
    
    const responses = [response(ctx.url, status[200], _.compact(res))];
    const calendars = await opts.getCalendarsForUser(ctx.state.params.userId);
    const calResponses = await Promise.all(calendars.map(async (cal) => {
      return calendarResponse(ctx, reqXml, cal);
    }));

    const ms = multistatus([...responses, ..._.compact(calResponses)]);
    return build(ms);
  };

  return {
    exec
  };
};
