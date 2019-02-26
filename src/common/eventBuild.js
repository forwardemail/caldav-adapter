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
      if (event.recurring) {
        evt.repeating = {
          freq: event.recurring.freq
        };
        if (event.recurring.until) {
          evt.repeating.until = moment(event.recurring.until).toDate();
        }
        if (event.recurring.exdate && event.recurring.exdate.length) {
          evt.repeating.exclude = event.recurring.exdate.map((e) => moment(e).toDate());
        }
      }
      const events = [evt];
      if (event.recurrences && event.recurrences.length) {
        events.push(...event.recurrences.map((r) => {
          const rCategories = !r.categories ? null : r.categories.map((c) => {
            return { name: c };
          });
          return {
            id: event.eventId,
            recurrenceId: r.recurrenceId,
            sequence: 1,
            start: moment(r.startDate).toDate(),
            end: moment(r.endDate).toDate(),
            summary: r.summary,
            location: r.location,
            description: r.description,
            htmlDescription: r.htmlDescription,
            url: r.url,
            categories: rCategories,
            alarms: r.alarms,
            created: r.createdOn,
            lastModified: r.lastModifiedOn,
            timezone: r.timeZone || event.timeZone || calendar.timeZone,
          };
        }));
      }
      const cal = ical({
        domain: FIXED_DOMAIN,
        prodId: opts.proId,
        timezone: calendar.timeZone,
        events: events
      });
      const regex = new RegExp(`@${FIXED_DOMAIN}`, 'g');
      const inviteTxt = cal.toString().replace(regex, '');
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
        timeZone: parsed.start.tz,
        createdOn: date.formatted(parsed.dtstamp),
        lastModifiedOn: date.formatted(parsed.lastmodified),
        ical: ical
      };
      if (parsed.rrule) {
        obj.recurring = {
          freq: parsed.rrule.constructor.FREQUENCIES[parsed.rrule.origOptions.freq]
        };
        if (parsed.rrule.origOptions.until) {
          obj.recurring.until = date.formatted(parsed.rrule.origOptions.until);
        }
      }
      if (parsed.exdate && Object.values(parsed.exdate).length) {
        obj.recurring.exdate = Object.values(parsed.exdate).map((ex) => {
          return date.formatted(ex);
        });
      }
      if (parsed.recurrences && Object.values(parsed.recurrences).length) {
        obj.recurrences = Object.values(parsed.recurrences).map((r) => {
          return {
            recurrenceId: date.formatted(r.recurrenceid),
            summary: r.summary,
            location: r.location,
            description: r.description,
            startDate: date.formatted(r.start),
            endDate: date.formatted(r.end),
            timeZone: r.start.tz,
            createdOn: date.formatted(parsed.dtstamp),
            lastModifiedOn: date.formatted(parsed.lastmodified)
          };
        });
      }
      return obj;
    }
  };
};
