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
        createdOn: moment(parsed.created).unix(),
        ical: ical
      };
      return obj;
    }
  };
};
