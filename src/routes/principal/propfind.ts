import * as xml from '../../common/xml';
import { build, multistatus, response, status } from '../../common/xBuild';
import _ from 'lodash';
import commonTags from '../../common/tags';
import { CalDavOptionsModule } from '../..';
import { Context } from 'koa';

export default function(opts: CalDavOptionsModule) {
  const tags = commonTags(opts);
  return async function(ctx: Context) {
    const { children } = xml.getWithChildren('/D:propfind/D:prop', ctx.request.xml);

    const actions = _.map(children, async (child) => {
      return await tags.getResponse({
        resource: 'principal',
        child,
        ctx
      });
    });
    const res = await Promise.all(actions);
    
    const resps = response(ctx.url, status[200], _.compact(res));
    const ms = multistatus([resps]);
    return build(ms);
  };
}
