const ical = require('ical-generator');
const moment = require('moment');
const _ = require('lodash');

module.exports = function(opts) {
  return {
    buildICS: function(event, calendar) {
      const cal = ical({
        domain: opts.domain,
        prodId: opts.proId,
        timezone: calendar.timeZone,
        events: [{
          id: event.eventId,
          sequence: 1,
          start: moment.unix(event.startDate).utc().toDate(),
          end: moment.unix(event.endDate).utc().toDate(),
          summary: event.summary,
          location: event.location,
          description: event.description,
          role: 'req-participant',
          rsvp: true
        }]
      });
      const inviteTxt = cal.toString().replace(`@${opts.domain}`, '');
      const formatted = _.map(inviteTxt.split('\r\n'), (line) => {
        return line.match(/(.{1,74})/g).join('\r\n\ ');
      }).join('\r\n');
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
