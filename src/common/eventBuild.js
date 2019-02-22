const ical = require('ical-generator');
const moment = require('moment');
const date = require('../common/date');
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
        start: moment(event.startDate).toDate(),
        end: moment(event.endDate).toDate(),
        summary: event.summary,
        location: event.location,
        description: event.description,
        htmlDescription: event.htmlDescription,
        url: event.url,
        categories: categories,
        alarms: event.alarms,
        created: event.createdOn,
        lastModified: event.lastModifiedOn,
        timezone: event.timeZone || calendar.timeZone,
        role: 'req-participant',
        rsvp: true
      };
      if (event.weekly) {
        evt.repeating = {
          freq: 'WEEKLY'
        };
        if (event.until) {
          evt.repeating.until = moment(event.until).toDate();
        }
        if (event.exdate && event.exdate.length) {
          evt.repeating.exclude = event.exdate.map((e) => moment(e).toDate());
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
        startDate: date.formatted(parsed.start),
        endDate: date.formatted(parsed.end),
        createdOn: date.formatted(),
        ical: ical
      };
      if (parsed.rrule && parsed.rrule.origOptions.freq === 2) {
        obj.weekly = true;
        if (parsed.rrule.origOptions.until) {
          obj.until = date.formatted(parsed.rrule.origOptions.until);
        }
      }
      if (parsed.exdate && Object.values(parsed.exdate).length) {
        obj.exdate = Object.values(parsed.exdate).map((ex) => {
          return date.formatted(ex);
        });
      }
      if (parsed.recurrences && Object.values(parsed.recurrences).length) {
        obj.recurrences = Object.values(parsed.recurrences).map((r) => {
          return {
            recurrenceid: date.formatted(r.recurrenceid),
            summary: r.summary,
            location: r.location,
            description: r.description,
            startDate: date.formatted(r.start),
            endDate: date.formatted(r.end),
            createdOn: date.formatted()
          };
        });
      }
      return obj;
    }
  };
};
