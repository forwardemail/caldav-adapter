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
        lastModified: event.lastModifiedOn || undefined,
        timezone: event.timeZone || calendar.timeZone,
        role: 'req-participant',
        rsvp: true
      };
      const recur = [];
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
        if (event.recurring.recurrences && event.recurring.recurrences.length) {
          recur.push(...event.recurring.recurrences.map((r) => {
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
              lastModified: r.lastModifiedOn || undefined,
              timezone: r.timeZone || event.timeZone || calendar.timeZone,
            };
          }));
        }
      }
      const events = [evt, ...recur];
      
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
        startDate: parsed.start ? date.formatted(parsed.start) : null,
        endDate: parsed.end ? date.formatted(parsed.end) : null,
        duration: parsed.duration,
        timeZone: parsed.start.tz,
        createdOn: parsed.dtstamp ? date.formatted(parsed.dtstamp) : null,
        lastModifiedOn: parsed.lastmodified ? date.formatted(parsed.lastmodified) : null,
        ical: ical
      };
      if (!obj.endDate && obj.duration) {
        const end = moment(parsed.start).add(moment.duration(obj.duration));
        obj.endDate = date.formatted(end);
      }
      if (parsed.rrule) {
        obj.recurring = {
          freq: parsed.rrule.constructor.FREQUENCIES[parsed.rrule.origOptions.freq]
        };
        if (parsed.rrule.origOptions.until) {
          obj.recurring.until = date.formatted(parsed.rrule.origOptions.until);
        }
        if (parsed.exdate && Object.values(parsed.exdate).length) {
          obj.recurring.exdate = Object.values(parsed.exdate).map((ex) => {
            return date.formatted(ex);
          });
        }
        if (parsed.recurrences && Object.values(parsed.recurrences).length) {
          obj.recurring.recurrences = Object.values(parsed.recurrences).map((r) => {
            const rObj = {
              recurrenceId: date.formatted(r.recurrenceid),
              summary: r.summary,
              location: r.location,
              description: r.description,
              startDate: r.start ? date.formatted(r.start) : null,
              endDate: r.end ? date.formatted(r.end) : null,
              duration: r.duration,
              timeZone: r.start.tz,
              createdOn: parsed.dtstamp ? date.formatted(parsed.dtstamp) : null,
              lastModifiedOn: parsed.lastmodified ? date.formatted(parsed.lastmodified) : null
            };
            if (!rObj.endDate && rObj.duration) {
              const end = moment(r.start).add(moment.duration(rObj.duration));
              rObj.endDate = date.formatted(end);
            }
          });
        }
      }
      return obj;
    }
  };
};
