//const Router = require('express-promise-router')
const Router = require('express-promise-router')
const jwt = require('jsonwebtoken');
var exec = require('child_process').exec, child;
var fs = require('fs');
//const { Pool } = require('pg')
const PgConfig = require('../config/apd_constants');
const dateFormat = require('dateformat');
global.logger = require('../log');
const psqlAPM = require('./psqlAPM');
const downloader = require('./downloader');
const pgDbAuth = require('./pgDbAuth');
request = require('request');
//global.errLogger = require('../log');


// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router()
let sumConnectors = [];
let sumDeviceTypes = [];

// export our router to be mounted by the parent application
module.exports =  router;
//module.exports.fnDbQuery = fnDbQuery;

function compileSeleniumScript(testType, seleniumScriptPkg, transactionScript, javaClassName, toDelete, callback) {
  try {
    let returnObj = {};
    let fileCreated=false;
    let fileName;
    let files=[];
    if (testType == 'TRANSACTION') {
      let sourceFilePath = PgConfig.resourcePath+PgConfig.seleniumScriptClassFilePath;
      //let sourceFilePath = 'C:\\Appedo\\resource\\sum\\';
      let sourceFile = sourceFilePath+javaClassName+'.java';
      let fileContent = seleniumScriptPkg+'\n public class '+javaClassName+' { \n'
                        + 'private WebDriver driver;\nprivate static final String WEBDRIVER_SERVER_URL = \"http://127.0.0.1:4444/wd/hub\";\n' 
                        + 'public WebDriver doit() {\n try {\n'
                        + 'DesiredCapabilities caps = DesiredCapabilities.chrome();\n'
                        + 'ChromeOptions chromeOptions = new ChromeOptions();\n'
                        + 'LoggingPreferences logPrefs = new LoggingPreferences();\n'
                        + 'logPrefs.enable(LogType.BROWSER, Level.ALL);\n'
                        + 'logPrefs.enable(LogType.PERFORMANCE, Level.INFO);\n'
                        + 'caps.setCapability(CapabilityType.LOGGING_PREFS, logPrefs);\n'
                        + 'driver = new Augmenter().augment(new RemoteWebDriver(new URL(WEBDRIVER_SERVER_URL), caps));\n'
                        + '\n '+transactionScript + '\n '
                        + ' } catch(Exception e){e.printStackTrace(); } '
                        + ' return driver;} \n '
                        + ' } ';
      fs.writeFile(sourceFile, fileContent, function(err) {
        if(err) {
          returnObj = {success:false, error:true, message: err.message};
          logger.error (err);
          callback(returnObj);
        } else {
          files.push(sourceFile);
          child = exec('javac '+sourceFile, function (error, stdout, stderr) {
            if(stderr != null && stderr.length > 0){
              returnObj = {success:false, error:true, message: stderr};
              callback(returnObj);
            } else if (error) {
              returnObj = {success:false, error:true, message: error.Error};
              callback(returnObj);
            } else {
              files.push(sourceFilePath+javaClassName+'.class');
              if ( toDelete) {
                for (i=0; i < files.length; i++) {
                  fileName = files[i];
                  fs.unlinkSync(fileName);
                }
                returnObj = {success:true, error:false, message: 'success'};
                callback(returnObj);
              } else {
                var url=pgDbAuth.appedoConfigProperties.URL_TO_EXPORT_CLASS_FILE;
                var formData = {
                  command: 'UPLOAD',
                  'class-name': javaClassName+'.class',
                };
    
                fs.createReadStream(sourceFilePath+javaClassName+'.class').pipe(request.post({url:url, headers: formData}, function optionalCallback(errFileFrwd, httpResponse, body) {
                  if (errFileFrwd) {
                    returnObj = {success:false, error:true, result: 'Problem while transferring selenium file.'};
                    callback(returnObj);
                  } else if(httpResponse.statusCode == 200 && body == 'success') {
                    returnObj = {success:true, error:false, message: 'success'};
                    callback(returnObj);
                  } else {
                    returnObj = {success:false, error:true, message: 'Problem with Services.'};
                    callback(returnObj);
                  }
                }));
              } 
            }
          });
        }
      }); 
    } else {
      returnObj = {success:true, error:false, message: 'success'};
      callback(returnObj);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    returnObj = {success:false, error:true, message: e.stack};
    callback(returnObj);
  } 
}

router.use((req,res,next) => {
  const token = req.headers['authorization'];
  if (!token){
    res.json({success:false, invalidToken : true ,message: 'No token provided'});
  } else {
    jwt.verify(token, PgConfig.privateKey, (err,decoded) => {
      if(err) {
        if (err.message == 'jwt expired' && PgConfig.collRefreshToken[token].expiryTime <= Math.floor(new Date().getTime())){
          req.decoded = PgConfig.collRefreshToken[token].decoded;
          PgConfig.collRefreshToken[token].expiryTime = Math.floor(new Date().getTime()/1000)+PgConfig.tokenExpInSec;
          next();
        } else {
          delete PgConfig.collRefreshToken[token];
          res.json({success:false, invalidToken : true, message:'Session Expired'});
        }
      } else {
        req.decoded = decoded;
        next();
      }
    })
  }
});

router.post('/removeAlert', async (req, res) =>{
  try {
      param = req.body;
      userId = param.owner_id != null ? param.owner_id: req.decoded.userId
      let qryDelSla = "DELETE FROM so_sla WHERE sla_id = $1";
      let qryDelSlaCounter = "DELETE FROM so_sla_counter WHERE sla_id = $1";
      let qryDelSlaLog = "DELETE FROM so_sla_log WHERE sla_id = $1";
      let qryDelSlaRum = "DELETE FROM so_sla_rum WHERE sla_id = $1";
      let qryDelSlaSum = "DELETE FROM so_sla_sum WHERE sla_id = $1";
      let qryDelTB = "DELETE FROM so_threshold_breach_"+userId+" WHERE sla_id = $1";
      let qryDelLogTB = "DELETE FROM so_log_threshold_breach_"+userId+" WHERE sla_id = $1";
      let qryDelSumTB = "DELETE FROM so_sum_threshold_breach_"+userId+" WHERE sla_id = $1";
      let qryDelRumTB = "DELETE FROM so_rum_threshold_breach_"+userId+" WHERE sla_id = $1";
      let qryDelAvmTB = "DELETE FROM so_avm_breach_"+userId+" WHERE sla_id = $1";
      let qryDelAlertLog = "DELETE FROM sla_alert_log_"+userId+" WHERE sla_id = $1";
      let msg = "Could not delete SLA Policy in ";
      let paramSla = [param.sla_id]
      async function executeParallelAsyncTasks () {
        const [ resDelAlertLog, resDelAvmTB, resDelRumTB, resDelSumTB, resDelLogTB,resDelTB,resDelSlaSum,resDelSlaRum,resDelSlaLog,resDelSlaCounter,resDelSla ] = await Promise.all([ 
          psqlAPM.fnDbQuery('removeAlert-AlertLog',qryDelAlertLog, paramSla, req, res), 
          psqlAPM.fnDbQuery('removeAlert-AVMTB',qryDelAvmTB, paramSla, req, res), 
          psqlAPM.fnDbQuery('removeAlert-RUMTB',qryDelRumTB, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-SUMTB',qryDelSumTB, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-LogTB',qryDelLogTB, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-TB',qryDelTB, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-SLASUM',qryDelSlaSum, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-SLARUM',qryDelSlaRum, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-SLALOG',qryDelSlaLog, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-SLACounter',qryDelSlaCounter, paramSla, req, res),
          psqlAPM.fnDbQuery('removeAlert-SLA',qryDelSla, paramSla, req, res),
        ]);
        if (resDelAlertLog.success && resDelAvmTB.success && resDelRumTB.success && resDelSumTB.success && resDelLogTB.success && resDelTB.success && resDelSlaSum.success && resDelSlaRum.success && resDelSlaLog.success && resDelSlaCounter.success && resDelSla.success)  {
          res.json({success:true, message:'Policy removed successfully'}); 
        } else {
          if (resDelAlertLog.error){
            msg = msg + " ,Alert Log Master";
          } 
          if (resDelAvmTB.error){
            msg = msg +" ,AVM Threshold Breach"
          }
          if (resDelRumTB.error){
            msg = msg +" ,RUM Threshold Breach"
          }
          if (resDelSumTB.error){
            msg = msg +" ,SUM Threshold Breach"
          }
          if (resDelLogTB.error){
            msg = msg +" ,Log Threshold Breach"
          }
          if (resDelTB.error){
            msg = msg +" ,Metric Threshold Breach"
          }
          if (resDelSlaSum.error){
            msg = msg +" ,SLA SUM/AVM Master"
          }
          if (resDelSlaRum.error){
            msg = msg +" ,SLA RUM Master"
          }
          if (resDelSlaLog.error){
            msg = msg +" ,SLA Log Master"
          }
          if (resDelSlaCounter.error){
            msg = msg +" ,SLA Metric Master"
          }
          if (resDelSla.error){
            msg = msg +" ,SLA Master"
          }
          res.json({success:false, message:msg}); 
        }
      }
      executeParallelAsyncTasks();
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getScenRunDetails', async (req, res) =>{
  try {
    let queryParam;
    let queryText;
    /* queryText = "SELECT scenario_id, max(created_on) last_run, count(runid), max(runid) last_run_id, max(reportid) last_report_id FROM tblreportmaster WHERE scenario_id = $1 GROUP BY 1"; */
    queryText = "SELECT scenario_id, created_on AS last_run, runid AS last_run_id, reportid AS last_report_id, is_active As active, status, grafana_report_url FROM tblreportmaster WHERE scenario_id = $1 ORDER BY runid DESC LIMIT 1";
    queryParam = [req.body.scenario_id];
    psqlAPM.fnDbQuery('getScenRunDetails',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        //res.json({success:true, message:"Success", result: result.rows});
        let query = "SELECT count(runid) FROM tblreportmaster WHERE scenario_id = $1";
        psqlAPM.fnDbQuery('getScenRunCountDetails', query, queryParam, req, res).then( result1 => {
          res.json({success:true, message:"Success", result: result.rows, resultScenRunCount:result1.rows});
        });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLTLiveRunDetail', async (req, res) =>{
  try {
    let queryParam;
    let queryText;
    queryText = "SELECT reporttype, runid, scenarioname, reportname, runstarttime, grafana_report_url, case when length(coalesce(trim(grafana_report_url),''))>0 then true else false end is_url_exist, round(EXTRACT(epoch FROM (now() - runstarttime))) AS diff_sec FROM tblreportmaster WHERE userid = $1 AND runid = $2 AND reporttype = $3";
    queryParam = [req.decoded.userId, req.body.run_id, req.body.scenario_type];
    psqlAPM.fnDbQuery('getLTLiveRunDetail',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAllJMeterRunDetail', async (req, res) =>{
  try {
    let queryParam;
    let queryText;
    queryText = "SELECT tr.reporttype, tr.runid, tr.reportname, tr.scenario_id, tr.scenarioname, tr.runstarttime, tr.runendtime, case when tr.runendtime is null then '0'  else to_char(((tr.runendtime- tr.runstarttime) ||' seconds')::interval,'HH24:MI:SS') end as runtime,  tr.status,  coalesce(sum(ss.created_users), 0) AS createduser, coalesce(sum(ss.completed_users), 0) AS completeduser, tr.grafana_report_url, case when length(coalesce(trim(tr.grafana_report_url),''))>0 then true else false end is_url_exist, (CASE WHEN group_concat(lram.guid) IS NULL THEN '0' ELSE group_concat(lram.guid) END) AS guids FROM tblreportmaster tr LEFT JOIN scriptwise_status ss on ss.runid = tr.runid LEFT JOIN lt_run_agent_mapping lram on lram.lt_run_id = tr.runid WHERE tr.userid = $1 AND tr.scenario_id = $2 AND tr.is_deleted = FALSE AND tr.status <> '' GROUP BY tr.runid, tr.reportname, tr.scenarioname, tr.runstarttime, tr.runendtime, tr.is_deleted, tr.reporttype, tr.grafana_report_url ORDER BY runstarttime DESC";
    queryParam = [req.decoded.userId, req.body.scenario_id];
    psqlAPM.fnDbQuery('getAllJMeterRunDetail',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getUserAgentDetails', async (req, res) =>{
  try {
    let queryParam;
    let queryText;
    queryText = "SELECT browser_name, user_agent_value FROM lt_user_agent";
    psqlAPM.fnDbQuery('getUserAgentDetails',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLTScriptCard', async (req, res) =>{
  try {
    let eId = req.body.entId;
    let queryParam;
    let queryText;
    if (eId != null){
      queryText = "select sc.script_id, sc.script_name, sc.created_on, um.first_name||' '||um.last_name as created_by, string_agg(ls.scenario_name,', ') as mapped_scenarios, count(ss.map_id) from lt_script_master sc LEFT JOIN lt_scenario_script_mapping ss on ss.script_id = sc.script_id LEFT JOIN lt_scenario_master ls on ls.scenario_id = ss.scenario_id JOIN usermaster um on sc.created_by=um.user_id WHERE script_type = $1 and sc.enterprise_id = $2 group by 1,2,3,4 ORDER BY 2 OFFSET $3 LIMIT $4";
      queryParam = [req.body.type, eId, req.body.offset, req.body.limit];
    } else {
      queryText = "select sc.script_id, sc.script_name, sc.created_on, um.first_name||' '||um.last_name as created_by, string_agg(ls.scenario_name,', ') as mapped_scenarios, count(ss.map_id) from lt_script_master sc LEFT JOIN lt_scenario_script_mapping ss on ss.script_id = sc.script_id LEFT JOIN lt_scenario_master ls on ls.scenario_id = ss.scenario_id JOIN usermaster um on sc.created_by=um.user_id WHERE script_type = $1 and um.user_id = $2 group by 1,2,3,4  ORDER BY 2  OFFSET $3 LIMIT $4";
      queryParam = [req.body.type, req.decoded.userId,req.body.offset, req.body.limit];
    }
    psqlAPM.fnDbQuery('getLTScriptCard',queryText, queryParam, req, res).then( result => {
      if (result.success){
        res.json({success:true, rowCount:result.rowCount, result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getLTScenCard', async (req, res) =>{
  try {
    let eId = req.body.entId;
    let queryParam;
    let queryText;
    if (eId != null){
      queryText = "select sc.scenario_id, sc.scenario_name, sc.scenario_type, sc.created_on, um.first_name||' '||um.last_name as created_by, string_agg(ls.script_name,', ') as mapped_scripts, count(ss.map_id), CASE WHEN GROUP_CONCAT(DISTINCT ss.scenario_settings->>'type') = '1' THEN 'ITERATION' ELSE 'DURATION' END AS runType, MAX(scenario_settings->>'maxuser') as maxusers, sc.v_users, sc.modified_on from lt_scenario_master sc LEFT JOIN lt_scenario_script_mapping ss on ss.scenario_id = sc.scenario_id LEFT JOIN lt_script_master ls on ls.script_id = ss.script_id JOIN usermaster um on sc.user_id=um.user_id WHERE sc.scenario_type = $1 AND sc.enterprise_id = $2 group by 1,2,3,4,5 ORDER BY 2 OFFSET $3 LIMIT $4";
      queryParam = [req.body.type, eId, req.body.offset, req.body.limit];
    } else {
      queryText = "select sc.scenario_id, sc.scenario_name, sc.scenario_type, sc.created_on, um.first_name||' '||um.last_name as created_by, string_agg(ls.script_name,', ') as mapped_scripts, count(ss.map_id), CASE WHEN GROUP_CONCAT(DISTINCT ss.scenario_settings->>'type') = '1' THEN 'ITERATION' ELSE 'DURATION' END AS runType, MAX(scenario_settings->>'maxuser') as maxusers, sc.v_users, sc.modified_on from lt_scenario_master sc LEFT JOIN lt_scenario_script_mapping ss on ss.scenario_id = sc.scenario_id LEFT JOIN lt_script_master ls on ls.script_id = ss.script_id JOIN usermaster um on sc.user_id=um.user_id WHERE sc.scenario_type = $1 AND um.user_id = $2 group by 1,2,3,4,5 ORDER BY 2 OFFSET $3 LIMIT $4";
      queryParam = [req.body.type, req.decoded.userId, req.body.offset, req.body.limit];
    }
    let result = await psqlAPM.fnDbQuery('getLTScenCard',queryText, queryParam, req, res);
    if (result.success ){
      res.json({success:true, rowCount:result.rowCount, result: result.rows});
    }  else {
      if(!result.error)
        res.json({success:false, invalidToken : false, message:'No record found'});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getLTScenStat', async (req, res) =>{
  try {
    let eId = req.body.entId;
    let queryParam;
    let queryText;
    if (eId != null){
      queryText = "SELECT scenario_type, count(scenario_type) FROM lt_scenario_master WHERE enterprise_id = $1 AND scenario_type ='JMETER' GROUP BY 1";
      queryParam = [eId];
    } else {
      queryText = "SELECT scenario_type, count(scenario_type) FROM lt_scenario_master WHERE user_id = $1 AND scenario_type ='JMETER' GROUP BY 1";
      queryParam = [req.decoded.userId];
    }
    psqlAPM.fnDbQuery('getLTScenStat',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result: result.rows});
      }  else {
        if(!result.error){
          let noRec = [];
          noRec.push({scenario_type: "JMETER", count: "0"})
          res.json({success:true, invalidToken : false, result:noRec});
        }
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLTScriptStat', async (req, res) =>{
  try {
    let eId = req.body.entId;
    let queryParam;
    let queryText;
    if (eId != null){
      queryText = "SELECT script_type, count(script_id) FROM lt_script_master WHERE enterprise_id = $1 AND script_type ='JMETER' GROUP BY 1";
      queryParam = [eId];
    } else {
      queryText = "SELECT script_type, count(script_id) FROM lt_script_master WHERE user_id = $1 AND script_type ='JMETER' GROUP BY 1";
      queryParam = [req.decoded.userId];
    }
    psqlAPM.fnDbQuery('getLTScriptStat',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result: result.rows});
      }  else {
        if(!result.error){
          let noRec = [];
          //noRec.push({script_type: "APPEDO_LT", count: "0"});
          noRec.push({script_type: "JMETER", count: "0"})
          res.json({success:true, invalidToken : false, result:noRec});
        }
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/checkValidURL', async (req, res) => {
  try {
    let path = pgDbAuth.appedoConfigProperties.APPEDO_HARFILES;
    let harURL = path+"/"+req.body.test_id+"/"+req.body.harFileName;
    request(harURL, { json: true }, (err, response, body) => {
      if (err || response.statusCode > 399) {
        logger.error(process.pid,err);
        res.json({success:false, error:true, message: 'URL is Down'});
      } else {
        res.json({success:true, error:false, message: 'URL is Up.', url:harURL});
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getFirstByte', async (req, res) =>{
  try {
      const queryText = "SELECT * FROM get_har_summary($1)";
      const queryParam = [req.body.harId];
      psqlAPM.fnDbQuery('getFirstByte',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          res.json({success:true, message:"Success", result: result.rows[0] });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'No record found'});
          else 
            res.json(result);
        }
      });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/fetchScreen', async (req, res) =>{
  try {
      const queryText = "SELECT * FROM get_har_contentbreakdown($1)";
      const queryParam = [req.body.harId];
      psqlAPM.fnDbQuery('fetchScreen',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          let resultData = result.rows[0];
          for (i=0; i < Object.keys(resultData).length; i++) {
            var key = Object.keys(resultData)[i];
            var appConfig = JSON.parse(pgDbAuth.appedoConfigProperties['WPT_APPEDO_REDIRECTOR_EVOLUTION_2018']);
            if (resultData[key] != null) {
              for (j=0; j < appConfig.length; j++) {
                resultData[key]=resultData[key].replace(appConfig[j].wpt_server_url, appConfig[j].redirector_url);
              }
            }
          }
          res.json({success:true, message:"Success", result: resultData });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'No record found'});
          else 
            res.json(result);
        }
      });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/deleteLogAlert', async (req, res) =>{
  try {
      let tableName = "so_log_threshold_breach_"+req.decoded.userId;
      let queryText1 = "DELETE FROM so_sla WHERE sla_id = $1";
      let queryText2 = "DELETE FROM so_sla_log WHERE sla_id = $1";
      let queryText3 = "DELETE FROM "+tableName+" WHERE sla_id = $1";
      queryParam = [req.body.sla_id];
      let cnt = 0;
      function callback(){
        res.json({success:true, message:"Deleted Successfully" });
      }
      psqlAPM.fnDbQuery('delete-sla',queryText1, queryParam, req, res).then( result1 => {
        cnt++;
        if (cnt==3){
          callback();
        }
      })
      psqlAPM.fnDbQuery('delete-slalog',queryText2, queryParam, req, res).then( result2 => {
        cnt++;
        if (cnt ==3){
          callback();
        }
      })
      psqlAPM.fnDbQuery('delete-slaBreach',queryText3, queryParam, req, res).then( result3 => {
        cnt++;
        if (cnt == 3){
          callback();
        }
      })
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/deleteAvm', async (req, res) =>{
  try {
      let qryDelAvm = "DELETE FROM avm_test_master WHERE avm_test_id = $1";
      let qryDelAvmAgt = "DELETE FROM avm_test_agent_mapping WHERE avm_test_id = $1";
      let qrySla = "DELETE FROM so_sla WHERE sla_id IN (SELECT distinct sla_id FROM so_sla_log WHERE uid = $1 AND log_grok_name ='AVM')";
      let qrySlaDet = "DELETE FROM so_sla_log WHERE uid = $1 AND log_grok_name ='AVM'";
      let tableName = 'so_log_threshold_breach_'+req.decoded.userId;
      let qryAvmBreach = "DELETE FROM "+tableName+" WHERE uid = $1 AND log_grok_name = 'AVM'"
      paramAvmId = [req.body.avm_test_id];
      let logTableName = 'log_avm_'+req.body.avm_test_id;
      let qryDropLogAvm = "DROP TABLE IF EXISTS "+logTableName+" CASCADE";
      let msg = "Could not delete AVM in ";
      let resDelAvmSla = await psqlAPM.fnDbQuery('delete-AVMSLA',qrySla, paramAvmId, null, null);
      if (resDelAvmSla.error){
        msg = msg +" ,AVM SLA"
      }
      async function executeParallelAsyncTasks () {
        const [ resDelAvm, resDelAvmAgt, resDelAvmSlaDet, resDelAvmBreach, resDropAvmLog ] = await Promise.all([ 
          psqlAPM.fnDbQuery('delete-Avm',qryDelAvm, paramAvmId, null, null), 
          psqlAPM.fnDbQuery('delete-AVMAgentMapping',qryDelAvmAgt, paramAvmId, null, null), 
          psqlAPM.fnDbQuery('delete-AVMSLADet',qrySlaDet, paramAvmId, null, null),
          psqlAPM.fnDbQuery('delete-AVMBreach',qryAvmBreach, paramAvmId, null, null),
          psqlAPM.fnDbQuery('drop-AVMLog',qryDropLogAvm, [], null, null)
        ]);
        if (resDelAvm.success && resDelAvmAgt.success && resDelAvmSlaDet.success && resDelAvmBreach.success && resDropAvmLog.success)  {
          res.json({success:true, message:'AVM Card Deleted Successfully'}); 
        } else {
          if (resDelAvm.error){
            msg = msg + " ,AVM Master";
          } 
          if (resDelAvmAgt.error){
            msg = msg +" ,AVM Agent"
          }
          if (resDelAvmSlaDet.error){
            msg = msg +" ,AVM SLA Details"
          }
          if (resDelAvmBreach.error){
            msg = msg +" ,AVM SLA Breach"
          }
          if (resDropAvmLog.error){
            msg = msg +" ,AVM Log"
          }
          res.json({success:false, message:msg}); 
        }
      }
      executeParallelAsyncTasks();
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAvmEditById', async (req, res) =>{
  try {
      const queryText = "SELECT avm_test_id, user_id, testname, testurl, to_timestamp(start_date/1000) as start_date, to_timestamp(end_date/1000) as end_date, is_active, frequency,start_time, end_time, request_method, test_head_method_first, request_headers, request_parameters, request_body, min_breach_count, authorize_type, authorize_param, req_body_type, variables FROM avm_test_master WHERE avm_test_id=$1";
      const queryParam = [req.body.avm_test_id];
      psqlAPM.fnDbQuery('getAvmEditById',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          res.json({success:true, message:"Success", result: result.rows[0] });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'No record found'});
          else 
            res.json(result);
        }
      });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/saveAVM', async (req, res) =>{
  try {
    let qryData = req.body;
    userId = req.decoded.userId;
    createdBy = req.decoded.userId;
    let createdOn = new Date();
    let queryText;
    let queryParam;
    let ins;
    //Any change to column (added or removed from table, history table also must be changed.)
    if (qryData.avm_test_id == null){
      queryText = "INSERT INTO avm_test_master(user_id, testname, testurl, start_date, end_date, is_active, frequency,created_by, created_on, start_time, end_time, request_method, test_head_method_first, request_headers, request_parameters, e_id, request_body, min_breach_count, authorize_type, authorize_param, req_body_type, variables) VALUES ($1,$2, $3, $4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING avm_test_id";
      queryParam = [userId, qryData.testname, qryData.testurl,qryData.start_date, qryData.end_date, qryData.is_active, qryData.frequency,createdBy,createdOn, qryData.start_time, qryData.end_time, qryData.request_method, qryData.test_head_method_first, qryData.request_headers, qryData.request_parameters, qryData.eId, qryData.request_body,qryData.min_breach_count,qryData.authorize_type, qryData.authorize_param, qryData.req_body_type, qryData.variables];
      ins = true;
    } else {
      queryText = "UPDATE avm_test_master SET user_id=$1, testname=$2, testurl=$3, start_date=$4, end_date=$5, is_active=$6, frequency=$7,modified_by=$8, modified_on=$9, start_time=$10, end_time=$11, request_method=$12, test_head_method_first=$13, request_headers=$14, request_parameters=$15, request_body=$16, min_breach_count=$17,authorize_type=$18,authorize_param=$19, req_body_type=$20, variables=$21 WHERE avm_test_id = $22";
      queryParam = [userId, qryData.testname, qryData.testurl,qryData.start_date, qryData.end_date, qryData.is_active, qryData.frequency,createdBy,createdOn, qryData.start_time, qryData.end_time, qryData.request_method, qryData.test_head_method_first, qryData.request_headers, qryData.request_parameters, qryData.request_body,qryData.min_breach_count, qryData.authorize_type, qryData.authorize_param, qryData.req_body_type, qryData.variables, qryData.avm_test_id];
      ins = false;
    }
    let errMsg = "Could not add ";
    let result = await psqlAPM.fnDbQuery('saveAVM-AVM',queryText, queryParam, req, res);
    if (result.rowCount > 0) {
      if (ins) {
        queryChart="SELECT * FROM add_avm_chart_visual($1, $2)";
        paramChart = [userId, result.rows[0].avm_test_id];
        querySLA = "INSERT INTO so_sla (sla_name,sla_description,server_details,server_details_type,user_id,e_id,sla_type,created_by,created_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9),($10,$11,$3,$4,$5,$6,$7,$8,$9),($12,$13,$3,$4,$5,$6,$7,$8,$9),($14,$15,$3,$4,$5,$6,$7,$8,$9),($16,$17,$3,$4,$5,$6,$7,$8,$9) RETURNING sla_id";
        paramSLA = ['Status Code for AVM Test Id '+result.rows[0].avm_test_id, 'Auto generated record for AVM status code', '', '', userId,qryData.e_id, 'Alert',createdBy,createdOn,'ENOTFOUND for AVM Test Id '+result.rows[0].avm_test_id, 'Auto generated record for AVM ENOTFOUND','ETIMEDOUT for AVM Test Id '+result.rows[0].avm_test_id, 'Auto generated record for AVM ETIMEDOUT','ECONNREFUSED for AVM Test Id '+result.rows[0].avm_test_id, 'Auto generated record for AVM ECONNREFUSED','Response Time for AVM Test Id '+result.rows[0].avm_test_id, 'Auto generated record for AVM Response Time'];
        let inheritTableName = "log_avm_"+result.rows[0].avm_test_id;
        queryAVMTransTable = "CREATE TABLE IF NOT EXISTS "+inheritTableName+" AS TABLE log_avm_template WITH NO DATA";
        async function executeParallelAsyncTasks () {
          const [resAvmAgnt, resChart, resSLA,resAVM] = await Promise.all([ 
            insertAVMAgentMapping(result.rows[0].avm_test_id, qryData.selectedCities),
            psqlAPM.fnDbQuery('saveAVM-addChartVisual',queryChart, paramChart, null, null),
            psqlAPM.fnDbQuery('saveAVM-SLA',querySLA, paramSLA, null, null),
            psqlAPM.fnDbQuery('saveAVM-CreateLogAvm', queryAVMTransTable, [],null, null)
          ]);
          if (resChart.error){
            errMsg += " ,chart visual data ";
          } 
          if (resAVM.error){
            errMsg += " ,Log AVM transaction Table "+inheritTableName;
          }
          if (resSLA.rowCount>0){
            let paramSLADet= [result.rows[0].avm_test_id,'NA for AVM',3,'log_avm_','AVM',req.decoded.userId];
            let qrySLADet = "INSERT INTO so_sla_log (sla_id, uid, guid, breach_type_id, log_table_name, log_grok_name, breach_pattern, breached_severity,grok_column,is_above_threshold,critical_threshold_value,warning_threshold_value,min_breach_count,created_on,created_by) VALUES"
            resSLA.rows.map((row,ix) => {
              if (ix == 0){
                paramSLADet.push(row.sla_id,null, null,'status_code',true,500,400,5);
                qrySLADet += "($7,$1,$2,$3,$4,$5,$8,$9,$10,$11,$12,$13,$14,now(),$6)";
              } else if (ix == 1) {
                paramSLADet.push(row.sla_id,'ENOTFOUND','critical',null,null,null,null,5);
                qrySLADet += ",($15,$1,$2,$3,$4,$5,$16,$17,$18,$19,$20,$21,$22,now(),$6)";
              } else if (ix == 2) {
                paramSLADet.push(row.sla_id,'ETIMEDOUT','critical',null,null,null,null,5);
                qrySLADet += ",($23,$1,$2,$3,$4,$5,$24,$25,$26,$27,$28,$29,$30,now(),$6)";
              } else if (ix == 3) {
                paramSLADet.push(row.sla_id,'ECONNREFUSED','critical',null,null,null,null,5);
                qrySLADet += ",($31,$1,$2,$3,$4,$5,$32,$33,$34,$35,$36,$37,$38,now(),$6)";
              } else {
                paramSLADet.push(row.sla_id,null, null,'resp_time_ms',true,5000,2000,10);
                qrySLADet += ",($39,$1,$2,$3,$4,$5,$40,$41,$42,$43,$44,$45,$46,now(),$6)";
              }
            })
            // let qrySLADet = "INSERT INTO so_sla_sum (sla_id, sum_test_id, sum_type, sum_counter_name, min_breach_count, breach_type_id, created_by, created_on) VALUES ($1,$2, 'AVAILABILITY_MONITORING', 'pageloadtime',1, 3, $3, now())"
            let resSLADet = await psqlAPM.fnDbQuery('saveAVM-SLADet',qrySLADet, paramSLADet, req, res);
            if (resSLADet.error){
              errMsg += " ,SLA Details";
            } 
            // queryText = "UPDATE avm_test_master SET sla_id = $2 WHERE avm_test_id = $1";
            // queryParam = [result.rows[0].avm_test_id,resSLA.rows[0].sla_id];
            // let resUpdAVM = await psqlAPM.fnDbQuery('saveAVM-Update',queryText, queryParam, req, res);
            // if (resUpdAVM.error){
            //   errMsg += " ,SLA id back to AVM test";
            // } 
          } else {
            errMsg += " ,SLA & SLA Details";
          }
        }
        await executeParallelAsyncTasks();
        if (errMsg != "Could not add "){
          res.json({success:false, invalidToken : false, message:errMsg});
        } else {
          res.json({success:true, message:"Successfully Added Availability Test" });
        }
      } else {
        errMsg = 'Could not update '
        queryText="SELECT * FROM update_avm_chart_visual($1,$2)";
        queryParam = [userId, qryData.avm_test_id];
        async function executeParallelAsyncTasks () {
          const [resAvmAgnt, resChart] = await Promise.all([ 
            updateAVMAgentMapping(qryData.avm_test_id,qryData.selectedCities),
            psqlAPM.fnDbQuery('saveAVM-UpdateChartVisual',queryText, queryParam, req, res)
          ]);
          if (!resAvmAgnt){
            errMsg += ' Avm Agent';
          }
          if (!resChart.success){
            errMsg += ' ,Chart Visual';
          }
        }
        await executeParallelAsyncTasks();
        if (errMsg != 'Could not update '){
          res.json({success:false, invalidToken : false, message:errMsg});
        } else {
          res.json({success:true, invalidToken : false, message:'Successfully Updated Availability Test'});
        }
      }
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAVLMonCard', async (req, res) =>{
  try {
    let userId = req.body.e_user_id == null ? req.decoded.userId : req.body.e_user_id;
    let eQry = req.body.e_id == null ? 'atm.user_id='+userId : ' atm.e_id='+req.body.e_id;
    let dt = new Date().getTime();
    // let endTime = Date.now();
    // let startTime = endTime - 60*60*1000; //Last one hour in milliseconds
    let queryText = "SELECT atm.avm_test_id, atm.avm_test_id as uid, 'AVM' as module_code, lower(atm.testname) as testname, atm.testurl, to_timestamp(atm.start_date/1000)::timestamp with time zone as start_date, to_timestamp(atm.end_date/1000)::timestamp with time zone as end_date, atm.is_active, atm.frequency, atm.created_on, um.first_name, atrd.last_received_on, atrd1.status_text, CASE  WHEN atrd1.status_text = 'OK' AND atm.end_date >="+dt+" THEN true WHEN atrd1.status_text='Created' AND atm.end_date >="+dt+" THEN true ELSE false END as last_available_status, atm.is_active FROM avm_test_master atm JOIN usermaster um ON um.user_id =atm.user_id LEFT JOIN (SELECT avm_test_id, MAX(agent_tested_on) as last_received_on FROM avm_test_run_details GROUP BY avm_test_id) as atrd ON atm.avm_test_id = atrd.avm_test_id LEFT JOIN avm_test_run_details atrd1 ON atrd1.agent_tested_on= atrd.last_received_on AND atrd1.avm_test_id = atrd.avm_test_id WHERE is_delete=false AND "+eQry+" ORDER BY 14 DESC, 4 OFFSET $1 LIMIT $2";
    queryParam = [req.body.offset, req.body.limit];
    psqlAPM.fnDbQuery('getAVLMonCard',queryText, queryParam, req, res).then( result => {
      if (result.success ){
        res.json({success:true, rowCount:result.rowCount, result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found for this user/enterprise'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getBreachCntByModuleUid', async (req, res) =>{
  try {
    param = req.body;
    let endDate = new Date().toISOString();
    let stDate = new Date(new Date(endDate).getTime()-60*60*1000).toISOString();
    const queryText = "SELECT count(*) FROM sla_breaches WHERE uid = $2 AND module = $1 AND appedo_received_on BETWEEN $3 AND $4";
    const queryParam = [req.body.module, req.body.uid, stDate, endDate];
    psqlAPM.fnDbQuery('getBreachCntByModuleUid',queryText, queryParam, req, res).then( result => {
      if (result.success){
        res.json({success:true, rowCount:result.rowCount, result: result.rows});
      }  else {
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAVMPolicyCountByTestId', async (req, res) =>{
  try {
    const queryText = "SELECT count(*) FROM so_sla_log WHERE uid = $1 AND log_grok_name = 'AVM'";
    const queryParam = [req.body.avmTestId];
    psqlAPM.fnDbQuery('getAVMPolicyCountByTestId',queryText, queryParam, req, res).then( result => {
      if (result.success){
        res.json({success:true, rowCount:result.rowCount, result: result.rows});
      }  else {
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAVMTestLocByTestId', async (req, res) =>{
  try {
    const queryText = "SELECT avm_test_id, country, state, city, region, zone FROM avm_test_agent_mapping WHERE avm_test_id = $1";
    const queryParam = [req.body.avmTestId];
    psqlAPM.fnDbQuery('getAVMTestLocByTestId',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          res.json({success:true, message:"Success", result: result.rows});
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'Agent not mapped to this test'});
          else 
            res.json(result);
        }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/insAVMLocation', async (req, res) =>{
  try {
    let avmLoc = req.body;
    const queryText = "INSERT INTO avm_agent_master(e_id,user_id,is_private,country,state,region,zone,city,created_on,created_by,guid,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$2, md5(random()::text || clock_timestamp()::text)::uuid,$9) returning agent_id";
    const queryParam = [avmLoc.e_id,req.decoded.userId,avmLoc.private,avmLoc.country,avmLoc.state,avmLoc.region,avmLoc.zone,avmLoc.city,avmLoc.status];
    psqlAPM.fnDbQuery('insAVMLocation',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Successfully AVM Location Created", result:result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'Failed to created the AVM location'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/deleteAvmLoc', async (req, res) =>{
  try {
      const queryText = "DELETE FROM avm_agent_master WHERE agent_id = $1 AND created_by = $2";
      const queryParam = [req.body.agent_id, req.decoded.userId];
      psqlAPM.fnDbQuery('deleteAvmLoc',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          res.json({success:true, message:"Deleted Successfully" });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'No record found'});
          else 
            res.json(result);
        }
      });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAlertForAVMAgentId', async (req, res) =>{
  try{
    const queryText = "SELECT a_a_m_id, agent_id, alert_type, email_mobile, verified_on FROM avm_agent_alert_mapping WHERE agent_id = $1";
    const queryParam = [req.body.agent_id];
    psqlAPM.fnDbQuery('getAlertForAVMAgentId',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No alert configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAVMLocation', async (req, res) =>{
  try{
    // let userId = req.body.e_id == null ? req.decoded.userId : req.body.e_user_id;
    // let eIdQry = req.body.e_id == null ? 'user_id='+req.decoded.userId : " e_id = "+req.body.e_id;
    // const queryText = "SELECT lower(country) as country, lower(state) as state, lower(city) as city, lower(region) as region, lower(zone) as zone,Min(lower(status)) as status, count(city) as cntCity FROM avm_agent_master WHERE "+eIdQry+" OR is_private=false GROUP BY 1,2,3,4,5";
    let queryText = "SELECT location, count(*), MAX(appedo_received_on) appedo_received_on FROM ( SELECT agent_id, location, MAX(appedo_received_on) as appedo_received_on FROM avm_heartbeat_log GROUP BY 1,2) AS a GROUP BY location";
    const queryParam = [];
    psqlAPM.fnDbQuery('getAVMLocation',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No Location Configured for this user/enterprise'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAVMLocationCard', async (req, res) =>{
  try{
    let userId = req.body.e_user_id == null ? req.decoded.userId : req.body.e_user_id;
    let eIdQry = req.body.e_id == null ? ' aam.user_id = '+userId: " aam.e_id = "+req.body.e_id;
    // let endTime = Date.now();
    // let startTime = endTime - 60*60*1000; //Last one hour in milliseconds
    // let table_name = 'sum_heartbeat_log_'+userId;
    // const queryText = "SELECT aam.agent_id, aam.country,aam.state,aam.city,aam.region, aam.zone, aam.last_responded_on, aam.last_requested_on, lower(aam.status) as status,aam.ip_address,COALESCE(aam.last_received_url_cnt,0) as last_received_url_cnt, Extract(Epoch from  aam.created_on)*1000 as created_on, aam.is_private, COALESCE(app.test_cnt,0) as test_cnt, um.first_name FROM avm_agent_master aam LEFT JOIN (SELECT agent_id, count(distinct sum_test_id) as test_cnt FROM "+table_name+" WHERE appedo_received_on BETWEEN $1 AND $2 GROUP BY 1 ) as app ON app.agent_id = aam.agent_id JOIN usermaster um ON um.user_id = aam.user_id  WHERE "+ eIdQry +" OFFSET $3 LIMIT $4";
    let queryText = "SELECT aam.agent_id, COALESCE(ah1.location::VARCHAR, aam.country||'#'||aam.state||'#'||aam.city||'#'||aam.region||'#'|| aam.zone::VARCHAR) as location,aam.last_responded_on, aam.last_requested_on,lower(aam.status) as status,COALESCE(ah1.ip_address,aam.ip_address) as ip_address, um.first_name, aam.created_on,aam.country||'#'||aam.state||'#'||aam.city||'#'||aam.region||'#'|| aam.zone::VARCHAR as registered_location,ah1.latitude, ah1.longitude FROM avm_agent_master aam LEFT JOIN (SELECT agent_id, MAX(appedo_received_on) as last_received_on FROM avm_heartbeat_log GROUP BY 1) as ah ON ah.agent_id = aam.agent_id LEFT JOIN avm_heartbeat_log ah1 ON ah1.appedo_received_on = ah.last_received_on AND ah1.agent_id = ah.agent_id JOIN usermaster um ON um.user_id = aam.created_by WHERE "+ eIdQry +" OFFSET $1 LIMIT $2";
    const queryParam = [req.body.offset, req.body.limit];
    psqlAPM.fnDbQuery('getAVMLocationCard',queryText, queryParam, req, res).then( result => {
      if (result.success ){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No Location Configured for this user/enterprise'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/remAVMAgentAlertMapping', async (req, res) =>{
  try{
    let rmData = req.body;
    const queryText = 'DELETE FROM avm_agent_alert_mapping WHERE a_a_m_id = $1';
    const queryParam = [rmData.a_a_m_id];
    psqlAPM.fnDbQuery('remAVMAgentAlertMapping',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Successfully removed the record" });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updAVMAgentAlertMapping', async (req, res) =>{
  try{
    let updData = req.body;
    const queryText = 'UPDATE avm_agent_alert_mapping SET alert_type=$1, email_mobile=$2, modified_on = now(), modified_by = $3 WHERE a_a_m_id = $4';
    const queryParam = [updData.alert_type, updData.email_mobile, req.decoded.userId,updData.a_a_m_id];
    psqlAPM.fnDbQuery('updAVMAgentAlertMapping',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Successfully updated the record" });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No record found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/insAVMAgentAlertMapping', async (req, res) =>{
  try{
    let insData = req.body;
    let qryText = "SELECT a_a_m_id FROM avm_agent_alert_mapping WHERE agent_id = $1 AND email_mobile =$2";
    let qryParam = [insData.agent_id,insData.email_mobile];
    psqlAPM.fnDbQuery('insAVMAgentAlertMapping - chkAvl',qryText, qryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:false, message:"Email/SMS No. already exists"});
      } else {
        if (result.rowCount==0){
          const queryText = "INSERT INTO avm_agent_alert_mapping (user_id, agent_id, guid, alert_type, email_mobile, created_on, created_by) SELECT $1,$2,guid,$3,$4,now(),$1 FROM avm_agent_master WHERE agent_id = $2";
          const queryParam = [req.decoded.userId, insData.agent_id, insData.alert_type, insData.email_mobile];
          psqlAPM.fnDbQuery('insAVMAgentAlertMapping',queryText, queryParam, req, res).then( result => {
            if (result.rowCount > 0 ){
              res.json({success:true, message:"Successfully inserted the alert"});
            } else {
              if(!result.error)
                res.json({success:false, invalidToken : false, message:'Insert alert failed'});
              else 
                res.json(result);
            }
          });
        }
        else if(!result.error)
          res.json({success:false, invalidToken : false, message:'Insert alert failed'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.get('/getSumDeviceTypes', async (req, res) =>{
  try{
    if (sumDeviceTypes.length == 0) {
      const queryText = 'select dob_id, device_type, os_name, browser_name from sum_device_os_browser';
      const queryParam = [];
      psqlAPM.fnDbQuery('getSumDeviceTypes',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          sumDeviceTypes = result.rows;
          res.json({success:true, message:"Success", result : sumDeviceTypes });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'No DeviceTypes found'});
          else 
            res.json(result);
        }
      });
    } else {
      res.send({success:true, message:"Success", result : sumDeviceTypes })
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

// Getting Sum Connectors
router.get('/getSumConnectivity', async (req, res) =>{
  try{
    if (sumConnectors.length == 0) {
      const queryText = 'select connection_id , display_name , connection_name ,download ,upload ,latency ,packet_loss ,is_default ,is_active  FROM sum_connectivity where is_active = true order by connection_id, is_default';
      const queryParam = [];
      psqlAPM.fnDbQuery('getSumConnectivity',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          sumConnectors = result.rows;
          res.json({success:true, message:"Success", result : sumConnectors });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'No Connectors found.'});
          else 
            res.json(result);
        }
      });
    } else {
      res.send({success:true, message:"Success", result : sumConnectors });
    }
    
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//getting sum nodes
router.post('/getSUMNodes', async (req, res) =>{
  try{
    const queryText = 'SELECT * FROM get_sum_nodes_with_location_status_sample($1, $2, $3)';
    const queryParam = [req.body.testId, req.decoded.userId, req.body.dobId];
    psqlAPM.fnDbQuery('getSUMNodes',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ) {
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No Nodes found'});
        else 
          res.json(result);
      }
    });
    
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Add/Update Sum module
router.post('/addUpdateSum', async (req, res) =>{
  try{
      let d = Date.now();
      req.body.start_date = new Date(req.body.start_date);
      req.body.end_date = new Date(req.body.end_date) //dateFormat(req.body.end_date,"utcWithoutZone");
      req.body.last_run_detail = new Date(req.body.last_run_detail) //dateFormat(req.body.last_run_detail,"utcWithoutZone");
      let queryText, queryParam;
      let msg;
      let errMsg;
      if (req.body.test_id == null) {
        queryText = 'SELECT add_sum_test ($1, $2::json)';
        queryParam = [req.decoded.userId, req.body];
        msg = "Successfully added sum test";
        errMsg = "Failed to add sum test";
      } else {
        queryText = 'SELECT update_sum ($1, $2, $3::json)';
        queryParam = [req.decoded.userId, req.body.test_id, req.body];
        msg = "Successfully updated sum test "+req.body.test_id;
        errMsg = "Failed to update sum test "+req.body.test_id;
      }
      var javaPreTestName='sum_test_'+req.decoded.userId+'_pretest';
      compileSeleniumScript(req.body.testtype, req.body.trasnaction_imports, req.body.testtransaction, javaPreTestName, true, function afterExec(testScriptData) {
        if (!testScriptData.success) {
          res.json(testScriptData);
        } else {
          psqlAPM.fnDbQuery('addUpdateSum',queryText, queryParam, req, res).then(result => {
            if (result.rowCount > 0 ) {
              var test_id= req.body.test_id == null ? result.rows[0].add_sum_test : req.body.test_id;

              var javaName='sum_test_'+req.decoded.userId+'_'+test_id;
              compileSeleniumScript(req.body.testtype, req.body.trasnaction_imports, req.body.testtransaction, javaName, false, function afterExec(finalTestScriptData) {
                if (!finalTestScriptData.success) {
                  res.json(finalTestScriptData);
                } else {
                  //need to update filename in sum_test_master.
                  if (req.body.testtype == 'TRANSACTION') {
                    queryText1 = 'UPDATE sum_test_master SET testfilename = $1 WHERE test_id = $2 ';
                    queryParam1 = [javaName, test_id];

                    psqlAPM.fnDbQuery('updateTestFilename',queryText1, queryParam1, req, res).then(result1 => {
                      if (result1.rowCount > 0 ) {
                        res.json({success:true, message:msg, result : result1.rows });
                      } else {
                        if(!result.error)
                          res.json({success:false, invalidToken : false, message:errMsg});
                        else 
                          res.json(result);
                      }
                    });
                  } else {
                    res.json({success:true, message:msg, result : result.rows });
                  }
                  
                }
              });
            }  else {
              if(!result.error)
                res.json({success:false, invalidToken : false, message:errMsg});
              else 
                res.json(result);
            }
          });
        }
      });
 
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/deleteSumModule', async (req, res) => {
  try {
    const queryText = 'SELECT delete_sum ($1, $2, $3, $4)';
    const queryParam = [req.decoded.userId, req.body.testId, req.body.entId, req.body.moduleCode];
    psqlAPM.fnDbQuery('deleteSumModule',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:'Successfully deleted SUM Test ('+req.body.testId+")"});
      } else {
        if(!result.error)
        res.json({success:false,invalidToken : false, message:'Deletion Failed for Test ID '+req.body.testId});
      else 
        res.json(result);
      }
    });

  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


//Delete Rum module
router.post('/deleteRumModule', async (req, res) => {
  try {   
    const queryText = 'SELECT delete_rum ($1, $2, $3)';
    const queryParam = [req.decoded.userId, req.body.uid, req.body.entId];
    psqlAPM.fnDbQuery('deleteRumModule',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Successfully deleted RUM Card ("+req.body.uid+").", result : 'Selected module ('+req.body.uid+') deleted.'});
      } else {
        if(!result.error)
        res.json({success:false,invalidToken : false, message:'Could not delete RUM Card '+req.body.uid});
      else 
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getSumMeasurementData', async (req, res) => {
  try {
    let userId = req.body.owner_id == undefined ? req.decoded.userId : req.body.owner_id;
    const queryText = 'SELECT count(shtr.test_id) AS measurement,  round(COALESCE(min(CASE WHEN shtr.pageloadtime != -1 THEN shtr.pageloadtime ELSE 0 END),0)/1000::numeric, 2) AS min,  round(COALESCE(max(CASE WHEN shtr.pageloadtime != -1 THEN shtr.pageloadtime ELSE 0 END),0)/1000::numeric, 2) AS max,  round(COALESCE(avg(CASE WHEN shtr.pageloadtime != -1 THEN shtr.pageloadtime ELSE 0 END),0)/1000::numeric, 2) AS avg,  count(CASE WHEN shtr.pageloadtime = -1 THEN 1 ELSE NULL END) AS error  FROM sum_test_master sm LEFT JOIN sum_har_test_results shtr ON shtr.test_id = sm.test_id WHERE sm.test_id = $1 and sm.user_id = $2 AND shtr.received_on BETWEEN to_timestamp($3) and to_timestamp($4)';
    const queryParam = [req.body.testId, userId, req.body.startDateSec, req.body.endDateSec];
    psqlAPM.fnDbQuery('getSumMeasurementData',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
        res.json({success:false, invalidToken : false, message:'Failed to get measurements of Test ID '+req.body.testId});
      else 
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getEditSumData', async (req, res) => {
  try {
    const queryText = 'SELECT * from get_edit_sum_test ($1)';
    const queryParam = [req.body.testId];
    psqlAPM.fnDbQuery('getEditSumData',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
        res.json({success:false, invalidToken : false, message:'Failed to get details of Test ID '+req.body.testId});
      else 
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//get Rum Data for edit
router.post('/getEditRumData', async (req, res) => {
  try {
    const queryText = 'SELECT mm.module_name, mm.uid, mm.guid, mm.description, ssr.sla_id, ssr.warning_threshold_value/1000 as warning, ssr.critical_threshold_value/1000 as critical, ssr.min_breach_count as breachCnt, ss.is_active as resp_time_alert FROM module_master mm LEFT JOIN so_sla_rum ssr ON ssr.uid = mm.uid LEFT JOIN so_sla ss ON ss.sla_id = ssr.sla_id WHERE mm.uid = $1';
    const queryParam = [req.body.uid];

    psqlAPM.fnDbQuery('getEditRumData',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
        res.json({success:false, invalidToken : false, message:'Failed to get details of Test ID '+req.body.testId});
      else 
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Add Rum module
router.post('/addUpdateRum', async (req, res) =>{
  try{
      let d = Date.now();
      let queryText, queryParam, methodName;
      let msg; let errMsg;
      if (req.body.uid == undefined) {
        methodName = 'addRum';
        queryText = 'SELECT add_rum ($1, $2, $3, $4, $5, $6, $7, $8)';
        queryParam = [req.decoded.userId, req.body.moduleName, req.body.description, req.body.eid, req.body.respTimeAlert, req.body.warning, req.body.critical, req.body.breachCount];
        msg = "Successfully Added RUM";
        errMsg = "Failed to add the RUM";
      } else {
        methodName = 'updateRum';
        queryText = 'SELECT update_rum ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
        queryParam = [req.decoded.userId, req.body.uid, req.body.moduleName, req.body.description, req.body.eid, req.body.respTimeAlert, req.body.warning, req.body.critical, req.body.breachCount];
        msg = "Successfully updated RUM";
        errMsg = "Failed to update the RUM for uid "+ req.body.uid;
      }
      psqlAPM.fnDbQuery(methodName, queryText, queryParam, null, null).then( result => {
        if (result.rowCount > 0 ) {
          res.json({success:true, message:msg, result : result.rows });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:errMsg});
          else {
            if (result.message.toLowerCase().includes("duplicate")){
              res.json({success:false, invalidToken : false, message:"RUM with same name already Exist"});
            } else {
              res.json(result);
            }
          }
        }
      });
    
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateRum', async (req, res) =>{
  try{

      let d = Date.now();
      let queryText, queryParam;
      queryText = 'SELECT update_rum ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
      queryParam = [req.decoded.userId, req.body.uid, req.body.moddule_name, req.body.description, req.body.eid, req.body.respAlert, req.body.warning, req.body.critical, req.body.breachCount];
      
      psqlAPM.fnDbQuery('updateRum',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ) {
          res.json({success:true, message:"Rum Updated successfully.", result : result.rows });
        }  else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:'Rum updation failed.'});
          else 
            res.json(result);
        }
      });
    
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

async function insertAVMAgentMapping(avmTestId,cities){
  let selCities = JSON.parse(cities);
  let queryParam = [];
  let req = null;
  let res = null;
  let qryText = "INSERT INTO avm_test_agent_mapping(avm_test_id, country, state, city, region, zone) VALUES "
  selCities.map((city,idx)=>{
    qryText = qryText+"("+avmTestId+",'"+city.country+"','"+city.state+"','"+city.city+"','"+city.region+"','"+city.zone+"')"
    if (idx<selCities.length-1){
      qryText = qryText+","
    }
  });
  let result = psqlAPM.fnDbQuery('insertAVMAgentMapping',qryText, queryParam, req, res);
  if (result.rowCount > 0 ) {
    return true;
  } else {
    return false;
  }
}

async function updateAVMAgentMapping(avmTestId,cities){
  let selCities = JSON.parse(cities);
  let queryParam = [];
  let req = null;
  let res = null;
  let queryText = "DELETE FROM avm_test_agent_mapping WHERE avm_test_id = $1";
  queryParam = [avmTestId];
  let result = await psqlAPM.fnDbQuery('updateAVMAgentMapping - delete',queryText, queryParam, req, res);
  if(!result.error){
    queryParam =[];
    let qryText = "INSERT INTO avm_test_agent_mapping(avm_test_id, country, state, city, region, zone) VALUES "
    selCities.map((city,idx)=>{
      qryText = qryText+"("+avmTestId+",'"+city.country+"','"+city.state+"','"+city.city+"','"+city.region+"','"+city.zone+"')"
      if (idx<selCities.length-1){
        qryText = qryText+","
      }
    });
    let result1 = await psqlAPM.fnDbQuery('updateAVMAgentMapping - insert',qryText, queryParam, req, res);
    if (result1.rowCount > 0 ) {
      return true;
    }  else {
      return false;
    }
  } else 
    return false;
}
