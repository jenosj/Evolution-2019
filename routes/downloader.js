const Router = require('express-promise-router')
const jwt = require('jsonwebtoken');
const { Pool } = require('pg')
const PgConfig = require('../config/apd_constants');
const pool = new Pool (PgConfig.pgDbConfig);
const dateFormat = require('dateformat');
const pgCustom = require('./psqlCustom');
const pgDbAuth = require('./pgDbAuth');
var url = require('url');
var path = require("path");

const fs = require('fs');
var AdmZip = require('adm-zip');
global.logger = require('../log');
//console.log(PgConfig.privateKey);
 
// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router()

// export our router to be mounted by the parent application
module.exports = router;
module.exports.prepareDownloadObj = prepareDownloadObj;

let appedoConfigProperties = {}, agentVersion = {}, agentDownloadPath = {};

function prepareDownloadObj(req, res, zip) {
  //console.log(req.decoded);
  let type = req.query.type;
  let guid = req.query.guid;
  let encryptedUserId = req.query.hasOwnProperty('encryptedUserId') ? req.query.encryptedUserId : '';
  let entId = req.query.hasOwnProperty('entId') ? req.query.entId.trim().length > 0 ? req.query.entId : 0 : 0;
  console.log(type+' '+guid+' '+encryptedUserId+' '+entId);
  let replaceObj = {};
  
  var agentObj = {};

  if (type == 'AVM') {
    agentObj = {counter_type_name: 'AVM', module_name: 'AVM', monitor_build_module_name: 'APPEDO_AVM_AGENT', monitor_agent_full_path: PgConfig.resourcePath+PgConfig.downloads+'/appedo_avm_agent/', monitor_guid_files: 'start_monitor.sh, start_monitor.bat, install.sh, install.bat, config.properties'};
  }else if (type == 'AVM_Node') {
    agentObj = {counter_type_name: 'AVM', module_name: 'AVM', monitor_build_module_name: 'APPEDO_AVM_AGENT', monitor_agent_full_path: PgConfig.resourcePath+PgConfig.downloads+'/appedo_avm_agent_node/', monitor_guid_files: 'config/apd_constants.js'};
  } else {
    agentObj = pgDbAuth.agentDownloadPath[type];
    console.log(agentObj);
    if (!agentObj.monitor_agent_full_path.endsWith('/')) {
      agentObj.monitor_agent_full_path=agentObj.monitor_agent_full_path+'/';
    }
    //agentObj.monitor_agent_full_path="C:\\Appedo\\resource\\downloads\\windows_monitor_agent_installer"
    //agentObj.monitor_agent_full_path="C:\\Appedo\\resource\\downloads\\windows_filebeat\\"
    //agentObj.monitor_agent_full_path="C:\\Appedo\\resource\\downloads\\linux_monitor_agent_installer";
  }

  //agentObj.monitor_agent_full_path="C:\\Appedo\\resource\\downloads\\appedo_avm_agent_node\\";
  let version = pgDbAuth.agentVersion[agentObj.monitor_build_module_name];
   
  agentObj.fullPath = agentObj.monitor_agent_full_path.replace(/#VERSION#/gi, version)+'/';
  
  var filename;
  filename = path.basename(agentObj.fullPath);

  res.setHeader('Content-Disposition', 'attachment; filename='+filename+'.zip');

  replaceObj.version = version;
  replaceObj.guid = guid;
  replaceObj.type = type;
  replaceObj.entId = entId;
  replaceObj.encryptedUserId = encryptedUserId;
  if (type == 'AVM_Node') {
    //replaceObj.location = req.query.location;
    replaceObj.collectorURL = pgDbAuth.appedoConfigProperties.AVM_COLLECTOR_NODE;
    replaceObj.schedulerURL = pgDbAuth.appedoConfigProperties.AVM_SCHEDULER;
    replaceObj.servicesURL = pgDbAuth.appedoConfigProperties.AVM_UI_SERVICES_V1;
  } else if (type == 'AVM') {
    replaceObj.location = req.query.location;
    replaceObj.collectorURL = getAsUrl(JSON.parse(pgDbAuth.appedoConfigProperties.AVM_COLLECTOR));
  } else if (type == 'LINUX_MONITOR_AGENT_INSTALLER') {
    replaceObj.collectorURL = pgDbAuth.appedoConfigProperties.APPEDO_URL_2018;
  } else if (type == 'WINDOWS_MONITOR_AGENT_INSTALLER') {
    replaceObj.collectorURL = pgDbAuth.appedoConfigProperties.APPEDO_URL_2018;
  } else if (type == 'LINUX_UNIFIED') {
    replaceObj.collectorURL = getAsUrl(JSON.parse(pgDbAuth.appedoConfigProperties.MONITOR_COLLECTOR)); 
  } else if (type == 'PROFILER_SETUP_INSTALLER') {
    replaceObj.collectorURL = pgDbAuth.appedoConfigProperties.APPEDO_URL_2018;
  } else if (type == 'GLOWROOT_PROFILER_AGENT') {
    replaceObj.collectorURL = pgDbAuth.appedoConfigProperties.GLOWROOT_COLLECTOR_URL;
  } else if (type == 'WINDOWS_FILEBEAT') {
    replaceObj.collectorObj = JSON.parse(pgDbAuth.appedoConfigProperties.MONITOR_COLLECTOR);
  } else {
    replaceObj.collectorURL = getAsUrl(JSON.parse(pgDbAuth.appedoConfigProperties.RUM_COLLECTOR));
  }
  
  
  zip.addLocalFolder(agentObj.fullPath);
  
  loadAndCompress(agentObj, replaceObj, zip, function(zip) {
    //res.headers['ContentType']="application/octet-stream";
    //res.headers['ContentDisposition'] = "attachment";
    //res.headers.ContentDisposition.FileName = 'test123';
    res.send(zip.toBuffer());
  });
  
}
  

function getAsUrl(urlObj) {
  return urlObj.protocol+'://'+urlObj.server+(urlObj.port.length >0?':'+urlObj.port:'')+'/'+urlObj.application_name;
}

/*function getIncomingUrl(req) {
  return url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: req.originalUrl
  });
}*/

function getIncomingUrl(req) {
  if(req.originalUrl.endsWith('details_snippet.php')){
    return url.format({
      protocol: req.protocol,
      host: req.get('host'),
      pathname: req.originalUrl,
      query: {
        snippet: req.body.snippet,
        test: req.body.test,
        run: req.body.run,
        cached: req.body.cached,
        step: req.body.step
      }
    });
  }else{
    return url.format({
      protocol: req.protocol,
      host: req.get('host'),
      pathname: req.originalUrl
    });
  }
}

function getIncomingUrlWithoutParam(req) {
  return url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: req.baseUrl
  });
}

function replaceAppedoWhiteLabels (content) {
  var totWhiteLabel = Object.keys(pgDbAuth.appedoWhiteLabels).length;
  console.log(totWhiteLabel);
  for (var i=0; i< totWhiteLabel; i++) {
    let key = Object.keys(pgDbAuth.appedoWhiteLabels)[i];
    let value = pgDbAuth.appedoWhiteLabels[key];
    //console.log(key+' '+value);
    //var replaceKey = '/@'+key+'@/g';
    var replaceKey = new RegExp('@'+key+'@', 'g');
    //console.log(replaceKey);
    content = content.replace(replaceKey, value);
  }
  return content;
}

function loadAndCompress(agentObj, replaceObj, zip, returnZip ) {

  //zip.addLocalFolder(dir);
  let replaceFiles = agentObj.monitor_guid_files.split(',');
  //console.log(replaceFiles);
  //console.log(replaceObj);
  let fileCount = replaceFiles.length;
  let processedCount = 0;
  replaceFiles.forEach(function(filename) {
    filename = filename.trim();
    if(filename.charAt(0) == '/') {
      filename = filename.substring(1,filename.length);
    }
    fs.readFile(agentObj.fullPath + filename, 'utf-8', function(err, content) {
      //filename='Rum_head.txt';
      //console.log(filename);
      //console.log(content);
      if (err) {
        console.log(err);
        return;
      }
      //console.log(replaceObj);
      content = replaceAppedoWhiteLabels(content);
      content = content.replace(/#VERSION#/gi, replaceObj.version);
      if (replaceObj.type == 'AVM') {
        content = content.replace(/@GUID@/gi, replaceObj.guid).replace(/@WEBSERVICE_URL@/gi, replaceObj.collectorURL).replace(/@LOCATION@/gi, replaceObj.location).replace(/@ENCRYPTED_USER_ID@/gi, replaceObj.encryptedUserId);
      } else if (replaceObj.type == 'AVM_Node') {
        content = content.replace(/@AVM_SCHEDULER@/gi, replaceObj.schedulerURL).replace(/@AVM_COLLECTOR@/gi, replaceObj.collectorURL).replace(/@AVM_UI_SERVICES_V1@/gi, replaceObj.servicesURL);
      } else if (replaceObj.type == 'LINUX_MONITOR_AGENT_INSTALLER') {
        content = content.replace(/@encrypted_userid@/gi, replaceObj.encryptedUserId).replace(/@APPEDO_URL_2018@/gi, pgDbAuth.appedoConfigProperties.APPEDO_URL_2018).replace(/@APPEDO_URL@/gi, pgDbAuth.appedoConfigProperties.APPEDO_URL).replace(/@MODULE_SERVICE@/gi, pgDbAuth.appedoConfigProperties.MODULE_UI_SERVICES).replace(/@enterpriseId@/gi, replaceObj.entId != '0' ? replaceObj.entId : '0');
      } else if (replaceObj.type == 'WINDOWS_MONITOR_AGENT_INSTALLER') {
        content = content.replace(/@encrypted_userid@/gi, replaceObj.encryptedUserId).replace(/@APPEDO_URL_2018@/gi, pgDbAuth.appedoConfigProperties.APPEDO_URL_2018).replace(/@APPEDO_URL@/gi, pgDbAuth.appedoConfigProperties.APPEDO_URL).replace(/@MODULE_SERVICE@/gi, pgDbAuth.appedoConfigProperties.MODULE_UI_SERVICES).replace(/@enterpriseId@/gi, replaceObj.entId != '0' ? replaceObj.entId : '0');
      } else if (replaceObj.type == 'LINUX_UNIFIED') {
        content = content.replace(/@encrypted_userid@/gi, replaceObj.encryptedUserId).replace(/@COLLECTOR_URL@/gi, replaceObj.collectorURL).replace(/@COLLECTOR_NODE_URL@/gi, pgDbAuth.appedoConfigProperties.AVM_COLLECTOR_NODE).replace(/@MODULE_SERVICE@/gi, pgDbAuth.appedoConfigProperties.MODULE_SERVICES).replace(/@enterpriseId@/gi, replaceObj.entId != '0' ? replaceObj.entId : '0');
      } else if (replaceObj.type == 'GLOWROOT_PROFILER_AGENT') {
        content = content.replace(/@GUID@/gi, replaceObj.guid).replace(/@COLLECTOR_URL@/gi, replaceObj.collectorURL);
      } else if (replaceObj.type == 'PROFILER_SETUP_INSTALLER') {
        content = content.replace(/@ent_id@/gi, replaceObj.entId != '0' ? replaceObj.entId : 0).replace(/@APP_URL@/gi, replaceObj.collectorURL).replace(/@MODULE_SERVICE@/gi, pgDbAuth.appedoConfigProperties.MODULE_UI_SERVICES);
      } else if (replaceObj.type == 'WINDOWS_FILEBEAT') {
        content = content.replace(/@LS_IP@/gi, pgDbAuth.appedoConfigProperties.WINDOWS_LOGSTASH_IP).replace(/@LS_PORT@/gi, pgDbAuth.appedoConfigProperties.WINDOWS_LOGSTASH_PORT).replace(/@MODULE_SERVICE@/gi, pgDbAuth.appedoConfigProperties.MODULE_UI_SERVICES).replace(/@APPEDO_URL_2018@/gi, pgDbAuth.appedoConfigProperties.APPEDO_URL_2018).replace(/@APPEDO_URL@/gi, pgDbAuth.appedoConfigProperties.APPEDO_URL).replace(/@PROTOCOL@/gi, replaceObj.collectorObj.protocol).replace(/@SERVER@/gi, replaceObj.collectorObj.server).replace(/@PORT@/gi, replaceObj.collectorObj.port).replace(/@APPLICATION_NAME@/gi, replaceObj.collectorObj.application_name).replace(/@eid@/gi, replaceObj.entId != '0' ? replaceObj.entId : '');
      } else if (replaceObj.type == 'FILEBEAT_LINUX') {
        content = content.replace(/@LS_IP@/gi, pgDbAuth.appedoConfigProperties.LOGSTASH_IP).replace(/@LS_PORT@/gi, pgDbAuth.appedoConfigProperties.LOGSTASH_PORT);
      } else if (replaceObj.type == 'APACHEMETRICBEAT_LINUX') {
        content = content.replace(/@LS_IP@/gi, pgDbAuth.appedoConfigProperties.LOGSTASH_IP).replace(/@LS_PORT@/gi, pgDbAuth.appedoConfigProperties.LOGSTASH_PORT);
      } 
      else {
        content = content.replace(/@GUID@/gi, replaceObj.guid).replace(/@RUM_COLLECTOR_URL@/gi, replaceObj.collectorURL);
      }
      processedCount++;
      console.log(processedCount);
      //PROFILER_SETUP_INSTALLER
      //console.log(content);
      zip.updateFile(filename, Buffer.alloc(content.length, content));
      //console.log(zip);
      if (fileCount == processedCount) {
        returnZip(zip);
      }
    });
  });
  
}

router.get('/getUrl/*', async (req, res) => {
  replaceWPTUrl(req, res);
});

router.post('/getUrl/*', async (req, res) => {
  replaceWPTUrl(req, res);
});

router.get('/downloadAgent', async (req, res) => {
  //console.log(req.decoded);
  //res.setHeader('Content-Disposition', 'attachment; filename=test.zip');
  var zip = new AdmZip();
  res.setHeader('Content-Transfer-Encoding', 'binary');
  //res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-type', 'application/zip');
  prepareDownloadObj(req, res, zip);
  
});

router.use((req,res,next) => {
  const token = req.headers['authorization'];
  if (!token){
    res.json({success:false, invalidToken : true ,message: 'No token provided'});
  } else {
    jwt.verify(token, PgConfig.privateKey, (err,decoded) => {
      if(err) {
        res.json({success:false, invalidToken : true, message:'Token invalid '+ err});
      } else {
        //console.log("req.decoded has decoded token");
        req.decoded = decoded;
        next();
      }
    })
  }
});

router.get('/verifiedDownloadAgent', async (req, res) => {
  console.log(req.decoded);
  //res.setHeader('Content-Disposition', 'attachment; filename=test.zip');
  var zip = new AdmZip();
  res.setHeader('Content-Transfer-Encoding', 'binary');
  //res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-type', 'application/zip');
  prepareDownloadObj(req, res, zip);
});

function replaceWPTUrl(req, res) {
  //console.log(req);

  let fullUrlwithParam = getIncomingUrl(req);
  let fullUrl = getIncomingUrlWithoutParam(req);
  var appConfig = JSON.parse(pgDbAuth.appedoConfigProperties['WPT_APPEDO_REDIRECTOR_EVOLUTION_2018']);
  //var appConfig = JSON.parse(pgDbAuth.appedoConfigProperties['WPT_APPEDO_REDIRECTOR']);
  //var appConfig_evo2018 = JSON.parse(pgDbAuth.appedoConfigProperties['WPT_APPEDO_REDIRECTOR_EVOLUTION_2018']);

  //console.log(appConfig);
  //console.log(appConfig_evo2018);

  var wptHostUrl=appConfig[0].wpt_server_url;
  var redirectorUrl = appConfig[0].redirector_url;
  var wptUrl = fullUrlwithParam.replace(fullUrl+'/getUrl/', wptHostUrl);
  //redirectorUrl='http://localhost:3000/wpt/getUrl/';
  //console.log('wptHostUrl: '+ wptHostUrl);
  //console.log('redirectorUrl: '+ redirectorUrl);
  //redirectorUrl='http://localhost:3000/wpt/getUrl/';
  //wptUrl = 'https://wpt.appedo.com/getfile.php?test=181003_1P_G2&file=1_screen.jpg'
  wptUrl = decodeURIComponent(wptUrl);
  //console.log('wptUrl: '+ wptUrl);
  
  if (wptUrl.indexOf('.jpg') >0 || wptUrl.indexOf('.gif') >0 || wptUrl.indexOf('.png') >0 || wptUrl.indexOf('.jpeg') >0) {
    //console.log("in if part") 
    res.setHeader("content-disposition", "attachment; filename=test.png");
    request.get(wptUrl).on('error', function(error) {console.log(error)}).pipe(res);
  } else {
    //console.log("in else part")
    request({url:wptUrl}, function (err, response, body) {
      if (err) { //return console.log(err);
        console.log(err); 
        body="<h3> URL is DOWN.</h3>"
        //res.json({success:false, error:true, message: 'URL is Down'});
      } else if (response.statusCode > 399) {
        body="<h3>"+response.statusCode+" Response returned.</h3>"
      } else {
        //console.log(response);
          var replaceVal = new RegExp('src=\"//', 'g');
          body = body.replace(replaceVal, 'src=\"'+pgDbAuth.appedoConfigProperties.APPEDO_URL.substring(0, pgDbAuth.appedoConfigProperties.APPEDO_URL.indexOf(':'))+ '://');
          replaceVal = new RegExp('src=\"/', 'g');
          body = body.replace(replaceVal, 'src=\"'+redirectorUrl);
          replaceVal = new RegExp('href=\"/', 'g');
          body = body.replace(replaceVal, 'href=\"'+redirectorUrl);
          //replaceVal = new RegExp('url(\/', 'g');
          body = body.replace(/url\(\//gi, 'url('+redirectorUrl);
          //replaceVal = new RegExp('url(\'/', 'g');
          body = body.replace(/url\(\'\//gi, 'url(\''+redirectorUrl);
          replaceVal = new RegExp('\"/details_snippet.php\"', 'g');
          body = body.replace(replaceVal, '\"'+redirectorUrl+'details_snippet.php\"');

        res.write(body);
        res.end();
      }
    });
  }

}


