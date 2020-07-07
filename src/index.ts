import { AlarmData } from 'ical-generator';

export type CalDavAuthPrincipal = {
  principalId: string;
  principalName: string;
};
export type CalDavCalendar = {
  calendarId: string;
  ownerId?: string;
  calendarName: string;
  timeZone: string;
  order: number;
  readOnly: boolean;
  color?: string;
  syncToken: string;
  createdOn?: string;
};
export type CalDavRecurrence = {
  recurrenceId: string;
  summary?: string;
  location?: string;
  description: string;
  htmlDescription?: string;
  url?: string;
  categories?: string[];
  alarms?: AlarmData[];
  startDate: string;
  endDate: string;
  timeZone: string;
  createdOn?: string;
  lastModifiedOn?: string;
  status?: string;
};
export type CalDavRecurring = {
  freq: 'SECONDLY' | 'MINUTELY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY';
  until?: string;
  exdate?: string[];
  recurrences?: CalDavRecurrence[];
};
export type CalDavEvent = {
  eventId: string;
  calendarId?: string;
  summary: string;
  location?: string;
  description: string;
  htmlDescription?: string;
  url?: string;
  allDay?: boolean,
  status?: string,
  categories?: string[];
  alarms?: AlarmData[];
  startDate: string;
  endDate: string;
  duration?: string;
  timeZone?: string;
  createdOn: string;
  lastModifiedOn: string;
  ical?: string;
  recurring?: CalDavRecurring;
};
export type CalDavAuthenticate = (opts: {
  username: string,
  password: string,
  principalId: string
}) => Promise<CalDavAuthPrincipal>;
export type CalDavGetCalendar = (opts: {
  calendarId: string,
  principalId: string,
  user: any
}) => Promise<CalDavCalendar>;
export type CalDavGetCalendarsForPrincipal = (opts: {
  principalId: string,
  user: any
}) => Promise<CalDavCalendar[]>;
export type CalDavGetEventsForCalendar = (opts: {
  calendarId: string,
  principalId: string,
  fullData: boolean,
  user: any
}) => Promise<CalDavEvent[]>;
export type CalDavGetEventsByDate = (opts: {
  calendarId: string,
  principalId: string,
  start: string,
  end: string,
  fullData: boolean,
  user: any
}) => Promise<CalDavEvent[]>;
export type CalDavGetEvent = (opts: {
  eventId: string,
  calendarId: string,
  principalId: string,
  fullData: boolean,
  user: any
}) => Promise<CalDavEvent>;
export type CalDavCreateEvent = (opts: {
  event: CalDavEvent,
  calendarId: string,
  principalId: string,
  user: any
}) => Promise<CalDavEvent>;
export type CalDavUpdateEvent = (opts: {
  event: CalDavEvent,
  calendarId: string,
  principalId: string,
  user: any
}) => Promise<CalDavEvent>;
export type CalDavDeleteEvent = (opts: {
  eventId: string,
  calendarId: string,
  principalId: string,
  user: any
}) => Promise<void>;
export type CalDavOptionsLogging = {
  logEnabled?: boolean;
  logLevel?: string;
};
export type CalDavOptionsData = {
  data: {
    getCalendar: CalDavGetCalendar;
    getCalendarsForPrincipal: CalDavGetCalendarsForPrincipal;
    getEventsForCalendar: CalDavGetEventsForCalendar;
    getEventsByDate: CalDavGetEventsByDate;
    getEvent: CalDavGetEvent;
    createEvent: CalDavCreateEvent;
    updateEvent: CalDavUpdateEvent;
    deleteEvent: CalDavDeleteEvent;
  };
};
export type CalDavOptionsProId = {
  proId: {
    company: string;
    product: string;
    language: string;
  };
};
export type CalDavOptionsModule = CalDavOptionsLogging &
  CalDavOptionsData &
  CalDavOptionsProId;
export type CalDavOptions = CalDavOptionsModule & {
  authenticate: CalDavAuthenticate;
  authRealm: string;
  caldavRoot?: string;
  calendarRoot?: string;
  principalRoot?: string;
  disableWellKnown?: boolean;
};

import koa from './koa';

export {
  koa
};
