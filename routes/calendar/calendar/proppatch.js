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

    const updates = {};
    for (const child of children) {
      if (!child.localName || !child.textContent) continue;
      switch (child.localName) {
        case 'displayname': {
          updates.name = child.textContent;

          break;
        }

        case 'calendar-description': {
          updates.description = child.textContent;

          break;
        }

        case 'calendar-timezone': {
          updates.timezone = child.textContent;

          break;
        }

        case 'calendar-color': {
          updates.color = child.textContent;

          break;
        }

        case 'calendar-order': {
          updates.order = Number.parseInt(child.textContent, 10);

          break;
        }

        // TODO: finish me

        // No default
      }
    }

    //
    // if updates was empty then we should log so we can alert admins
    // as to what other properties clients are attempting to update
    // (this code is an anti-pattern but temporary so we can improve)
    //
    if (_.isEmpty(updates)) {
      const err = new TypeError('CalDAV PROPPATCH missing fields');
      err.isCodeBug = true; // Specific to Forward Email (can be removed later)
      err.str = ctx.request.body; // Sensitive and should be removed later
      err.xml = ctx.request.xml;
      console.error(err);
      if (ctx.logger) ctx.logger.error(err);
    }

    const updatedCalendar = await options.data.updateCalendar(ctx, {
      principalId: ctx.state.params.principalId,
      calendarId: ctx.state.params.calendarId,
      user: ctx.state.user,
      updates
    });

    const actions = _.map(children, async (child) => {
      return tags.getResponse({
        resource: 'calendarProppatch',
        child,
        ctx,
        calendar: updatedCalendar
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
