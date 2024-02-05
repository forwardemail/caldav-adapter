const { format, createLogger, transports } = require('winston');

module.exports = function (options) {
  const logger = createLogger({
    level: options.logLevel || 'debug',
    format: format.combine(
      format.colorize(),
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss:SSS'
      }),
      format.label({ label: options.label }),
      format.align(),
      format.printf((info) => {
        return `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`;
      })
    )
  });

  if (options.logEnabled) {
    logger.add(new transports.Console());
  } else {
    logger.silent = true;
  }

  logger.morganStream = {
    write(message) {
      logger.verbose(message.trim());
    }
  };

  return logger;
};
