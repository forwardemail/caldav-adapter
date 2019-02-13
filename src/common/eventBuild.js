const ical = require('ical-generator');
const moment = require('moment');
const _ = require('lodash');

const FIXED_DOMAIN = 'DOMAIN_TO_REMOVE';

module.exports = function(opts) {
  return {
    buildICS: function(event, calendar) {
      const categories = !event.categories ? null : event.categories.map((c) => {
        return { name: c };
      });
      const evt = {
        id: event.eventId,
        sequence: 1,
        start: moment.unix(event.startDate).utc().toDate(),
        end: moment.unix(event.endDate).utc().toDate(),
        summary: event.summary,
        location: event.location,
        description: event.description,
        htmlDescription: event.htmlDescription,
        url: event.url,
        categories: categories,
        alarms: event.alarms,
        created: event.createdOn,
        lastModified: event.lastModifiedOn,
        role: 'req-participant',
        rsvp: true
      };
      if (event.weekly) {
        evt.repeating = {
          freq: 'WEEKLY'
        };
        if (event.until) {
          evt.repeating.until = moment.unix(event.until).utc().toDate();
        }
        if (event.exdate && event.exdate.length) {
          evt.repeating.exclude = event.exdate.map((e) => moment.unix(e).utc().toDate());
        }
      }
      const cal = ical({
        domain: FIXED_DOMAIN,
        prodId: opts.proId,
        timezone: calendar.timeZone,
        events: [evt]
      });
      const inviteTxt = cal.toString().replace(`@${FIXED_DOMAIN}`, '');
      const formatted = _.map(inviteTxt.split('\r\n'), (line) => {
        return line.match(/(.{1,74})/g).join('\n\ ');
      }).join('\n');
      return formatted;
    },
    buildObj: function(ical, parsed, calendar) {
      const obj = {
        eventId: parsed.uid,
        calendarId: calendar.calendarId,
        summary: parsed.summary,
        location: parsed.location,
        description: parsed.description,
        startDate: moment(parsed.start).unix(),
        endDate: moment(parsed.end).unix(),
        createdOn: moment().unix(),
        ical: ical
      };
      if (parsed.rrule.origOptions.freq === 2) {
        obj.weekly = true;
        if (parsed.rrule.origOptions.until) {
          obj.until = moment(parsed.rrule.origOptions.until).unix();
        }
      }
      if (parsed.exdate && Object.values(parsed.exdate).length) {
        obj.exdate = Object.values(parsed.exdate).map((e) => moment(e).unix());
      }
      return obj;
    }
  };
};
