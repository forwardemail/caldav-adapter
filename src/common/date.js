const moment = require('moment');

module.exports.formatted = function(date) {
  return moment(date).utc().format('YYYYMMDDTHHmmss[Z]');
};
