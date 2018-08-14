const log = require('../lib/winston')({ logEnabled: true, label: 'data' });

const _ = require('lodash');
const moment = require('moment');
const path = require('path');
const { promisify } = require('util');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const baseDataPath = path.resolve(__dirname, './baseData.json');
const runDataPath = path.resolve(__dirname, './runData.json');

const initData = async function() {
  const res = await readFileAsync(baseDataPath);
  const data = JSON.parse(res.toString());
  const keys = Object.keys(data.events);
  const baseDate = moment().add(1, 'day').hour(12).minute(0).second(0);
  keys.forEach((key) => {
    data.events[key].startDate = baseDate.unix();
    baseDate.add(1, 'hour');
    data.events[key].endDate = baseDate.unix();
    baseDate.add(1, 'hour');
  });
  await writeFileAsync(runDataPath, JSON.stringify(data, null, 2));
};

const getData = async function() {
  try {
    const res = await readFileAsync(runDataPath);
    return JSON.parse(res.toString());
  } catch(err) {
    log.debug('copying fresh data file');
    await initData()
    return await getData();
  }
};

const saveData = async function(data) {
  log.debug('saving');
  await writeFileAsync(runDataPath, JSON.stringify(data, null, 2));
};

module.exports.getCalendar = async function(userId, calendarId) {
  const data = await getData();
  return data.calendars[calendarId];
};

module.exports.getCalendarsForUser = async function(userId) {
  const data = await getData();
  return _.filter(data.calendars, { ownerId: userId });
};

module.exports.updateCalendar = async function(userId, calendarId, val) {
  const data = await getData();
  const keys = Object.keys(val);
  keys.forEach((key) => {
    if (key === 'calendar-color') {
      data.calendars[calendarId].color = val[key];
    }
  });
  await saveData(data);
};

module.exports.getEventsForCalendar = async function(userId, calendarId) {
  const data = await getData();
  return _.filter(data.events, (v) => {
    return v.calendarId === calendarId;
  });
};

module.exports.getEventsByDate = async function(userId, calendarId, start, end) {
  const data = await getData();
  return _.filter(data.events, (v) => {
    return v.calendarId === calendarId &&
      v.startDate >= start &&
      v.endDate <= end;
  });
};

module.exports.getEvent = async function(userId, eventId) {
  const data = await getData();
  return data.events[eventId];
};

const bumpSyncToken = function(cal) {
  const parts = cal.syncToken.split('/');
  cal.syncToken = parts.slice(0, -1).join('/') + '/' + (parseInt(parts[parts.length - 1]) + 1);
};

module.exports.createEvent = async function(userId, event) {
  const data = await getData();
  event.lastUpdatedOn = moment().unix();
  data.events[event.eventId] = event;
  bumpSyncToken(data.calendars[event.calendarId]);
  await saveData(data);
  return event;
};

module.exports.updateEvent = async function(userId, event) {
  const data = await getData();
  event.lastUpdatedOn = moment().unix();
  data.events[event.eventId] = event;
  bumpSyncToken(data.calendars[event.calendarId]);
  await saveData(data);
  return event;
};

module.exports.deleteEvent = async function(userId, eventId) {
  const data = await getData();
  const event = data.events[eventId];
  data.events[eventId] = undefined;
  if (event) {
    bumpSyncToken(data.calendars[event.calendarId]);
  }
  await saveData(data);
  return event;
};
