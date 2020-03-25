const pgDbAuth = require('./pgDbAuth');
const externalMonAuth = require('./externalMonAuth');
const internalMonAuth = require('./internalMonAuth');
const downloader = require('./downloader');
const moduleService = require('./moduleService');
const reportScheduler = require('./reportSchedulerServices');
const wpt = require('./downloader');
const extReq = require('./externalRequest');
const avmScheduler = require('./avmScheduler');

module.exports = (app) => {
  //console.log("inside routes pgDbauth & psqlCustom");
  app.use('/pgDbAuth', pgDbAuth);
  app.use('/externalMonitor', externalMonAuth);
  app.use('/internalMonitor', internalMonAuth);
  app.use('/downloader', downloader);
  app.use('/moduleService', moduleService);
  app.use('/reportSchedulerServices', reportScheduler);
  app.use('/wpt', wpt);
  app.use('/extReq',extReq);
  app.use('/avmScheduler', avmScheduler);
}