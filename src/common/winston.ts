import { format, createLogger, transports, Logger } from 'winston';
import { CalDavOptionsLogging } from '..';

interface CalDavLogger extends Logger {
  morganStream?: {
    write: (message: string) => void;
  }
}

export default function(opts: CalDavOptionsLogging & { label: string }) {
  const logger: CalDavLogger = createLogger({
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
  
  logger.morganStream = {
    write: function(message) {
      logger.verbose(message.trim());
    },
  };
  
  return logger;
}
