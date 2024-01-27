import ical, { EventData } from 'ical-generator';
import moment from 'moment';
import { formatted } from '../common/date';
import { CalDavOptionsModule, CalDavEvent, CalDavCalendar } from '..';
import { CalendarComponent } from 'ical';
import { RRule } from 'rrule';

const FIXED_DOMAIN = 'DOMAIN_TO_REMOVE';

/**
 * Adapted from https://github.com/sebbo2002/ical-generator
 * Thanks to @HeikoTheissen.
 */
const foldLines = function(input: string) {
  return input.split('\r\n').map((line) => {
    let result = '';
    let c = 0;
    for (let i = 0; i < line.length; i++) {
      let ch = line.charAt(i);

      // surrogate pair, see https://mathiasbynens.be/notes/javascript-encoding#surrogate-pairs
      if (ch >= '\ud800' && ch <= '\udbff') {
        ch += line.charAt(++i);
      }

      const charsize = Buffer.from(ch).length;
      c += charsize;
      if (c > 74) {
        result += '\r\n ';
        c = charsize;
      }

      result += ch;
    }
    return result;
  }).join('\r\n');
};

export default function(opts: CalDavOptionsModule) {
  return {
    buildICS: function(event: CalDavEvent, calendar: CalDavCalendar) {
      // const categories = !event.categories ? null : event.categories.map((c) => {
      //   return { name: c };
      // });
      const evt: EventData = {
        id: event.eventId,
        sequence: 1,
        start: moment(event.startDate).toDate(),
        end: moment(event.endDate).toDate(),
        summary: event.summary,
        location: event.location,
        description: event.description,
        htmlDescription: event.htmlDescription,
        url: event.url,
        // categories: categories,
        alarms: event.alarms,
        created: moment(event.createdOn).toDate(),
        lastModified: event.lastModifiedOn ? moment(event.createdOn).toDate() : undefined,
        timezone: event.timeZone || calendar.timeZone,
        // role: 'REQ-PARTICIPANT',
        // rsvp: true
      };
      const recur: EventData[] = [];
      if (event.recurring) {
        evt.repeating = {
          // @ts-ignore
          freq: event.recurring.freq
        };
        if (event.recurring.until) {
          evt.repeating.until = moment(event.recurring.until).toDate();
        }
        if (event.recurring.exdate?.length) {
          evt.repeating.exclude = event.recurring.exdate.map((e) => moment(e).toDate());
        }
        if (event.recurring.recurrences?.length) {
          recur.push(...event.recurring.recurrences.map((r) => {
            // const rCategories = !r.categories ? null : r.categories.map((c) => {
            //   return { name: c };
            // });
            const rEvent: EventData = {
              id: event.eventId,
              recurrenceId: moment(r.recurrenceId).toDate(),
              sequence: 1,
              start: moment(r.startDate).toDate(),
              end: moment(r.endDate).toDate(),
              summary: r.summary,
              location: r.location,
              description: r.description,
              htmlDescription: r.htmlDescription,
              url: r.url,
              // categories: rCategories,
              alarms: r.alarms,
              created: moment(r.createdOn).toDate(),
              lastModified: r.lastModifiedOn ? moment(r.lastModifiedOn).toDate() : undefined,
              timezone: r.timeZone || event.timeZone || calendar.timeZone,
            };
            return rEvent;
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
      const formatted = foldLines(inviteTxt);
      return formatted;
    },
    buildObj: function(ical, parsed: CalendarComponent, calendar: CalDavCalendar) {
      const obj: CalDavEvent = {
        eventId: parsed.uid,
        calendarId: calendar.calendarId,
        summary: parsed.summary,
        location: parsed.location,
        description: parsed.description,
        startDate: parsed.start ? formatted(parsed.start) : null,
        endDate: parsed.end ? formatted(parsed.end) : null,
        duration: parsed.duration ? parsed.duration.toString() : null,
        // @ts-ignore
        timeZone: parsed.start.tz,
        createdOn: parsed.dtstamp ? formatted(parsed.dtstamp) : null,
        lastModifiedOn: parsed.lastmodified ? formatted(parsed.lastmodified) : null,
        ical: ical
      };
      if (!obj.endDate && obj.duration) {
        const end = moment(parsed.start).add(moment.duration(obj.duration));
        obj.endDate = formatted(end);
      }
      if (parsed.rrule) {
        obj.recurring = {
          freq: RRule.FREQUENCIES[parsed.rrule.origOptions.freq]
        };
        if (parsed.rrule.origOptions.until) {
          obj.recurring.until = formatted(parsed.rrule.origOptions.until);
        }
        if (parsed.exdate && Object.values(parsed.exdate).length) {
          obj.recurring.exdate = Object.values(parsed.exdate).map((ex) => {
            return formatted(ex);
          });
        }
        if (parsed.recurrences && Object.values(parsed.recurrences).length) {
          obj.recurring.recurrences = Object.values(parsed.recurrences).map((r) => {
            const rObj = {
              recurrenceId: formatted(r.recurrenceid),
              summary: r.summary,
              location: r.location,
              description: r.description,
              startDate: r.start ? formatted(r.start) : null,
              endDate: r.end ? formatted(r.end) : null,
              duration: r.duration ? r.duration.toString() : null,
              // @ts-ignore
              timeZone: r.start.tz,
              createdOn: parsed.dtstamp ? formatted(parsed.dtstamp) : null,
              lastModifiedOn: parsed.lastmodified ? formatted(parsed.lastmodified) : null
            };
            if (!rObj.endDate && rObj.duration) {
              const end = moment(r.start).add(moment.duration(rObj.duration));
              rObj.endDate = formatted(end);
            }
            return rObj;
          });
        }
      }
      return obj;
    }
  };
}
