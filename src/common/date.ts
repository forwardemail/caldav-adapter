import moment from 'moment';

export const formatted = function(date: moment.MomentInput) {
  return moment(date).utc().format('YYYYMMDDTHHmmss[Z]');
};
