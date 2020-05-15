import { format, createLogger, transports } from 'winston';

export default function({ logEnabled, logLevel, label,  }) {
  const logger = createLogger({
    level: logLevel || 'debug',
    format: format.combine(
      format.colorize(),
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss:SSS'
      }),
      format.label({ label: label }),
      format.align(),
      format.printf(((info) => {
        return `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`;
      }))
    )
  });

  if (logEnabled) {
    logger.add(new transports.Console());
  } else {
    logger.silent = true;
  }
  
  // logger.stream = {
  //   write: function(message) {
  //     logger.verbose(message.trim());
  //   },
  // };
  
  return logger;
};
