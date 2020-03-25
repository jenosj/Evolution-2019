const dateFormat = require('dateformat');
const winston = require('winston');
require('winston-daily-rotate-file');

var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.DailyRotateFile)({
        name:'info',
        filename: './log/info/appedo-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info'
      }),
      new (winston.transports.DailyRotateFile)({
        name:'error',
        filename: './log/error/appedo-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'error'
      })
    ]
  });
logger.info('logger Started for process '+process.pid +' and parent process '+process.ppid);

var reportLogger = new (winston.Logger)({
  transports: [
    new (winston.transports.DailyRotateFile)({
      name:'info',
      filename: './reportLog/info/appedo-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    new (winston.transports.DailyRotateFile)({
      name:'error',
      filename: './reportLog/error/appedo-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    })
  ]
});
reportLogger.info('report logger Started for process '+process.pid +' and parent process '+process.ppid);

var avmScheduleLogger = new (winston.Logger)({
  transports: [
    new (winston.transports.DailyRotateFile)({
      name:'info',
      filename: './avmScheduleLog/info/appedo-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    new (winston.transports.DailyRotateFile)({
      name:'error',
      filename: './avmScheduleLog/error/appedo-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    })
  ]
});
avmScheduleLogger.info('logger Started for process '+process.pid +' and parent process '+process.ppid);


module.exports = logger;
module.exports = reportLogger;
module.exports = avmScheduleLogger;