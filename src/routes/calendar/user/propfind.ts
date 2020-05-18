import * as xml from '../../../common/xml';
import { build, multistatus, response, status } from '../../../common/xBuild';
import _ from 'lodash';
import calPropfind from '../calendar/propfind';
import commonTags from '../../../common/tags';
import { CalDavOptionsModule } from '../../..';
import { Context } from 'koa';

export default function(opts: CalDavOptionsModule) {
  const { calendarResponse } = calPropfind(opts);
  const tags = commonTags(opts);

  const exec = async function(ctx: Context) {
    const { children } = xml.getWithChildren('/D:propfind/D:prop', ctx.request.xml);
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
}
