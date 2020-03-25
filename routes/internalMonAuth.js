const Router = require('express-promise-router')
const jwt = require('jsonwebtoken');
const PgConfig = require('../config/apd_constants');
const dateFormat = require('dateformat');
global.logger = require('../log');
const psqlAPM = require('./psqlAPM');
const pgDbAuth = require('./pgDbAuth');

// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router()
let sumConnectors = [];
let sumDeviceTypes = [];

// export our router to be mounted by the parent application
module.exports =  router;

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

router.post('/getAlertSLADetails', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let eIdQry = req.body.e_id == null ? '' : " AND s.e_id = "+req.body.e_id;
    let queryText;
    let queryParam;
    let queryUnion = "SELECT s.sla_id, s.sla_name, CASE WHEN sd.is_above_threshold THEN '>=' ELSE '<=' END || sd.warning_threshold_value as warning, CASE WHEN sd.is_above_threshold THEN '>=' ELSE '<=' END ||sd.critical_threshold_value as critical, 'ms' as unit, 'rum' module FROM so_sla s JOIN so_sla_rum sd on s.sla_id = sd.sla_id WHERE s.user_id=$1 UNION SELECT s.sla_id, s.sla_name, '>=' || sd.warning_limit as warning, '>='||sd.error_limit as critical, 'sec' as unit,'sum' module FROM so_sla s JOIN so_sla_sum sd on s.sla_id = sd.sla_id WHERE s.user_id=$1 AND sum_type='RESPONSE_MONITORING' UNION SELECT s.sla_id, s.sla_name, '>=' || sd.warning_limit as warning, '>='||sd.error_limit as critical, 'sec' as unit, 'avm' module FROM so_sla s JOIN so_sla_sum sd on s.sla_id = sd.sla_id WHERE s.user_id=$1 AND sum_type='AVAILABILITY_MONITORING' UNION SELECT s.sla_id, s.sla_name ||'('|| CASE breach_pattern WHEN null THEN 'GROK Column: ' ELSE 'Pattern: ' END || COALESCE(breach_pattern,grok_column)||')' as sla_name, CASE WHEN sd.is_above_threshold THEN '>=' ELSE '<=' END || sd.warning_threshold_value as warning, CASE WHEN sd.is_above_threshold THEN '>=' ELSE '<=' END ||sd.critical_threshold_value as critical,'' as unit, 'log' as module FROM so_sla s JOIN so_sla_log sd on s.sla_id = sd.sla_id WHERE s.user_id=$1 ";
    queryText = "SELECT distinct sd.uid FROM so_sla s JOIN so_sla_counter sd ON s.sla_id = sd.sla_id WHERE s.user_id=$1"+eIdQry;
    queryParam = [userId];
    let result = await psqlAPM.fnDbQuery('getAlertSLADetails-uniqueUids',queryText, queryParam, req, res);
    let resQry;
    if ( result.rowCount > 0 ){
      //prepare query for each uid
      resQry = await fnQryUnion(result.rows);
    }
    queryUnion = queryUnion+resQry;
    let result1 = await psqlAPM.fnDbQuery('getAlertSLADetails-uniqueUids',queryUnion, queryParam, req, res);
    if (result1.rowCount>0){
      res.json({success:true, message:"Success", rowCount:result1.rowCount, result:result1.rows});
    }  else {
      if(!result.error)
        res.json({success:true, invalidToken : false, rowCount:0, message:"No SLA found"});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

async function fnQryUnion(arr){
  let queryUnion ='';
  await arr.map(ele => {
    queryUnion += " UNION SELECT s.sla_id, s.sla_name, CASE WHEN sd.is_above_threshold THEN '>=' ELSE '<=' END || sd.warning_threshold_value as warning, CASE WHEN sd.is_above_threshold THEN '>=' ELSE '<=' END ||sd.critical_threshold_value as critical, cm.unit, 'metric' module FROM so_sla s JOIN so_sla_counter sd on s.sla_id = sd.sla_id JOIN counter_master_"+ele.uid+" cm ON cm.counter_id = sd.counter_id WHERE s.user_id=$1"
  });
  return queryUnion;
};

router.post('/getAVMThresholdBreachMetrics', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = 'so_avm_breach_'+userId;
    // let eId = req.body.owner_id == null ? '' : ' AND enterprise_id = '+req.body.e_id;
    const queryText = "SELECT breached_severity, COUNT(*) FROM "+tableName+" WHERE received_on BETWEEN $1 AND $2 GROUP BY 1";
    const queryParam = [req.body.startDt, req.body.endDt];
    psqlAPM.fnDbQuery('getAVMThresholdBreachMetrics',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:true, invalidToken : false, rowCount:0, result:[{breached_severity: "WEBSITE_UNREACHABLE", count: "0"},{breached_severity: "AGENT_DOWN", count: "0"}]});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getUIDsForBreach', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = req.body.table_name+userId;
    let columnName;
    let queryText;
    let queryParam;
    if (req.body.table_name == 'so_threshold_breach_') {columnName = 'tb.received_on';}
    else if (req.body.table_name == 'so_log_threshold_breach_') {columnName = 'tb.appedo_received_on';}
    else if (req.body.table_name == 'so_avm_breach_') {columnName = 'tb.received_on';}
    queryText = "select tb.uid, mm.system_id, COALESCE(si.system_name,'Not Available') as system_name FROM "+tableName+" tb JOIN module_master as mm ON tb.uid = mm.uid LEFT JOIN server_information si ON si.system_id = mm.system_id WHERE "+columnName+" BETWEEN $1 AND $2 group by 1,2,3";
    queryParam = [req.body.start_dt, req.body.end_dt];
    let result = await psqlAPM.fnDbQuery('getUIDsForBreach',queryText, queryParam, req, res);
    if ( result.rowCount > 0 ){
      res.json({success:true, message:"Success", result: result.rows});
    }  else {
      if(!result.error)
        res.json({success:false, invalidToken : false, message:"No Alerts"});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getASMetricDetails', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = req.body.table_name+userId;
    let queryText;
    let queryParam;
    if (req.body.table_name == 'so_threshold_breach_'){
      let tableName2 = "counter_master_"+req.body.uid;
      queryText = "SELECT tb.received_on, cm.category||':'||cm.counter_name as metric_name,CASE WHEN tb.is_above THEN '>=' || CASE WHEN tb.breached_severity ='CRITICAL' THEN tb.critical_threshold_value ELSE tb.warning_threshold_value END ||COALESCE(cm.unit,'')  ELSE '<=' || CASE WHEN tb.breached_severity ='CRITICAL' THEN tb.critical_threshold_value ELSE tb.warning_threshold_value  END ||''||COALESCE(cm.unit,'') END as threshold_value, ROUND(tb.received_value) ||''||cm.unit as received_value, tb.breached_severity FROM "+tableName+" tb JOIN "+tableName2+" cm ON tb.counter_id = cm.counter_id WHERE received_on BETWEEN $1 AND $2 order by received_on desc";
    } else if (req.body.table_name == 'so_log_threshold_breach_'){
      queryText = "SELECT appedo_received_on AS received_on, replace(received_message,CHR(10),'') message, breach_pattern, upper(breached_severity) breached_severity FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 1 desc";
    } else if (req.body.table_name == 'so_avm_breach_'){
      queryText = "SELECT tb.received_on, atm.testurl, tb.city, tb.breached_severity, tb.received_status FROM "+tableName+" tb JOIN avm_test_master atm ON atm.avm_test_id = tb.avm_test_id WHERE tb.received_on BETWEEN $1 and $2 ORDER BY 1 DESC";
    } else if (req.body.table_name == 'so_sum_threshold_breach_'){
      queryText = "SELECT tb.received_on, stm.testname||'('||stm.testtype||')' as test_name, tb.breached_severity, '>='||CASE tb.breached_severity WHEN 'CRITICAL' THEN tb.err_set_value ELSE tb.threshold_value END as threshold_value_sec, tb.received_value as received_value_sec FROM "+tableName+" tb JOIN so_sla_sum sss ON sss.sla_sum_id = tb.sla_sum_id JOIN sum_test_master stm ON stm.test_id= sss.sum_test_id WHERE tb.received_on BETWEEN $1 and $2 ORDER BY 1 DESC";
    } else if (req.body.table_name == 'so_rum_threshold_breach_'){
      queryText = "SELECT tb.received_on, mm.module_name as rum_name, tb.breached_severity, '>='||CASE tb.breached_severity WHEN 'CRITICAL' THEN tb.critical_threshold_value ELSE tb.warning_threshold_value END as threshold_value_sec, tb.received_value as received_value_sec FROM "+tableName+" tb JOIN module_master mm ON tb.uid = mm.uid WHERE tb.received_on BETWEEN $1 and $2 ORDER BY 1 DESC";
    }
    queryParam = [req.body.start_dt, req.body.end_dt];
    let result = await psqlAPM.fnDbQuery('getASMetricDetails',queryText, queryParam, req, res);
    if ( result.rowCount > 0 ){
      res.json({success:true, message:"Success", result: result.rows});
    } else {
      if(!result.error)
        res.json({success:true, invalidToken : false, message:"No Alerts", result:[{recevied_on:req.body.end_dt, message:'No Alerts',breach_pattern:null,breached_severity:'HEALTHY'}]});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//get metric unit
router.post('/getMetricUnit', async(req,res)=>{
  try{
    let tableName = "counter_master_"+req.body.uid
    const queryText = "SELECT unit FROM "+tableName+" WHERE counter_id = $1";
    const queryParam = [req.body.metricId];
    psqlAPM.fnDbQuery('getMetricUnit',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:"Record not found"});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/resendOTP', async(req,res)=>{
  try{
    let queryText;
    let queryParam;
    let verify_link = null;
    queryText = "SELECT verify_link FROM so_alert WHERE sla_setting_id = $1";
    queryParam = [req.body.sla_setting_id];
    let msg = "Successfully updated Record. OTP has been sent to your mobile number. please Validate OTP to start receiving SMS alerts";
    psqlAPM.fnDbQuery('resendOTP',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        console.log(result.rows);
        verify_link = result.rows[0].verify_link;
        console.log(verify_link);
        var url = pgDbAuth.appedoConfigProperties.APPEDO_SLA_COLLECTOR;
        //var url = 'http://localhost:8080/Appedo-SLA-Collector/slaCollector';
        var SMSBody = 'Your otp code is '+verify_link+' for Appedo SMS verification.';
        console.log(SMSBody);
        var ToSMS = req.body.email_mobile;
        var formData ={command: 'sendOTPCode', SMSBody: SMSBody, ToSMS: ToSMS};
        request.post(url,{form: formData}, function (httpError, httpResp, body) {
          if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && isJSON(body) && !JSON.parse(body).success)) {
            logger.error('Sending mail failed.' + httpError);
            res.json({ success: true, invalidToken: false, message: msg+", OTP failed to send. Contact system admin"});
          } else {
            res.json({ success: true, invalidToken: false, message: msg+" sent for verification."});
          }
        });
      }
    });
  }catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//update Alert email/sms
router.post('/updateAddAlertsEmailSms', async(req,res)=>{
  try{
    let queryText;
    let queryParam;
    let createdBy = req.decoded.userId;
    let isValid;
    let insertQry = true;
    let verify_link = null;
    req.body.alert_type = req.body.alert_type.toLowerCase() == 'email' ? 'Email' : req.body.alert_type;
    if (req.body.alert_type.toLowerCase() == 'sms'){
      verify_link = Math.floor(Math.random()*(9999-1000)+1000);
      req.body.validated_on = null;
      isValid = false
    } else {
      isValid = req.body.validated_on == null ? false : true;
    }

    if (req.body.sla_setting_id != null){
      queryText = "UPDATE so_alert SET alert_type = $2, email_mobile = $3, validated_on = $4, is_valid = $5, modified_by=$6, modified_on = now(), verify_link=$7 WHERE sla_setting_id = $1";
      queryParam = [req.body.sla_setting_id, req.body.alert_type, req.body.email_mobile, req.body.validated_on, isValid, req.decoded.userId,verify_link];
      if (req.body.alert_type.toLowerCase()=="sms"){
        msg = "Successfully updated Record. OTP has been sent to your mobile number. please Validate OTP to start receiving SMS alerts"
      } else {
        msg = "Successfully updated the selected record";
      }
    } else {
      isValid = false;
      qryDuplicate = "SELECT user_id FROM so_alert WHERE user_id = $1 AND email_mobile = $2";
      qryDupParam = [req.decoded.userId, req.body.email_mobile];
      let result = await psqlAPM.fnDbQuery("updateAddAlertsEmailSms-dupCheck",qryDuplicate,qryDupParam,null,null)
      if (result.rowCount > 0){
        insertQry = false;
      } else {
        queryText = "INSERT INTO so_alert (user_id, enterprise_id, alert_type, email_mobile, is_valid, created_by, created_on, verify_link) VALUES ($1,$2,$3,$4,$5,$6,now(),$7) RETURNING sla_setting_id";
        queryParam = [req.decoded.userId, req.body.e_id, req.body.alert_type, req.body.email_mobile, isValid,createdBy,verify_link];
        if (req.body.alert_type.toLowerCase()=="sms"){
          msg = "Successfully Inserted Record. OTP has been sent to your mobile number. please Validate OTP to start receiving SMS alerts";
        } else {
          msg = "Successfully inserted record, "+req.body.alert_type;
        }
      }
    }
    if (insertQry){
      psqlAPM.fnDbQuery('updateAddAlertsEmailSms',queryText, queryParam, req, res).then( result => {
        if ( result.rowCount > 0 ){
          if(!isValid){
            if (req.body.alert_type.toLowerCase()=="sms"){
              var url = pgDbAuth.appedoConfigProperties.APPEDO_SLA_COLLECTOR;
              //var url = 'http://localhost:8080/Appedo-SLA-Collector/slaCollector';
              var SMSBody = 'Your otp code is '+verify_link+' for Appedo SMS verification.';
              var ToSMS = req.body.email_mobile;
              var formData ={command: 'sendOTPCode', SMSBody: SMSBody, ToSMS: ToSMS};
              request.post(url,{form: formData}, function (httpError, httpResp, body) {
                if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && isJSON(body) && !JSON.parse(body).success)) {
                  logger.error('Sending mail failed.' + httpError);
                  res.json({ success: true, invalidToken: false, message: msg+", OTP failed to send. Contact system admin"});
                } else {
                  res.json({ success: true, invalidToken: false, message: msg+" sent for verification."});
                }
              });

            }else{
              var formData = {type: req.body.alert_type, emailornumber: req.body.email_mobile, IS_NON_LOGIN_USER: req.body.IS_NON_LOGIN_USER, userFirstName: req.body.userFirstName};

              let encryptData = {
                sla_setting_id: req.body.sla_setting_id != null ? req.body.sla_setting_id : result.rows[0].sla_setting_id
              };

              PgConfig.encrypt(JSON.stringify(encryptData)).then(res1 =>{
                let queryData = res1;
                formData.link = pgDbAuth.appedoConfigProperties.APPEDO_URL_2018+'verifySlaEmailAlerts/'+queryData;
      
                var url = pgDbAuth.appedoConfigProperties.MODULE_UI_SERVICES + '/sla/sendAlertVerifyMail';

                request.post(url,{form: formData}, function (httpError, httpResp, body) {
                  if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && isJSON(body) && !JSON.parse(body).success)) {
                    logger.error('Sending mail failed.' + httpError);
                    res.json({ success: true, invalidToken: false, message: msg+", Verification mail failed to send. Contact system admin"});
                  } else {
                    let msgExt = ""
                    if (req.body.alert_type.toLowerCase() == "email"){
                      msgExt += "Note: Check spam or junk if haven't received any mail.";
                    } 
                    res.json({ success: true, invalidToken: false, message: msg+" sent for verification."+ msgExt});
                  }
                });
              });
            }
          } else {
            res.json({success:true, message:msg});
          }
        } else {
          if(!result.error)
            res.json({success:false, invalidToken : false, message:"Record not found"});
          else 
            res.json(result);
        }
      });
    } else {
      res.json({success:false, message:"User & Email/Mobile already Exist"});
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

function isJSON(str) {
  try {
      var obj = JSON.parse(str);
      if (obj && typeof obj === 'object' && obj !== null) {
          return true;
      }
  } catch (err) {}
  return false;
}

//remove Alert email/sms
router.post('/removeAlertsEmailSms', async(req,res)=>{
  try{
    const queryText = "DELETE FROM so_alert WHERE sla_setting_id = $1";
    const queryParam = [req.body.sla_setting_id];
    psqlAPM.fnDbQuery('removeAlertsEmailSms',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Successfully removed the selected record"});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:"Record not found"});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/validateOTP', async(req,res)=>{
  try{
    const queryText = "SELECT verify_link FROM so_alert WHERE sla_setting_id=$1";
    const queryParam = [req.body.sla_setting_id];
    let result = await psqlAPM.fnDbQuery('validateOTP',queryText, queryParam, req, res)
    if ( result.success ){
      if (result.rows[0].verify_link == req.body.OTP){
        let qryText = "UPDATE so_alert SET validated_on = now(), is_valid = true, verify_link=null WHERE sla_setting_id = $1";
        await psqlAPM.fnDbQuery('validateOTP-update', qryText, queryParam);
        res.json({success:true, message : "OTP Validation Successful" });
      } else {
        res.json({success:false, message : "OTP Validation Failed" });
      }
    }  else {
      if(!result.error)
        res.json({success:false, invalidToken : false, message:"No Records found"});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get Alert email/sms
router.post('/getAlertsEmailSms', async(req,res)=>{
  try{
    let userId = req.decoded.userId;
    let eIdQry = req.body.e_id == null ? '' : ' AND enterprise_id = '+req.body.e_id
    let errMsg = req.body.e_name == null ? '' : ' for enterprise \"'+req.body.e_name+'"';
    const queryText = "SELECT sla_setting_id,LOWER(alert_type) alert_type,email_mobile,validated_on FROM so_alert WHERE user_id=$1 "+ eIdQry + " OFFSET $2 LIMIT $3";
    const queryParam = [userId, req.body.offset, req.body.limit];
    psqlAPM.fnDbQuery('getAlertsEmailSms',queryText, queryParam, req, res).then( result => {
      if ( result.success ){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:"Configure for first time" + errMsg});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get add/update Alert settings
router.post('/addUpdateAlertSettings', async(req,res)=>{
  try{
    let userId = req.decoded.userId;
    let data = req.body;
    let entMsg = req.body.eName == null ? '' : ' for enterprise \"'+req.body.eName+'"';
    let errMsg;
    let queryText;
    let queryParam;
    if (data.sla_setting_id == null){
      queryText = "INSERT INTO sa_sla_setting (user_id, enterprise_id, try_count_duration_in_min, trigger_alert_every_in_min, max_try_count, created_by, created_on) VALUES ($1,$2,$3,$4,$5,$1,now())";
      queryParam = [userId, data.e_id, data.try_count_duration_in_min, data.trigger_alert_every_in_min, data.max_try_count];
      errMsg = "Insert Failed "+entMsg;
      successMsg = "Successfully Inserted";
    } else {
      queryText = "UPDATE sa_sla_setting SET try_count_duration_in_min = $2, trigger_alert_every_in_min = $3, max_try_count = $4, modified_by = $1, modified_on = now() WHERE sla_setting_id = $5";
      queryParam = [userId, data.try_count_duration_in_min, data.trigger_alert_every_in_min, data.max_try_count, data.sla_setting_id];
      errMsg = "Update Failed "+entMsg;
      successMsg = "Successfully updated";
    }
    psqlAPM.fnDbQuery('addUpdateAlertSettings',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:successMsg, result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:errMsg});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get Alert settings
router.post('/getAlertSettings', async(req,res)=>{
  try{
    let userId = req.decoded.userId;
    let eId = req.body.entId == null ? '' : ' AND enterprise_id = '+req.body.entId
    let errMsg = req.body.eName == null ? '' : ' for enterprise \"'+req.body.eName+'"';
    const queryText = "SELECT sla_setting_id, try_count_duration_in_min, trigger_alert_every_in_min, max_try_count FROM sa_sla_setting WHERE user_id=$1 "+ eId;
    const queryParam = [userId];
    psqlAPM.fnDbQuery('getAlertSettings',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:"Setting for first time" + errMsg});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get breached SUM for given time interval
router.post('/getSUMThresholdBreachMetrics', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = 'so_sum_threshold_breach_'+userId;
    //enterprise is not implemented in sum module
    //let eId = req.body.owner_id == null ? '' : ' AND enterprise_id = '+req.body.e_id; 
    const queryText = "SELECT breached_severity, COUNT(*) FROM "+tableName+" WHERE received_on BETWEEN $1 AND $2 GROUP BY 1";
    const queryParam = [req.body.startDt, req.body.endDt];
    psqlAPM.fnDbQuery('getSUMThresholdBreachMetrics',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:true, invalidToken : false, rowCount:0, result:[{breached_severity: "CRITICAL", count: "0"},{breached_severity: "WARNING", count: "0"}]});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});
//Get breached RUM for given time interval
router.post('/getRUMThresholdBreachMetrics', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = 'so_rum_threshold_breach_'+userId;
    let eId = req.body.owner_id == null ? '' : ' AND enterprise_id = '+req.body.e_id;
    const queryText = "SELECT breached_severity, COUNT(*) FROM "+tableName+" WHERE received_on BETWEEN $1 AND $2" + eId +" GROUP BY 1";
    const queryParam = [req.body.startDt, req.body.endDt];
    psqlAPM.fnDbQuery('getRUMThresholdBreachMetrics',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:true, invalidToken : false, rowCount:0, result:[{breached_severity: "CRITICAL", count: "0"},{breached_severity: "WARNING", count: "0"}]});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get breached LOG for given time interval
router.post('/getLogThresholdBreachMetrics', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = 'so_log_threshold_breach_'+userId;
    let eId = req.body.owner_id == null ? '' : ' AND enterprise_id = '+req.body.e_id;
    const queryText = "SELECT upper(breached_severity) breached_severity, COUNT(*) FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2" + eId +" GROUP BY 1";
    const queryParam = [req.body.startDt, req.body.endDt];
    psqlAPM.fnDbQuery('getLogThresholdBreachMetrics',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:true, invalidToken : false, rowCount:0, result:[{breached_severity: "CRITICAL", count: "0"},{breached_severity: "WARNING", count: "0"}]});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get breached OAD for given time interval
router.post('/getThresholdBreachMetrics', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let tableName = 'so_threshold_breach_'+userId;
    let eId = req.body.owner_id == null ? '' : ' AND enterprise_id = '+req.body.e_id;
    const queryText = "SELECT breached_severity, COUNT(*) FROM "+tableName+" WHERE received_on BETWEEN $1 AND $2" + eId +" GROUP BY 1";
    const queryParam = [req.body.startDt, req.body.endDt];
    psqlAPM.fnDbQuery('getThresholdBreachMetrics',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:true, invalidToken : false, rowCount:0, result:[{breached_severity: "CRITICAL", count: "0"},{breached_severity: "WARNING", count: "0"}]});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


//Get SLA Count
router.post('/getSLACntForUsr', async(req,res)=>{
  try{
    let userId = req.body.owner_id == null ? req.decoded.userId : req.body.owner_id;
    let eId = req.body.owner_id == null ? '' : ' AND e_id = '+req.body.e_id;
    const queryText = "SELECT COUNT(*) FROM so_sla WHERE user_id = $1  "+eId;
    const queryParam = [userId];
    psqlAPM.fnDbQuery('getSLACntForUsr',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:true, invalidToken : false, result:{count:0}});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get System information
router.post('/getSystemContent', async(req,res)=>{
  try{
    let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
    const queryText = "SELECT si.system_id, TRIM(si.system_name) system_name, TRIM(si.manufacturer) as owner, si.created_on, um.first_name FROM server_information si JOIN usermaster um ON um.user_id = si.user_id WHERE um.user_id=$1 ORDER BY 3,2 OFFSET $2 LIMIT $3";
    const queryParam = [userId, req.body.offset, req.body.limit];
    psqlAPM.fnDbQuery('getSystemContent',queryText, queryParam, req, res).then( result => {
      if (result.success ){
        res.json({success:true, rowCount:result.rowCount, result:result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No System data for this user/Enterprise user'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get all module code for matching System id
router.post('/getModCodeCount', async(req,res)=>{
  try{
    const queryText = "SELECT LOWER(module_code) module_code, count(*), ARRAY_AGG(last_appedo_received_on) as last_received_on FROM module_master where system_id=$1 GROUP BY 1 ORDER BY 1";
    const queryParam = [req.body.systemId];
    psqlAPM.fnDbQuery('getModCodeCount',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No System data for this user'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//update system information table for given system id
router.post('/updateSystemInfo', async(req,res)=>{
  try{
    const queryText = "UPDATE server_information SET system_name = $2, manufacturer = $3  WHERE system_id = $1";
    const queryParam = [req.body.system_id,req.body.system_name,req.body.manufacturer];
    psqlAPM.fnDbQuery('updateSystemInfo',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, message:"Successfully updated for System id "+req.body.system_id });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'Update failed for system id '+req.body.system_id});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//get all module with last received on status for given system id
router.post('/getMappedModuleDetails', async(req,res)=>{
  try{
    const queryText = "SELECT uid,lower(module_code) module_code, module_type, module_name, last_appedo_received_on FROM module_master WHERE system_id = $1 ORDER BY 2,3,4";
    const queryParam = [req.body.system_id];
    psqlAPM.fnDbQuery('getMappedModuleDetails',queryText, queryParam, req, res).then( result => {
      if ( result.rowCount > 0 ){
        res.json({success:true, result: result.rows});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'Update failed for system id '+req.body.system_id});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getNumericColumnForTable', async (req, res) => {
  try {
    let queryText = "SELECT column_name FROM information_schema.columns WHERE table_name ='"+req.body.table+"' AND data_type IN ('integer','bigint','numeric','smallint')";
    let queryParam = [];
    psqlAPM.fnDbQuery('getNumericColumnForTable',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No column with data type numeric for table '+ req.body.table});
      else 
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLogLROByPattern', async (req, res) => {
  try {
    let table_name = req.body.log_table+req.body.uid;
    let queryText = "SELECT EXTRACT(epoch from max(appedo_received_on))*1000 as last_received_on from "+table_name ;
    let queryParam = [];
    psqlAPM.fnDbQuery('getLogLROByPattern',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No record found for '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

//Get Category name
router.post('/getCounterCategoryNames', async (req, res) => {
  try {
    let table_name = 'counter_master_'+req.body.uid;
    let queryText = "SELECT distinct lower(category) as category from "+table_name ;
    let queryParam = [];
    psqlAPM.fnDbQuery('getCounterCategoryNames',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No record found for '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/addCustomMetric', async (req, res) => {
  try {
    let table_name = 'counter_master_'+req.body.uid;
    let createdOn = Date.now();
    let queryText;
    let userId = req.decoded.userId;
    let queryParam = [];
    if (req.body.isNewCategory) {
      queryText = "INSERT INTO "+table_name+" (user_id, guid, execution_type, query_string, category, counter_name, display_name, unit, counter_description, created_on, created_by, is_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, true)" ;
      queryParam = [userId, req.body.guid, req.body.execType, req.body.queryStr, req.body.categoryName, req.body.counterName, req.body.counterName, req.body.unit, req.body.counterDesc, userId];
    } else {
      queryText = "INSERT INTO "+table_name+" (user_id, guid, execution_type, query_string, category, counter_name, display_name, unit, counter_description, created_on, created_by, is_enabled) SELECT $1, $2, $3, $4, category, $5, $6, $7, $8, now(), $9, true FROM "+table_name+" WHERE lower(category) = lower('"+req.body.categoryName+"') LIMIT 1 " ;
      queryParam = [userId, req.body.guid, req.body.execType, req.body.queryStr, req.body.counterName, req.body.counterName, req.body.unit, req.body.counterDesc, userId];
    }
    psqlAPM.fnDbQuery('addCustomMetric',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ) {
        res.json({success:true, message:"Successfully added Custom Metric, To configure, please use configure icon", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Failed to add Custom Metrics'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLogStatusByPattern', async (req, res) => {
  try {
    let uid = req.body.uid;
    let table_name = req.body.log_table+req.body.uid;
    let startTime = Date.now()/1000-60*60;
    let endTime = Date.now()/1000;
    let queryText; let queryParam;
    if (req.body.log_table == 'log_windows_event_')
    {
      queryText = "SELECT COALESCE(level,'Others') as level,count(id) from "+table_name+" where appedo_received_on between to_timestamp("+startTime+") AND to_timestamp("+endTime+") GROUP BY level order by level" ;
      queryParam = [];
    } else {
      queryText= "SELECT 'Others' as level, count(*) count from "+table_name+" where appedo_received_on between to_timestamp("+startTime+") AND to_timestamp("+endTime+")" ;
      queryParam = [];
    }
    psqlAPM.fnDbQuery('getLogStatusByPattern',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No record found for '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getNetworkStatusByProtocol', async (req, res) => {
  try {
    let userId = req.body.userId
    let table_name = req.body.log_table+userId;
    let startTime = Date.now()/1000-60*60;
    let endTime = Date.now()/1000;
    let queryText; let queryParam;
    queryText = "SELECT uid, MAX(appedo_received_on) as last_received_on, COUNT(CASE WHEN lower(status) = 'ok' THEN 1 ELSE NULL END) as ok,  COUNT(CASE WHEN lower(status) = 'error' THEN 1 ELSE NULL END) as error FROM "+table_name+" WHERE appedo_received_on BETWEEN to_timestamp("+startTime+") AND to_timestamp("+endTime+") GROUP BY uid";
    queryParam = [];
    let result = await psqlAPM.fnDbQuery('getNetworkStatusByProtocol',queryText, queryParam, req, res);
    if (result.success){
      res.json({success:true, rowCount:result.rowCount, result : result.rows});
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getProtocolByUserid', async (req, res) => {
  try {
    let userId = req.body.userId;
    let queryText = "SELECT lmt.log_grok, lmt.log_table_name from log_master_table lmt join (SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'network%"+userId+"') ist on concat(lmt.log_table_name,"+userId+") = ist.table_name";
    let queryParam = [];
    let result = await psqlAPM.fnDbQuery('getProtocolByUserid',queryText, queryParam, req, res)
    if (result.rowCount > 0 ){
      res.json({success:true, rowCount:result.rowCount, result : result.rows });
    } else {
      if(!result.error)
        res.json({success:false,invalidToken : false, message:'No Protocol available '+userId});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getNetworkPatternByUid', async (req, res) => {
  try {
    let userId = req.decoded.userId;
    let queryText = "SELECT lmt.log_grok, lmt.log_table_name from log_master_table lmt join (SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'network%"+userId+"') ist on concat(lmt.log_table_name,"+userId+") = ist.table_name";
    let queryParam = [];
    psqlAPM.fnDbQuery('getNetworkPatternByUid',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No GROK pattern found for '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAlertsCntByTable', async (req, res) => {
  try {
    let stDate = new Date((new Date().getTime()-1*60*60*1000)).toISOString();
    let edDate = new Date().toISOString();
    let tableName = req.body.tableName;
    let queryText = "SELECT '"+tableName+"' as table_name, COUNT(*) FROM "+tableName+" WHERE appedo_received_on BETWEEN '"+stDate+"' AND '"+edDate+"'";
    let queryParam = [];
    let result = await psqlAPM.fnDbQuery('getAlertsCntByTable',queryText, queryParam, null, null);
    if (result.rowCount > 0 ){
      res.json({success:true, rowCount:result.rowCount, result : result.rows });
    } else {
      if(!result.error)
        res.json({success:false,invalidToken : false, message:'No ALERTS GROK pattern found for '+req.body.uid});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLogAlertsByUid', async (req, res) => {
  try {
    let uidArr = req.body.uid.toString();
    let userId = req.body.ownerId == null ? req.decoded.userId : req.body.ownerId;
    let stDate = new Date().toISOString();
    let tableName = "so_log_threshold_breach_"+userId;
    let queryText = "SELECT * from crosstab($$SELECT LOWER(log_grok_name) log_grok_name, LOWER(breached_severity) as breached_serverity, count(*) FROM "+tableName+" WHERE uid IN ("+uidArr+") AND appedo_received_on BETWEEN ('"+stDate+"'::timestamp + INTERVAL '-1 hour') AND '"+stDate+"'::timestamp GROUP BY 1,2$$,$$VALUES ('critical'), ('warning')$$) as ct (log_grok_name VARCHAR, critical INT, warning INT)";
    let queryParam = [];
    let result = await psqlAPM.fnDbQuery('getLogAlertsByUid',queryText, queryParam, null, null);
    if (result.rowCount > 0 ){
      res.json({success:true, rowCount:result.rowCount, result : result.rows });
    } else {
      if(!result.error)
        res.json({success:false,invalidToken : false, message:'No alert breaches found for '+req.body.uid});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getGrokPatternByUid', async (req, res) => {
  try {
    let userId = req.body.ownerId == null ? req.decoded.userId : req.body.ownerId;
    let uid;
    let queryText;
    if (req.body.modCode=='log'){
      uid = req.body.uid;
      queryText = "SELECT "+uid+" as uid,lmt.log_grok, lmt.log_table_name from log_master_table lmt join (SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'log%"+uid+"') ist on concat(lmt.log_table_name,"+uid+") = ist.table_name";
    } else {
      uid = userId;
      queryText = "SELECT "+uid+" as uid,lmt.log_grok, lmt.log_table_name from log_master_table lmt join (SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'network%"+uid+"') ist on concat(lmt.log_table_name,"+uid+") = ist.table_name";
    }
    let queryParam = [];
    psqlAPM.fnDbQuery('getGrokPatternByUid',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No GROK pattern found for '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getProfilerResources', async (req, res) => {
  returnObj = [];
  var appConfig = JSON.parse(pgDbAuth.appedoConfigProperties.GLOWROOT_UI_RESOURCE);
  for (i=0; i < Object.keys(appConfig).length; i++) {
    let key = Object.keys(appConfig)[i];
    let value = appConfig[key];
    let url = pgDbAuth.appedoConfigProperties.GLOWROOT_UI_URL+value+'agent-id='+req.body.guid;
    let tempObj = {urlName: key, url: url};
    returnObj.push(tempObj);
  }
  res.json({success:true, error:true, message: 'success', result: returnObj});
})

router.post('/deleteModule', async (req, res) => {
  try {
    let queryText = "SELECT delete_module($1,$2,$3,$4)";
    let queryParam = [req.decoded.userId, req.body.uid, req.body.entId, req.body.moduleCode];
    psqlAPM.fnDbQuery('deleteModule',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : 'Selected module ('+req.body.uid+') deleted.' });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Deletion Failed for uid '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getSlaPoliciesByMetric', async (req, res) => {
  try {
    let source = req.body.source;
    let queryText;
    let queryParam;
    let errMsg;
    if (source == 'so_sla_counter') {
      let tableName = 'counter_master_'+req.body.uid;
      queryText = "SELECT s.sla_id, s.sla_name||' '||COALESCE(m.process_name,'')||'('||s.sla_id||')' as policy_name,s.sla_description, s.sla_name, m.counter_id, m.process_name, m.is_above_threshold, m.critical_threshold_value, m.warning_threshold_value, m.min_breach_count, cm.unit FROM so_sla_counter as m JOIN so_sla as s on m.sla_id=s.sla_id AND s.is_deleted = false JOIN "+tableName+" as cm ON cm.counter_id = m.counter_id WHERE m.counter_id=$1 AND uid=$2";
      queryParam = [req.body.metricId, req.body.uid];
      errMsg = ' and MetricId '+req.body.metricId;
    } else if (source == 'so_sla_sum') {
      queryText = "SELECT s.sla_id, s.sla_name||'('||s.sla_id||')' as policy_name, s.sla_name, s.sla_description, m.sum_test_id, true as is_above_threshold, m.error_limit as critical_threshold_value, m.warning_limit as warning_threshold_value, m.min_breach_count FROM so_sla_sum as m JOIN so_sla as s on m.sla_id=s.sla_id AND s.is_deleted = false WHERE m.sum_test_id=$1";
      queryParam = [req.body.metricId];
      errMsg = ' and MetricId '+req.body.metricId;
    } else if (source == 'so_sla_rum') {
      queryText = "SELECT s.sla_id, s.sla_name as policy_name, s.sla_name, s.sla_description, m.uid, m.is_above_threshold, m.critical_threshold_value, m.warning_threshold_value, m.min_breach_count FROM so_sla_sum as m JOIN so_sla as s on m.sla_id=s.sla_id AND s.is_deleted = false WHERE m.uid=$1";
      queryParam = [req.body.uid];
      errMsg ='';
    } else if (source == 'so_sla_log') {
      queryText = "SELECT s.sla_id, s.sla_name as policy_name, s.sla_name, s.sla_description, m.uid, m.breach_pattern, m.breached_severity,m.grok_column, m.log_grok_name, m.log_table_name, m.is_above_threshold, m.critical_threshold_value, m.warning_threshold_value, m.min_breach_count, m.is_contains FROM so_sla_log as m JOIN so_sla as s on m.sla_id=s.sla_id AND s.is_deleted = false WHERE m.uid=$1";
      queryParam = [req.body.uid];
      errMsg ='';
    } else {
      res.json({success:false,invalidToken : false, message:'Alert is not yet configured'});
    }
    psqlAPM.fnDbQuery('getSlaPoliciesByMetric',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Record Found for UID '+req.body.uid+' '+errMsg});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getProcessNameByMetric', async (req, res) => {
  try {
    let queryText;
    let queryParam;
    let endDate = new Date();
    let stDate = new Date();
    new Date(stDate.setDate(endDate.getDate()-1));
    let tableName = 'collector_'+req.body.uid;
    queryText = "SELECT process_name from "+tableName+" WHERE appedo_received_on between $3 AND $2 AND counter_type = $1 AND process_name <> '' group by process_name order by 1" ;
    queryParam = [req.body.metricId,endDate,stDate];
    psqlAPM.fnDbQuery('getProcessNameByMetric',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Record Found for UID '+req.body.uid+' and Metric Id '+req.body.metricId});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/insSLA', async (req, res) => {
  try {
    let pdata = req.body;
    let queryText;
    let queryParam;
    let d = Date.now();
    let updateModuleMaster = false;
    let user = req.decoded.userId; 
    //in so_sla table user_id type is bigint, created_by and modified by type is int due to this when we use the same parameter $5, getting inconsistent types deduced for parameter $5 hence added new parameter user for created by and modified by.
    let created_on =  dateFormat(d,"isoDateTime");
    queryText = "INSERT INTO so_sla (sla_name,sla_description,server_details,server_details_type,user_id,e_id,sla_type,created_by,created_on,modified_by,modified_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$9,$8,$9,$8) RETURNING sla_id";
    queryParam = [pdata.sla_name, pdata.sla_description, pdata.server_details, pdata.server_details_type, req.decoded.userId,pdata.e_id, pdata.sla_type,created_on,user];
    psqlAPM.fnDbQuery('insSLA',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        let uid = parseInt(pdata.uid);
        if (pdata.breach_pattern != null) pdata.breach_pattern="'"+pdata.breach_pattern+"'";
        if (pdata.grok_column != null) pdata.grok_column="'"+pdata.grok_column+"'";
        if (pdata.breached_severity != null) pdata.breached_severity="'"+pdata.breached_severity+"'";
        let tableName = 'counter_master_'+pdata.uid;
        if (pdata.table_name == 'so_sla_counter') {
          updateModuleMaster = true;
          queryText = "INSERT INTO so_sla_counter (sla_id,module_name,module_detail_name,uid,guid,counter_type_version_id,counter_id,category_name,breach_type_id,is_above_threshold,critical_threshold_value,min_breach_count,created_by,created_on,modified_by,modified_on,warning_threshold_value, process_name) SELECT "+result.rows[0].sla_id+" as sla_id, mm.module_code, mm.module_name, mm.uid, mm.guid, mm.counter_type_version_id, cm.counter_id,cm.category,3 as breach_type, "+pdata.is_above_threshold+" as is_above,"+pdata.critical_threshold_value+"as ctv,"+pdata.min_breach_cnt+" as mbc,"+user+" as cuser,'"+created_on+"' as con,"+user+" as muser,'"+created_on+"' as mon,"+pdata.warn_threshold_value+" as wtv,'"+pdata.process_name+"' as pname FROM module_master mm JOIN "+tableName+" as cm on cm.counter_id = $2 WHERE mm.uid= $1";
          queryParam = [uid, pdata.metric_id];
        } else if (pdata.log_table_name == "avm_test_master"){
          queryText = "INSERT INTO so_sla_log (sla_id,uid,guid,log_table_name,log_grok_name,breach_type_id,breach_pattern, breached_severity,grok_column, is_above_threshold,critical_threshold_value,warning_threshold_value, min_breach_count,created_by,created_on, is_contains) VALUES ("+result.rows[0].sla_id+","+ pdata.uid+", 'NA for AVM' ,'"+pdata.log_table_name+"','"+pdata.log_grok+"',3, "+pdata.breach_pattern+","+pdata.breached_severity+","+pdata.grok_column+","+pdata.is_above_threshold+" ,"+pdata.critical_threshold_value+","+pdata.warn_threshold_value+","+pdata.min_breach_cnt+","+user+",'"+created_on+"',"+pdata.is_contains+")";
          queryParam = [];
        } else if (pdata.table_name == 'so_sla_log' && pdata.log_table_name == 'log_avm_'){
          queryText = "INSERT INTO so_sla_log (sla_id,uid,guid,log_table_name,log_grok_name,breach_type_id,breach_pattern, breached_severity,grok_column, is_above_threshold,critical_threshold_value,warning_threshold_value, min_breach_count,created_by,created_on, is_contains) VALUES ("+result.rows[0].sla_id+", $1, 'NA for AVM','"+pdata.log_table_name+"','"+pdata.log_grok+"',3, "+pdata.breach_pattern+","+pdata.breached_severity+","+pdata.grok_column+","+pdata.is_above_threshold+","+pdata.critical_threshold_value+","+pdata.warn_threshold_value+","+pdata.min_breach_cnt+","+user+",'"+created_on+"',"+pdata.is_contains+")";
          queryParam = [uid];
        } else if (pdata.table_name == 'so_sla_log'){
          queryText = "INSERT INTO so_sla_log (sla_id,uid,guid,log_table_name,log_grok_name,breach_type_id,breach_pattern, breached_severity,grok_column, is_above_threshold,critical_threshold_value,warning_threshold_value, min_breach_count,created_by,created_on, is_contains) SELECT "+result.rows[0].sla_id+" as sla_id, mm.uid, mm.guid,'"+pdata.log_table_name+"','"+pdata.log_grok+"',3, "+pdata.breach_pattern+","+pdata.breached_severity+","+pdata.grok_column+","+pdata.is_above_threshold+" as is_above,"+pdata.critical_threshold_value+","+pdata.warn_threshold_value+","+pdata.min_breach_cnt+","+user+",'"+created_on+"',"+pdata.is_contains+" FROM module_master mm where uid = $1";
          queryParam = [uid];
        } else if (pdata.table_name == 'so_sla_sum'){
          res.json({success:false, invalidToken : false, message:'SUM yet to be implemented'});
          return;
        } else {
          res.json({success:false, invalidToken : false, message: pdata.module_type +' yet to be implemented'});
          return;
        }
        psqlAPM.fnDbQuery('insSLA-slachild',queryText, queryParam, req, res).then( result1 => {
          if (result1.rowCount >0) {
            if (updateModuleMaster) {
              queryText = 'UPDATE module_master SET user_status = $1 WHERE uid=$2';
              queryParam = ['restart',uid];
              psqlAPM.fnDbQuery('insSLA-updateModuleMaster',queryText, queryParam, req, res).then (res1 => {
                if (res1.rowCount >0) {
                  res.json({success:true, message:"New Policy Successfully Created", result : result1.rows});
                } else {
                  if(!res1.error)
                    res.json({success:false, invalidToken : false, message:'Insert SLA - Restart Agent failed, hence restart agent manually to apply SLA Policy'});
                  else 
                    res.json(res1);
                }
              });
            } else {
              res.json({success:true, message:"New Policy Successfully Created", result : result1.rows});
            }
          } else {
            if(!result1.error)
              res.json({success:false, invalidToken : false, message:'Insert SLA Child Not Successful.'});
            else 
              res.json(result1);
          }
        });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Insert Failed for policy '+pdata.sla_name});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updSLA', async (req, res) => {
  try {
    let pdata = req.body;
    let queryText;
    let queryParam;
    let updateModuleMaster = false;
    let d = Date.now();
    let user = req.decoded.userId;  
    let created_on =  dateFormat(d,"isoDateTime");
    queryText = "UPDATE so_sla SET sla_name = $1, sla_description = $2, e_id=$3,modified_by=$5, modified_on = $4 WHERE sla_id=$6";
    queryParam = [pdata.sla_name, pdata.sla_description,pdata.e_id,created_on,user, pdata.sla_id];
    psqlAPM.fnDbQuery('updSLA',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        if (pdata.table_name == 'so_sla_counter') {
          queryText = "UPDATE so_sla_counter SET is_above_threshold = $1, critical_threshold_value = $2, min_breach_count=$3, warning_threshold_value=$4, process_name = $5, modified_by =$6, modified_on = $7 WHERE sla_id = $8 AND counter_id = $9";
          queryParam = [pdata.is_above_threshold,pdata.critical_threshold_value, pdata.min_breach_cnt, pdata.warn_threshold_value, pdata.process_name, user, created_on, pdata.sla_id, pdata.metric_id];
          updateModuleMaster = true;
        } else if (pdata.table_name == 'so_sla_log') {
          queryText = "UPDATE so_sla_log SET log_table_name = $1,log_grok_name=$2,breach_pattern = $3, breached_severity=$4,grok_column=$5, is_above_threshold = $6,critical_threshold_value = $7,warning_threshold_value=$8, min_breach_count=$9,is_contains = $11 WHERE sla_id = $10" ;
          queryParam = [pdata.log_table_name, pdata.log_grok, pdata.breach_pattern, pdata.breached_severity, pdata.grok_column, pdata.is_above_threshold, pdata.critical_threshold_value,pdata.warn_threshold_value, pdata.min_breach_cnt, pdata.sla_id, pdata.is_contains];
        } else if (pdata.table_name == 'so_sla_sum'){
          res.json({success:false, invalidToken : false, message:'SUM yet to be implemented'});
          return;
        } else {
          res.json({success:false, invalidToken : false, message: pdata.module_type +' yet to be implemented'});
          return;
        }
        psqlAPM.fnDbQuery('updSLA-slachild',queryText, queryParam, req, res).then( result1 => {
          if (result1.rowCount >0) {
            if (updateModuleMaster) {
              queryText = 'UPDATE module_master SET user_status = $1 WHERE uid=$2';
              queryParam = ['restart',pdata.uid];
              psqlAPM.fnDbQuery('updSLA-updateModuleMaster',queryText, queryParam, req, res).then (res1 => {
                if (res1.rowCount >0) {
                  res.json({success:true, message:"Policy updated Successfully", result : result1.rows});
                } else {
                  if(!res1.error)
                    res.json({success:false, invalidToken : false, message:'Update SLA - Restart Agent failed, hence restart agent manually to apply SLA Policy'});
                  else 
                    res.json(res1);
                }
              });
            } else {
              res.json({success:true, message:"Policy updated Successfully", result : result1.rows});
            }
          } else {
            if(!result1.error)
              res.json({success:false, invalidToken : false, message:'Update SLA Child Not Successful.'});
            else 
              res.json(result1);
          }
        });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Update Failed for policy '+pdata.sla_name});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLogAlerts', async (req, res) => {
  let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
  let tableName = 'so_log_threshold_breach_'+userId;
  let qryText = "SELECT mm.system_id, LOWER(tb.breached_severity) AS breached_severity, count(*) FROM "+tableName+" AS tb JOIN module_master AS mm ON mm.uid=tb.uid WHERE tb.appedo_received_on BETWEEN now()- interval '5 minutes' AND now() GROUP BY 1,2";
  let result = await psqlAPM.fnDbQuery('getLogAlerts',qryText,[],null,null);
  if (result.rowCount>0){
    res.json({success:true, rowCount:result.rowCount, result : result.rows});
  } else {
    if(!result.error)
      res.json({success:false,rowCount:0, message:'No records found'});
    else 
      res.json(result);
  }
});

router.post('/getAPMAlerts', async (req, res) => {
  let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
  let tableName = 'so_threshold_breach_'+userId
  let qryText = "SELECT mm.system_id, LOWER(tb.breached_severity) AS breached_severity, count(*), MAX(received_on) as last_received_on FROM "+tableName+" AS tb JOIN module_master AS mm ON mm.uid=tb.uid WHERE tb.received_on BETWEEN now()- interval '1 hour' AND now() GROUP BY 1,2";
  let result = await psqlAPM.fnDbQuery('getAPMAlerts',qryText,[],null,null);
  if (result.rowCount>0){
    res.json({success:true, rowCount:result.rowCount, result : result.rows});
  } else {
    if(!result.error)
      res.json({success:false,rowCount:0, message:'No records found'});
    else 
      res.json(result);
  }
});

router.post('/getAPMAlertsForModule', async (req, res) => {
  let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId; 
  let tableName = 'so_threshold_breach_'+userId;
  let dateTime = new Date().toISOString();
  let qryText = "SELECT * FROM crosstab($$SELECT tb.uid, LOWER(tb.breached_severity) AS breached_severity, count(*) FROM "+tableName+" AS tb WHERE tb.received_on BETWEEN '"+dateTime+"'::timestamp with time zone - interval '1 hour' AND '"+dateTime+"'::timestamp with time zone AND tb.uid = "+req.body.uid+" GROUP BY 1,2$$, $$VALUES('critical'),('warning')$$) as ct (uid int, critical int, warning int)";
  let result = await psqlAPM.fnDbQuery('getAPMAlertsForModule',qryText,[],null,null);
  if (result.rowCount > 0) {
    res.json({success:true, rowCount:result.rowCount, result : result.rows});
  } else {
    if(!result.error)
      res.json({success:false,rowCount:0, message:'No records found'});
    else 
      res.json(result);
  }
});

// router.post('/getAPMAlertsForModule', async (req, res) => {
//   let tableName = 'so_threshold_breach_'+req.decoded.userId;
//   let dateTime = new Date().toISOString();
//   let qryText = "SELECT * FROM crosstab($$SELECT mm.uid, LOWER(tb.breached_severity) AS breached_severity, count(*) FROM "+tableName+" AS tb JOIN module_master AS mm ON mm.uid = tb.uid WHERE tb.received_on BETWEEN '"+dateTime+"' - interval '1 hour' AND '"+dateTime+"' AND mm.system_id ="+req.body.systemId+" AND LOWER(module_code) = '"+req.body.modCode+"' GROUP BY 1,2$$, $$VALUES('critical'),('warning')$$) as ct (uid int, critical int, warning int)";
//   let result = await psqlAPM.fnDbQuery('getAPMAlertsForModule',qryText,[],null,null);
//   if (result.rowCount > 0) {
//     res.json({success:true, rowCount:result.rowCount, result : result.rows});
//   } else {
//     if(!result.error)
//       res.json({success:false,rowCount:0, message:'No records found'});
//     else 
//       res.json(result);
//   }
// });

// router.post('/getRumAlertsForUser', async (req, res) => {
//   let userId = req.body.entId == 0 ? req.decoded.userId : req.body.entUserId;
//   let tableName = 'so_rum_threshold_breach_'+userId
//   let qryText = "SELECT * FROM crosstab($$SELECT mm.uid, LOWER(tb.breached_severity) AS breached_severity, count(*) FROM "+tableName+" AS tb JOIN module_master AS mm ON mm.uid = tb.uid WHERE tb.received_on BETWEEN now()- interval '1 hour' AND now() AND tb.user_id ="+userId+" AND LOWER(module_code) = '"+req.body.modCode+"' GROUP BY 1,2$$, $$VALUES('critical'),('warning')$$) as ct (uid int, critical int, warning int)";
//   let result = await psqlAPM.fnDbQuery('getAPMAlertsForModule',qryText,[],null,null);
//   if (result.rowCount > 0) {
//     res.json({success:true, rowCount:result.rowCount, result : result.rows});
//   } else {
//     if(!result.error)
//       res.json({success:false,rowCount:0, message:'No records found'});
//     else 
//       res.json(result);
//   }
// });
router.post('/getRumAlertsForUser', async (req, res) => {
  let userId = req.body.entId == 0 ? req.decoded.userId : req.body.entUserId;
  let tableName = 'so_rum_threshold_breach_'+userId;
  let dateTime = new Date().toISOString();
  let qryText = "SELECT * FROM crosstab($$SELECT mm.uid, LOWER(tb.breached_severity) AS breached_severity, count(*) FROM "+tableName+" AS tb JOIN module_master AS mm ON mm.uid = tb.uid WHERE tb.uid="+req.body.uid+" AND tb.received_on BETWEEN '"+dateTime+"'::timestamp with time zone - interval '1 hour' AND '"+dateTime+"'::timestamp with time zone GROUP BY 1,2$$, $$VALUES('critical'),('warning')$$) as ct (uid int, critical int, warning int)";
  let result = await psqlAPM.fnDbQuery('getRumAlertsForUser',qryText,[],null,null);
  if (result.rowCount > 0) {
    res.json({success:true, rowCount:result.rowCount, result : result.rows});
  } else {
    if(!result.error)
      res.json({success:false,rowCount:0, message:'No records found'});
    else 
      res.json(result);
  }
});
