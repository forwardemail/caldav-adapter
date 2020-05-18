import { format, createLogger, transports } from 'winston';
import { CalDavOptionsLogging } from '..';

export default function(opts: CalDavOptionsLogging & { label: string }) {
  const logger = createLogger({
    level: opts.logLevel || 'debug',
    format: format.combine(
      format.colorize(),
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss:SSS'
      }),
      format.label({ label: opts.label }),
      format.align(),
      format.printf(((info) => {
        return `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`;
      }))
    )
  });

  if (opts.logEnabled) {
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
}
