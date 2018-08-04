const { format, createLogger, transports } = require('winston');

module.exports = function(label) {
  const logger = createLogger({
    level: 'debug',
    format: format.combine(
      format.colorize(),
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      format.align(),
      format.printf(((info) => {
        return `${info.timestamp} ${info.level} [${label}]: ${info.message}`;
      }))
    ),
    transports: [new transports.Console()]
  });
  
  logger.stream = {
    write: function(message) {
      logger.debug(message.trim());
    },
  };
  
  return logger;
};


