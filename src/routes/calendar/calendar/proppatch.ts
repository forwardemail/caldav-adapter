import * as xml from '../../../common/xml';
import { build, multistatus } from '../../../common/xBuild';
import _ from 'lodash';
import commonTags from '../../../common/tags';
import { CalDavOptionsModule, CalDavCalendar } from '../../..';
import { Context } from 'koa';

export default function(opts: CalDavOptionsModule) {
  const tags = commonTags(opts);

  const exec = async function(ctx: Context, calendar: CalDavCalendar) {
    const { children } = xml.getWithChildren('/D:propertyupdate/D:set/D:prop', ctx.request.xml);

    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
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
}
