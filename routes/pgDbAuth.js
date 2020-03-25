const Router = require('express-promise-router')
const jwt = require('jsonwebtoken');
const { Pool } = require('pg')
const PgConfig = require('../config/apd_constants');
let pool = new Pool (PgConfig.pgDbConfig);
const dateFormat = require('dateformat');
const pgCustom = require('./psqlCustom');
const psqlAPM = require('./psqlAPM');
const mssqlCustom = require('./mssqlCustom');
const chsqlCustom = require('./chsqlCustom');
const multer = require('multer');
const upload = multer();

global.logger = require('../log');
 
// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router()
let appedoConfigProperties = {}, agentVersion = {}, agentDownloadPath = {}; appedoWhiteLabels = {};
// export our router to be mounted by the parent application
module.exports = router;
module.exports.appedoConfigProperties = appedoConfigProperties;
module.exports.agentVersion = agentVersion;
module.exports.agentDownloadPath = agentDownloadPath;
module.exports.appedoWhiteLabels = appedoWhiteLabels;
module.exports.loadAllConfig = loadAllConfig;

function loadAllConfig() {
  getAppedoConfigProp();
  getAllAgentVersions();
  getAgentDownloadPath();
  getAppedoWhiteLabels();
};

function getRequestIP (req) {
  var ip;
  if (req.connection && req.connection.remoteAddress) {
      ip = req.connection.remoteAddress;
  } else if (req.headers['x-forwarded-for']) {
    ip = req.headers['x-forwarded-for'].split(",")[0];
  } else {
      ip = req.ip;
  }
  return ip;
}

//Load Appedo Config Properties
function getAppedoConfigProp() {
  try{
    if (Object.keys(appedoConfigProperties).length == 0) {
      const queryText = 'SELECT property, value FROM appedo_config_properties';
      const queryParam = [];
      psqlAPM.fnDbQuery('getAppedoConfigProp',queryText, queryParam, null, null).then( result => {
        if ( result.rowCount > 0 ){
          result.rows.map(item => appedoConfigProperties[item.property] = item.value);
        } else {
          if (result.error){
            logger.error("Failed. getAppedoConfigProp() will be retried after 10 sec");
            setTimeout(() => {
              getAppedoConfigProp();
            }, 10000);
          }
        }
      });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    logger.error("Failed. getAppedoConfigProp() will be retried after 10 sec")
    setTimeout(() => {
      getAppedoConfigProp();
    }, 10000);
  }
}
//Load all Appedo white labels
function getAppedoWhiteLabels() {
  try{
    if (Object.keys(appedoWhiteLabels).length == 0) {
      const queryText = 'SELECT key, value FROM appedo_whitelabel';
      const queryParam = [];
      psqlAPM.fnDbQuery('getAppedoWhiteLabels',queryText, queryParam, '{}', '{}').then( result => {
        if ( result.rowCount > 0 ){
          result.rows.map(item => appedoWhiteLabels[item.key] = item.value);
        }  else {
          if(result.error){
            logger.error("Failed. getAppedoWhiteLabels() will be retried after 10 sec. ")
            setTimeout(() => {
              getAppedoWhiteLabels()
            }, 10000);
          }
        }
      });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    logger.error("Failed. getAppedoWhiteLabels() will be retried after 10 sec. ")
    setTimeout(() => {
      getAppedoWhiteLabels()
    }, 10000);
  }
}

//Load All Agent Versions
function getAllAgentVersions() {
  try{
    if (Object.keys(agentVersion).length == 0) {
      const queryText = 'SELECT bum.module_name, bum.version_number FROM build_upgrade_master bum INNER JOIN (  SELECT module_name, max(upgraded_on) AS last_upgraded_on  FROM build_upgrade_master  GROUP BY module_name ) AS l_bum ON l_bum.module_name = bum.module_name AND l_bum.last_upgraded_on = bum.upgraded_on ORDER BY bum.module_name';
      const queryParam = [];
      psqlAPM.fnDbQuery('getAllAgentVersions',queryText, queryParam, null, null).then( result => {
        if (result.rowCount > 0 ){
          result.rows.map(item => agentVersion[item.module_name] = item.version_number);
        }  else {
          if (result.error){
            logger.error("getAllAgentVersions() will be retried after 10 sec");
            setTimeout(() => {
              getAllAgentVersions();
            }, 10000);
          }
        }
      });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    logger.error("getAllAgentVersions() will be retried after 10 sec");
    setTimeout(() => {
      getAllAgentVersions();
    }, 10000);
  }
}

//Load All Agent Download Paths
function getAgentDownloadPath() {
  try{
    if (Object.keys(agentDownloadPath).length == 0) {
      const queryText = 'select counter_type_name, module_name, monitor_build_module_name, monitor_agent_full_path, monitor_guid_files, profiler_build_module_name, profiler_guid_files, profiler_agent_full_path from counter_type';
      const queryParam = [];
      psqlAPM.fnDbQuery('getAgentDownloadPath',queryText, queryParam, '{}', '{}').then( result => {
        if (result.rowCount > 0 ){
          result.rows.map(item => agentDownloadPath[item.counter_type_name] = item);
        }  else {
          if(result.error){
            logger.error("Failed.getAgentDownloadPath() will be retried after 10 sec.")
            setTimeout(() => {
              getAgentDownloadPath();
            }, 10000);
          }
        }
      });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    logger.error("Failed.getAgentDownloadPath() will be retried after 10 sec.")
    setTimeout(() => {
      getAgentDownloadPath();
    }, 10000);
  }
}

//Load Appedo Config Properties from DB
// router.get('/getAppedoConfigProp', async(req,res)=>{
//   try{
//     if (Object.keys(appedoConfigProperties).length == 0) {
//       const queryText = 'SELECT property, value FROM appedo_config_properties';
//       const queryParam = [];
//       psqlAPM.fnDbQuery('getAppedoConfigProp',queryText, queryParam, req, res).then( result => {
//         if ( result.rowCount > 0 ){
//           result.rows.map(item => appedoConfigProperties[item.property] = item.value);
//           res.json({success:true, message:"Success", result : appedoConfigProperties });
//         }  else {
//           if(!result.error)
//             res.json({success:false, invalidToken : false, message:'Appedo configuration not found.'});
//           else 
//             res.json(result);
//         }
//       });
//     } else {
//       res.send({success:true, message:"Success", result : appedoConfigProperties })
//     }
//   } catch (e) {
//     logger.error(process.pid,e.stack);
//     res.json({success:false, error:true, message: e.stack});
//   }
// });

//Load all agent version from DB
// router.get('/getAllAgentVersions', async(req,res)=>{
//   try{
//     if (Object.keys(agentVersion).length == 0) {
//       const queryText = 'SELECT bum.module_name, bum.version_number FROM build_upgrade_master bum INNER JOIN (  SELECT module_name, max(upgraded_on) AS last_upgraded_on  FROM build_upgrade_master  GROUP BY module_name ) AS l_bum ON l_bum.module_name = bum.module_name AND l_bum.last_upgraded_on = bum.upgraded_on ORDER BY bum.module_name';
//       const queryParam = [];
//       psqlAPM.fnDbQuery('getAllAgentVersions',queryText, queryParam, req, res).then( result => {
//         if (result.rowCount > 0 ){
//           result.rows.map(item => agentVersion[item.module_name] = item.version_number);
//           res.json({success:true, message:"Success", result : agentVersion });
//         }  else {
//           if(!result.error)
//             res.json({success:false, invalidToken : false, message:'counter type version not found.'});
//           else 
//             res.json(result);
//         }
//       });
//     } else {
//       res.send({success:true, message:"Success", result : agentVersion })
//     }
//   } catch (e) {
//     logger.error(process.pid,e.stack);
//     res.json({success:false, error:true, message: e.stack});
//   }
// });

//Load all agent download path from DB
// router.get('/getAllAgentDownloadPath', async(req,res)=>{
//   try{
//     if (Object.keys(agentDownloadPath).length == 0) {
//       const queryText = 'select counter_type_name, module_name, monitor_build_module_name, monitor_agent_full_path, monitor_guid_files, profiler_build_module_name, profiler_guid_files, profiler_agent_full_path from counter_type';
//       const queryParam = [];
//       psqlAPM.fnDbQuery('agentDownloadPath',queryText, queryParam, req, res).then( result => {
//         if (result.rowCount > 0 ){
//           result.rows.map(item => agentDownloadPath[item.counter_type_name] = item);
//           res.json({success:true, message:"Success", result : agentDownloadPath });
//         }  else {
//           if(!result.error)
//             res.json({success:false, invalidToken : false, message:'counter type version not found.'});
//           else 
//             res.json(result);
//         }
//       });
//     } else {
//       res.send({success:true, message:"Success", result : agentDownloadPath })
//     }
//   } catch (e) {
//     logger.error(process.pid,e.stack);
//     res.json({success:false, error:true, message: e.stack});
//   }
// });

router.post('/validateEmailSignUp', async (req, res) =>{
  try{
    const queryText = "SELECT email_id from usermaster where email_id = $1";
    const queryParam = [req.body.email];
    psqlAPM.fnDbQuery('validateEmailSignUp',queryText, queryParam, req, res).then(result => {
      if (result.rowCount == 0){
        res.json({success:true,  invalidToken : false, message:'Success'});
      } else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:"Email already exist"});
        else 
          res.json(result);
      }
      
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/register', async (req, res) =>{
  try{
    start = Date.now();
    let currentDate = dateFormat(start,"isoDateTime");
    let user; 
    //await makes the subsequent line to wait for the completion of function
    await PgConfig.decrypt(req.body.data).then(res =>{
      user = JSON.parse(res);
    });
    if (!user.email){
      res.json({success: false, invalidToken : false, message:"Email not provided"});
    } else {
      if (!user.password){
        res.json({success: false, invalidToken : false, message: "Password not provided"});
      }
      else {
        let queryText = "INSERT INTO usermaster (email_id, password, first_name, last_name, license_level, created_by, created_on, mobile_no) VALUES ($1, pgp_sym_encrypt($2, $3), $4, $5, $6, 0, $7,$8) returning user_id";
        let queryParam = [user.email, user.password, PgConfig.dbPwdPvtKey, user.first_name, user.last_name, user.license_level, currentDate,user.mobile];
        psqlAPM.fnDbQuery('register',queryText, queryParam, req, res).then(result => {
          if (result.rowCount > 0) {
            PgConfig.encrypt(result.rows[0].user_id+'').then(resEncryptedUserId => {
              queryText = "UPDATE usermaster set encrypted_user_id = $1 where user_id = $2";
              queryParam =[resEncryptedUserId, result.rows[0].user_id];
              psqlAPM.fnDbQuery('update-encryptUserId',queryText, queryParam, req, res).then(resEncryptUpd => {
              });  
            });
            queryText = "SELECT * FROM create_user_related_schema("+result.rows[0].user_id+" , '"+user.email+"')";
            queryParam =[];

            psqlAPM.fnDbQuery('register-childtables',queryText, queryParam, req, res).then(result1 => {
              //No code done as it is treated as backend work
            });
            
            var formData = {email_id: user.email, user_id: result.rows[0].user_id, first_name: user.first_name, last_name: user.last_name, operation: user.operation, mobile_no: user.mobile, telephone_code : user.telephone_code};
            if (user.operation == 'EnterpriseInviteMail') {
              formData.enterprise_name = user.enterprise_name;
              formData.entOwner_emailId = user.entOwner_emailId;
              formData.isNewUser = user.isNewUser;
              formData.password = user.password;
            }
              
            insertVerificationHist(result.rows[0].user_id, 'EMAIL_ID_VERIFICATION', function (resVer) {
              if (resVer.success) {
                let encryptData = {
                  user_id: result.rows[0].user_id,
                  vh_id: resVer.vh_id,
                  email_id: user.email
                };
                PgConfig.encrypt(JSON.stringify(encryptData)).then(res1 =>{
                  let queryData = res1;
                  formData.link = appedoConfigProperties.APPEDO_URL_2018+'verifySignUp/'+queryData;
                  formData.vh_id = resVer.vh_id;

                  var url = appedoConfigProperties.MODULE_UI_SERVICES + '/common/sendVerifyMail';
                  request.post(url,{form: formData}, function (httpError, httpResp, body) {
                    if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && isJSON(body) && !JSON.parse(body).success)) {
                      logger.error('Sending mail failed.' + httpError);
                      res.json({ success: false, invalidToken: false, message: "Successfully registered, Verification mail failed to send. Contact system admin, if user facing any issue in login."});
                    } else {
                      res.json({ success: true, invalidToken: false, message: "Successfully registered, Email sent for verification. Note: Check spam or junk if haven't received any mail.", result:result.rows});
                    }
                  });
                });
              } else {
                res.json({success: false, message:"Successfully registered, Verification mail failed to send. Contact system admin, if user facing any issue in login."});
              }
            });
          } else {
            if(!result.error)
              res.json({ success: false, invalidToken: false, message: "Registeration not successful." });
            else 
              res.json(result.message);
          }
        });
      }
    }   
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/login', async (req, res) =>{
  try{
    start = Date.now();
    let user; 
    //await makes the subsequent line to wait for the completion of function
    await PgConfig.decrypt(req.body.data).then(res =>{
      user = JSON.parse(res);
    });
    if (!user.email){
      res.json({success: false, invalidToken : false, message:"Email not provided"});
    }else {
      if (!user.password){
      res.json({success: false, invalidToken : false, message: "Password not provided"});
      }
      else {
        const queryText = 'select user_id, pgp_sym_decrypt(password, $2) AS password, encrypted_user_id, email_id, first_name, last_name from usermaster where email_id = $1 AND email_verified_on IS NOT NULL';
        const queryParam = [user.email,PgConfig.dbPwdPvtKey];
        psqlAPM.fnDbQuery('login',queryText, queryParam, req, res).then(result => {
          if (result.rowCount > 0) {
            if (user.password === result.rows[0].password) {
              const token = jwt.sign({ userId: result.rows[0].user_id}, PgConfig.privateKey, { expiresIn: PgConfig.tokenExpiresIn });
              jwt.verify(token, PgConfig.privateKey, (err,decoded) => {
                  PgConfig.collRefreshToken[token] ={expiryTime:Math.floor(new Date().getTime()/1000) + PgConfig.tokenExpInSec, decoded : decoded};
              });
              addLoginHistory(result.rows[0].user_id, getRequestIP(req), "Successful Login", function (resp) {
                res.json({ success: true, invalidToken: false, message: "Success", token: token, user: { encryptedUserId: result.rows[0].encrypted_user_id, name: result.rows[0].first_name + ' ' + result.rows[0].last_name, email: user.email.toLowerCase(), license: "to be done", unq_id:result.rows[0].user_id, id: resp.id} });
              });
            } else {
              addLoginHistory(result.rows[0].user_id, getRequestIP(req), "Invalid password.", function (resp) {
                  res.json({ success: false, invalidToken: false, message: "Invalid password" });
              });

            }
          }
          else {
            if(!result.error)
              addLoginHistory(-1, getRequestIP(req), "Email-Id not found - "+user.email, function (resp) {
                  res.json({ success: false, invalidToken: false, message: "User not found or EMAIL not verified." });
              });
            else 
                res.json(result);
          }
        });
      }
    }   
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

function addLoginHistory (userId, ipAddress, message, callbackFn) {
	let query = "INSERT INTO login_history(user_id, ip_details, login_on, login_comment) VALUES ($1, $2, now(), $3) RETURNING id";
	let qryParam = [userId, ipAddress, message];
	try {
		psqlAPM.fnDbQuery('loginHistory',query, qryParam, null, null).then(result => {
      if (result.rowCount > 0) {
        callbackFn({success:true, id: result.rows[0].id});
      } else {
        callbackFn({success:false, id: -1});
		  }
    });
	} catch (e) {
		logger.error(process.pid,e.stack);
		callbackFn();
	}	
}

function getUserDetails (emailId, callbackFn) {
	let query = "SELECT user_id, email_id, first_name, last_name, mobile_no, telephone_code FROM usermaster WHERE lower(email_id) = lower($1) ";
	let qryParam = [emailId];
	try {
		psqlAPM.fnDbQuery('getUserDetails', query, qryParam, null, null).then(result => {
          if (result.rowCount > 0) {
            callbackFn({success: true, message: "email Id found.", data: result.rows[0]});
          } else {
			      callbackFn({success: false, message: "email Id not found."});
		    }
    });
	} catch (e) {
		logger.error(process.pid,e.stack);
		callbackFn({success: false, message: e.stack});
	}	
}

function insertVerificationHist (userId, message, callbackFn) {
	let query = "INSERT INTO login_verification_history (user_id, activity, created_on) VALUES ($1, $2, now()) RETURNING id";
	let qryParam = [userId, message];
	try {
		psqlAPM.fnDbQuery('insertVerificationHist:'+message,query, qryParam, null, null).then(result => {
          if (result.rowCount > 0) {
            callbackFn({success: true, message: "verification id inserted.", vh_id: result.rows[0].id});
          } else {
			      callbackFn({success: false, message: "failed to insert verification id."});
		    }
    });
	} catch (e) {
		logger.error(process.pid,e.stack);
		callbackFn({success: false, message: e.stack});
	}	
}

router.post('/verifySlaEmail', async (req, res) => {
  let reqParam = req.body;
  let queryText, queryParam;
  try {
    PgConfig.decrypt(reqParam.data).then(decryptedRes =>{
      let passReqData = JSON.parse(decryptedRes);
      queryText = "UPDATE so_alert SET validated_on = now(), is_valid = true WHERE sla_setting_id = $1";
      queryParam = [passReqData.sla_setting_id];
      
      psqlAPM.fnDbQuery('alert Emailverify:update-verifiedOn',queryText, queryParam, req, res).then(resVerUpd => {
        if (resVerUpd.rowCount > 0) {
          res.json({success: true, invalidToken: false, message:"Your Email Id verified successfully"});
        } else {
          if (resVerUpd.error) {
            res.json(resVerUpd);  
          } else {
            res.json({success: false, invalidToken: false, message: "Email verification failed, contact System Administrator."});
          }
        }
      });
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/verifySignUp', async (req, res) => {
  let reqParam = req.body;
  let queryText, queryParam;
  try {
    PgConfig.decrypt(reqParam.data).then(decryptedRes =>{
      let passReqData = JSON.parse(decryptedRes);
      queryText = "UPDATE login_verification_history SET first_opened_on = now(),  first_opened_comment = $1 WHERE id = $2 AND user_id = $3";
      queryParam = ["Email verified with valid link.", passReqData.vh_id, passReqData.user_id];
      psqlAPM.fnDbQuery('verifySignUp:update-link-comment',queryText, queryParam, req, res).then(resComm => {
              //Query execution result not required, hence sending the back response straight away.
          queryText = "UPDATE usermaster SET email_verified_on=now() where user_id= $1";
          queryParam = [passReqData.user_id];
          psqlAPM.fnDbQuery('verifySignUp:update-verifiedOn',queryText, queryParam, req, res).then(resVerUpd => {
            if (resVerUpd.rowCount > 0) {
              res.json({success: true, invalidToken: false, message:"Your Email Id verified successfully, please login."});
            } else {
              if (resVerUpd.error) {
                res.json(resVerUpd);  
              } else {
                res.json({success: false, invalidToken: false, message: "Email verification failed, contact System Administrator."});
              }
            }
          });
        });
      });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/changeForgottenPassword', async (req, res) => {
  let reqParam = req.body;
  try {
    PgConfig.decrypt(reqParam.data).then(decryptedRes =>{
      let passReqData = JSON.parse(decryptedRes);
      let queryText = "SELECT false as ret FROM login_verification_history where id=$1 AND user_id =$2 AND created_on < now() - INTERVAL'"+appedoConfigProperties.VERIFICATION_LINK_EXPIRE_WITHIN_HOURS+" hours'";
      let queryParam = [passReqData.user_id, passReqData.vh_id];
      psqlAPM.fnDbQuery('changeForgottenPassword:link-verification',queryText, queryParam, req, res).then(result => {
        if (result.rowCount > 0) {
          queryText = "UPDATE login_verification_history SET first_opened_on = now(),  first_opened_comment = $1 WHERE id = $2 AND user_id = $3";
          queryParam = ["Link expired.", passReqData.vh_id, passReqData.user_id];
          psqlAPM.fnDbQuery('changeForgottenPassword:update-link-comment',queryText, queryParam, req, res).then(resComm => {
            //Query execution result not required, hence sending the back response straight away.
            res.json({success: false, invalidToken: false, message: "Forgot password link expired, kindly redo forgot password."});  
          });
        } else {
          if (result.error) {
            res.json(result);
          } else {
            queryText = "UPDATE login_verification_history SET first_opened_on = now(),  first_opened_comment = $1 WHERE id = $2 AND user_id = $3";
            queryParam = ["Password reset with valid link.", passReqData.vh_id, passReqData.user_id];
            psqlAPM.fnDbQuery('changeForgottenPassword:update-link-comment',queryText, queryParam, req, res).then(resComm => {
              //Query execution result not required, hence sending the back response straight away.
              queryText = "UPDATE usermaster SET password = pgp_sym_encrypt($1, $2) WHERE user_id = $3";
              queryParam = [reqParam.newPassword, PgConfig.dbPwdPvtKey, passReqData.user_id];
              psqlAPM.fnDbQuery('changeForgottenPassword:update-password',queryText, queryParam, req, res).then(resChPwd => {
                if (resChPwd.rowCount > 0) {
                  res.json({success: true, invalidToken: false, message:"Password changed successfully, please login."});
                } else {
                  if (resChPwd.error) {
                    res.json(resChPwd);  
                  } else {
                    res.json({success: false, invalidToken: false, message: "Password change failed."});
                  }
                }
              });
            });
          }       
        }
      });
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/forgotPassword', async (req, res) => {
  let mailParam = {};
  try {
    getUserDetails(req.body.emailId, function(result)  {
      if (result.success) {
        if (req.body.emailId != result.data.email_id) {
          res.json({success: false, message:"Email Id not mathcing the result."});
        }
        insertVerificationHist(result.data.user_id, 'FORGOT_PASSWORD', function (resVer) {
          if (resVer.success) {
            let encryptData = {
              user_id: result.data.user_id,
              vh_id: resVer.vh_id,
              email_id: result.data.email_id
            };
            PgConfig.encrypt(JSON.stringify(encryptData)).then(res1 =>{
              let queryData = res1;
              mailParam = {
                firstName: result.data.first_name,
                emailId: result.data.email_id,
                link: appedoConfigProperties.APPEDO_URL_2018+'resetPassword/'+queryData,
                subject: 'Password recovery'
              };
              var url = appedoConfigProperties.MODULE_UI_SERVICES + '/common/forgotPassword';
              request.post(url,{form: mailParam}, function (httpError, httpResp, body) {
                if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && isJSON(body) && !JSON.parse(body).success)) {
                  logger.error('Sending mail failed.' + httpError);
                  res.json({ success: false, invalidToken: false, message: "Forgot password mail failed to send, Contact administrator."});
                } else {
                  res.json({ success: true, invalidToken: false, message: "Mail sent successfully, check inbox or spam."});
                }
              });

            });
          } else {
            res.json({success: false, message:"Mail could not be sent for Forgot password."});
          }
        });
      } else {
        res.json(result);
      }
    })
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

router.post('/uploadJmeterScripts', upload.any(), async (req, res, next) => {
  try {
    //var url = 'http://localhost:8080/Appedo-UI-Module-Services/lt/uploadJmeterScript';
    var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/uploadJmeterScript';
    req.body.userId = req.decoded.userId;
    req.body.licenseLevel = "level3";
    var files = req.files;
    for(var i = 0; i < files.length; i++){
      req.body['file_name_'+i] = files[i].originalname;
      req.body['file_content_'+i] = files[i].buffer.toString('utf8');
    }

    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from uploadJmeterScripts Java service...");
        res.json({success:false, error: true, invalidToken : false, message: response.errorMessage});
      }else{
        res.json(response);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post ('/getDataFromToken', async (req, res) => {
  let tokenData = req.body.token;
  jwt.verify(tokenData, PgConfig.embeddedKey, (err,decoded) => {
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
      res.json({success:true, invalidToken : false, message:decoded});
    }
  })
});

function logout(req){
  try {
    const queryText = "UPDATE login_history SET logout_on=NOW(), logout_comment=$1 WHERE id= $2";
    const queryParam = ["Successful Logout", req.body.id];
    psqlAPM.fnDbQuery('logoutUser',queryText, queryParam, null, null).then(result => {
      if (result.rowCount > 0){
        logger.info(req.body.id +"successfully logged out");
      } else {
        if (!result.error)
          logger.error(req.body.id + " could not write logout history");
        else 
          logger.error(req.body.id + " could not write logout history "+json.stringify(result));
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
  }
}

router.post('/logoutUser', async (req, res) => {
  logout(req);
  res.json({success:true, invalidToken : false, message:'Successfully logged out'})
});

router.post('/mapUsrToEnt', async (req, res) => {
  try{
    let createdOn = new Date();
    const queryText = "INSERT INTO user_enterprise_mapping(e_id, user_id, email_id, created_on, status) VALUES ($1,$2,$3,$4,$5)";
    const queryParam = [req.body.e_id,req.body.map_user_id, req.body.email_id,createdOn,req.body.status];
    psqlAPM.fnDbQuery('mapUsrToEnt',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          var formData = {email_id: req.body.email_id, user_id: req.body.map_user_id, first_name: req.body.first_name, last_name: req.body.last_name, operation: req.body.operation, mobile_no: req.body.mobile, telephone_code : req.body.telephone_code, enterprise_name: req.body.enterprise_name, entOwner_emailId: req.body.entOwner_emailId, isNewUser: false};
          formData.link=appedoConfigProperties.APPEDO_URL_2018;
          var url = appedoConfigProperties.MODULE_UI_SERVICES + '/common/sendVerifyMail';
          request.post(url,{form: formData}, function (httpError, httpResp, body) {
            if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !body.success)) {
              logger.error('Sending mail failed.' + httpError);
              res.json({ success: true, invalidToken: false, message: "User Mapped successfully.",result:result.rows });
            } else {
              res.json({ success: true, invalidToken: false, message: "User Mapped successfully, Enterprise invite mail sent successfully.", result:result.rows });
            }
          });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Map user failed Failed'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getRegionDetails', async (req, res) =>{
  try {
    var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/readRegions';
    req.body.userId = req.decoded.userId;
    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from readRegions Java service...");
        res.json({success:false, error: true, invalidToken : false, message: response.errorMessage});
      } else {
        res.json(response);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getScriptwiseData', async (req, res) =>{
  try {
    var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/getScriptwiseData';
    req.body.userId = req.decoded.userId;
    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from readRegions Java service...");
        res.json({success:false, error: true, invalidToken : false, message: response.errorMessage});
      } else {
        res.json(response);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/stopJMeterTest', async (req, res) =>{
  try {
    var url = appedoConfigProperties.LT_EXECUTION_SERVICES + '/ltScheduler/stopJMeterTest';
    req.body.userId = req.decoded.userId;
    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from readRegions Java service...");
        res.json({success: false, error: true, message: response.errorMessage});
      }else{
        res.json(response);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/runScenario', async (req, res) =>{
  try {
    var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/runScenario';
    req.body.userId = req.decoded.userId;
    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from readRegions Java service...");
        res.json({success: false, error: true, message: response.errorMessage});
      }else{
        res.json(response);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getScriptSettings', async(req,res)=>{
  try{
    var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/getJMeterScriptSettings';
    //var url = 'http://localhost:8080/Appedo-UI-Module-Services/lt/getJMeterScriptSettings';
    req.body.userId = req.decoded.userId;
    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from uploadJmeterScripts Java service...");
        res.json({success:false, error: true, invalidToken : false, message: response.errorMessage});
      } else{
        res.json({success:true, invalidToken: false, result:JSON.stringify(response.message)});
      }
    });
  }catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateJMeterScenarioSettings', async(req,res)=>{
  try{
    var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/updateJMeterScenarioSettings';
    req.body.userId = req.decoded.userId;
    request.post(url,{form: req.body}, function (httpError, httpResp, body){
      let response = JSON.parse(body);
      if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
        logger.error("Error Message recived from uploadJmeterScripts Java service...");
        res.json({success:false, error: true, invalidToken : false, message: response.errorMessage});
      } else{
        let qryParam = [req.body.scenarioId, req.decoded.userId];
        let qryText = "UPDATE lt_scenario_master SET modified_on = now(), modified_by = $2 WHERE scenario_id=$1";
        psqlAPM.fnDbQuery("updateJMeterScenarioSettings",qryText,qryParam,null, null);
        res.json({success:true, invalidToken: false, message : response.message});
      }
    });
  }catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/deleteJmeterScenarios', async (req, res) => {
  let queryText;
  let mappedScript = req.body.mappedScripts.split(",");
  let queryParam;
  let userId = req.decoded.userId;
  try{
    queryText = "SELECT * FROM delete_jmeter_scenario($1, $2, $3)";
    queryParam = [req.body.scenarioId, userId, req.body.mappedScripts];
    psqlAPM.fnDbQuery('deleteJmeterScenarios',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
      	var url = appedoConfigProperties.MODULE_UI_SERVICES + '/lt/deleteJMeterScenarios';
        //var url = 'http://localhost:8080/Appedo-UI-Module-Services/lt/deleteJMeterScenarios';
        req.body.userId = req.decoded.userId;
        request.post(url,{form: req.body}, function (httpError, httpResp, body){
          let response = JSON.parse(body);
          if (httpError || (httpResp && httpResp.statusCode != 200) || (httpResp.statusCode == 200 && !response.success)) {
            logger.error("Error Message recived from uploadJmeterScripts Java service...");
            res.json({success:false, error: true, invalidToken : false, message: response.errorMessage});
          } else{
            res.json({success:true, invalidToken: false, message : response.message});
          }
        });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Mapped Id '+req.body.id+' not found.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/delMappedUserFromEnt', async (req, res) => {
  try{
    const queryText = "DELETE FROM user_enterprise_mapping WHERE id = $1";
    const queryParam = [req.body.id];
    psqlAPM.fnDbQuery('delMappedUserFromEnt',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Successfully Removed Mapped User'});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Mapped Id '+req.body.id+' not found.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getUsrEntMap', async (req, res) => {
  try{
    const queryText = "SELECT uem.id, em.e_id, uem.user_id, um.email_id, um.first_name, um.last_name, um.mobile_no, EXTRACT(EPOCH FROM um.email_verified_on)*1000 as email_verified_on FROM enterprise_master as em JOIN user_enterprise_mapping as uem ON em.e_id = uem.e_id JOIN usermaster as um ON um.user_id = uem.user_id WHERE em.e_id = $1 OFFSET $2 LIMIT $3";
    const queryParam = [req.body.e_id, req.body.offset, req.body.limit];
    psqlAPM.fnDbQuery('getUsrEntMap',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Success', result: result.rows});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, rowCount:result.rowCount, message:'For Enterprise Id '+req.body.e_id+' users not mapped.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/unDelEnterprise', async (req, res) => {
  try{
    const queryText = "UPDATE enterprise_master SET is_deleted = false WHERE e_id = $1";
    const queryParam = [req.body.e_id];
    psqlAPM.fnDbQuery('unDelEnterprise',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Successfully Activated the Enterprise'});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Enterprise Id '+req.body.e_id+' not found.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/delEnterprise', async (req, res) => {
  try{
    const queryText = "UPDATE enterprise_master SET is_deleted = true WHERE e_id = $1";
    const queryParam = [req.body.e_id];
    psqlAPM.fnDbQuery('delEnterprise',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Successfully Deactivated the Enterprise'});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Enterprise Id '+req.body.e_id+' not found.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getEntByUser', async (req, res) =>{
  try{
    const queryText = 'SELECT em.e_id, em.e_name, em.description, count(uem.id) as mapped_user, em.is_deleted FROM enterprise_master as em LEFT JOIN user_enterprise_mapping as uem ON uem.e_id = em.e_id WHERE em.user_id=$1 GROUP BY 1,2,3 ORDER BY 2 OFFSET $2 LIMIT $3';
    const queryParam = [req.decoded.userId, req.body.offset, req.body.limit];
    psqlAPM.fnDbQuery('getEntByUser',queryText, queryParam, req, res).then( result => {
      if (result.success ){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, rowCount:result.rowCount, message:'No Enterprise Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/addUpdEnterprise', async(req,res)=>{
  try{
    let createdOn = new Date();
    let createdBy = req.decoded.userId;
    let queryText;
    let queryParam;
    if (req.body.e_id == null){
      queryText = "INSERT INTO enterprise_master(e_name, description, user_id, created_by,created_on) VALUES ($1,$2,$3,$5,$4) RETURNING e_id";
      queryParam = [req.body.e_name, req.body.description, req.decoded.userId,createdOn,createdBy];
      psqlAPM.fnDbQuery('addEnterprise',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          queryText = "INSERT INTO user_enterprise_mapping(e_id, user_id, email_id,created_on) SELECT $1, user_id, email_id, $2 FROM usermaster where user_id = $3";
          queryParam = [result.rows[0].e_id, createdOn, createdBy];
          psqlAPM.fnDbQuery('addEnterprise - add user_enterprise_mapping detail',queryText, queryParam, req, res).then( result1 => {
            if (result.rowCount > 0 ){
              res.json({success:true, message:"Successfully added enterprise"});
            } else {
              if (!result.error)
                res.json({success:false, message:"Add Enterprise Failed" });
              else 
                res.json(result);
            }
          });
        } else {
          if (!result.error)
            res.json({success:false, message:"Add Enterprise Failed" });
          else {
            if (result.message.includes("duplicate")){
              res.json({success:false, message:"Enterprise Name already Exist" });
            } else {
              res.json(result);
            }
          }
        }
      });
    } else {
      queryText = "UPDATE enterprise_master SET e_name=$2, description=$3,modified_on=$4, modified_by=$5 WHERE e_id = $1";
      queryParam = [req.body.e_id, req.body.e_name, req.body.description, createdOn, createdBy];
      psqlAPM.fnDbQuery('updateEnterprise',queryText, queryParam, req, res).then( result => {
        if (result.rowCount > 0 ){
          res.json({success:true, message:"Successfully updated enterprise "+req.body.e_name});
        } else {
          if (!result.error)
            res.json({success:false, message:"No record found" });
          else 
            res.json(result);
        }
      });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getSumBrowsersById', async(req,res)=>{
  try{
    const queryParam = [req.body.testId];
    const queryText = "SELECT dob.browser_name from sum_test_device_os_browser stdob JOIN sum_device_os_browser dob on dob.dob_id = stdob.device_os_browser_id WHERE stdob.sum_test_id=$1"
    psqlAPM.fnDbQuery('getSumBrowsersById',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success with "+result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, message:"No Browser Found for test id "+req.body.testId });
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getSumLocationById', async(req,res)=>{
  try{
    const queryParam = [req.body.testId];
    const queryText = "SELECT location from sum_test_cluster_mapping WHERE test_id = $1"
    psqlAPM.fnDbQuery('getSumLocationById',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success with "+result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, message:"No Location Found for test id "+req.body.testId });
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getSumCardData', async(req,res)=>{
  try{
    let eId = req.body.eId == null ? " AND stm.user_id = "+ req.decoded.userId : " AND stm.e_id ="+ req.body.eId; 
    const queryParam = [req.body.offset, req.body.limit];
    const queryText = "SELECT stm.test_id, stm.testname, lower(stm.testtype) testtype, stm.testurl, stm.start_date, stm.end_date, stm.runevery, CASE WHEN stm.status = true AND stm.start_date < now() AND stm.end_date > now() THEN 'Running' WHEN stm.status = true AND stm.start_date > now() AND stm.end_date > now() THEN 'Scheduled' WHEN stm.status = true AND stm.start_date < now() AND stm.end_date < now() THEN 'Completed' WHEN stm.status = false THEN 'Disabled' ELSE 'N/A' END AS status, stm.last_run_detail,stm.repeat_view, stm.created_on, um.first_name as created_by, sc.display_name as connection_name,'SUM' as module_code FROM sum_test_master stm JOIN usermaster um ON um.user_id = stm.user_id JOIN sum_connectivity sc ON sc.connection_id=stm.connection_id WHERE stm.is_delete = false "+eId +" ORDER BY 8, stm.testname OFFSET $1 LIMIT $2";
    psqlAPM.fnDbQuery('getSumCardData',queryText, queryParam, null, null).then( result => {
      if (result.success){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, message:"No SUM Test configured for this User/Enterprise" });
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateMMCardCV', async (req, res) => {
  try {
    let modCode = req.body.modCode != undefined ? req.body.modCode.toLowerCase(): 'NA';
    modCode = modCode == 'server' ?'svr':modCode=='application' ?"app" :modCode == 'database' ?'db' : modCode;
    let tableName = "chart_visual_"+req.decoded.userId;
    let chartTitle = modCode+"::"+req.body.modName;
    let queryText = "UPDATE "+tableName+" SET chart_title = $1, modified_by=$3, modified_on=$2 WHERE ref_id = $4 ";
    let queryParam = [chartTitle, req.body.modifiedOn, req.decoded.userId, req.body.uid];
    psqlAPM.fnDbQuery('updateMMCardCV',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: "UID "+req.body.uid +" Successfully updated"});
      } else {
        if(!result.error){
          res.json({success:false,invalidToken : false, message:"UID "+req.body.uid +" Not Found in Chart Visual"});
        }
        else{
          res.json(result);
        } 
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateEditMMCard', async (req, res) => {
  try {
    let queryText = "UPDATE module_master SET module_name = $2, description = $3, modified_on = now(), modified_by = $4 WHERE uid = $1 ";
    let queryParam = [req.body.uid, req.body.modName, req.body.description, req.decoded.userId];
    psqlAPM.fnDbQuery('updateEditMMCard',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Success', result: "UID "+req.body.uid +" Successfully updated"});
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:"UID "+req.body.uid +" Not Found."});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateConfigMM', async (req, res) => {
  try {
    const tableName = 'counter_master_' + req.body.uid;
    let queryText = "UPDATE module_master SET user_status = 'restart' WHERE uid = $1 AND user_id = $2";
    let queryParam = [req.body.uid, req.decoded.userId];
    psqlAPM.fnDbQuery('updateConfigMM',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result:"Successfully updated restart command to Module Master" });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:"Module Master has no Data for UID :"+ req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateConfigCV', async (req, res) => {
  try {
    let metricIds = req.body.metricIds.toString();
    let queryText = "SELECT * FROM update_counter_in_chart_visual($1,$2,'"+metricIds+"', $4,$3)";
    let queryParam = [req.decoded.userId, req.body.uid,req.body.moduleCode, req.body.moduleName];
    psqlAPM.fnDbQuery('updateConfigCV',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: "Successfully Updated Chart Visual." });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:"No data in chart visual."});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateConfigureMetrics', async (req, res) => {
  try{
    let metricIds = req.body.metricIds.toString();
    const tableName = "counter_master_"+req.body.uid;
    let queryText = "UPDATE "+tableName+" SET is_selected = false WHERE is_selected = true";
    let queryParam = [];
    psqlAPM.fnDbQuery('updateConfigureMetrics-unset',queryText, queryParam, req, res).then(result => {
        queryText = "UPDATE "+tableName+" SET is_selected = true WHERE counter_id IN ("+metricIds+")";
        queryParam = [];
        psqlAPM.fnDbQuery('updateConfigureMetrics-set',queryText, queryParam, req, res).then(result1 => {
          if (result1.success){
            res.json({success:true,invalidToken : false, message:'Success', result:"Counter Metrics for "+req.body.uid+" Updated Successfully" });
          } else {
            if(!result1.error)
              res.json({success:false,invalidToken : false, message:'Update Failed for uid '+req.body.uid});
            else 
              res.json(result1);
          }
        })        
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/pasteConfigByUid', async (req, res) => {
  try{
    const tableName = "counter_master_"+req.body.uid;
    const copyTableName = "counter_master_"+req.body.copiedUid;
    let queryText = "UPDATE "+tableName+" SET is_selected = false WHERE is_selected = true";
    let queryParam = [];
    //reset the existing selected metrics
    let result = await psqlAPM.fnDbQuery('pasteConfigByUid - unset',queryText, queryParam, null, null);
    if (result.success) {
      queryText = "UPDATE "+tableName+" AS pst SET is_selected = true FROM "+copyTableName+" AS cpy  WHERE pst.category = cpy.category AND pst.counter_name = cpy.counter_name AND cpy.is_selected = true";
      queryParam = [];
      let result1 = await psqlAPM.fnDbQuery('pasteConfigByUid - set',queryText, queryParam, null, null);
      if (result1.success){
        queryText = "SELECT counter_id FROM "+tableName+" WHERE is_selected = true";
        let result2 = await psqlAPM.fnDbQuery('getCounterId - fromPaste',queryText, queryParam, null, null);
        if (result2.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Success', result:result2.rows});    
        }  else {
          if(!result2.error)
            res.json({success:false,invalidToken : false, message:'No selected metrics found for uid '+req.body.uid});
          else 
            res.json(result2);
        }
      } else {
        if(!result1.error)
          res.json({success:false,invalidToken : false, message:'No matching category & metric name to copy for uid '+req.body.uid});
        else 
          res.json(result1);
      }
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/copyConfigByUid', async (req, res) => {
  try {
    const tableName = 'counter_master_' + req.body.uid;
    let queryText = "SELECT category, counter_name from "+tableName+" WHERE is_selected=true";
    let queryParam = [];
    psqlAPM.fnDbQuery('copyConfigByUid',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error) 
          res.json({success:false,invalidToken : false, message:"No Data for UID :"+ req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getConfigByUid', async (req, res) => {
  try {
    const tableName = 'counter_master_' + req.body.uid;
    let queryText = "SELECT lower(category) category, counter_name, counter_id, is_selected from "+tableName+" order by 1, 2";
    let queryParam = [];
    psqlAPM.fnDbQuery('getConfigByUid',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
          res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:"No Data for UID :"+ req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/chkDDChartId', async (req, res) => {
  try{
    let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
    const tableName = 'chart_visual_' + userId;
    let queryText = "SELECT cv.chart_id,cv.dd_chart_id from "+tableName+" as cv where cv.chart_id = $1";
    let queryParam = [req.body.ddChartId];
    psqlAPM.fnDbQuery('chkDDChartId',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        if (result.rows[0].dd_chart_id == req.body.chartId) {
          res.json({success:false,invalidToken : false, message:"Cyclic Redundancy Check failed,"+ req.body.ddChartId+" has already have a mapping of this parent chart id"});
        } else {
          res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
        }
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:"Drilldown chartid "+req.body.ddChartId +" does not exist, please verify"});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});
router.post('/getCVSubCategoryStat', async (req, res) => {
  try {
    let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
    const tableName = 'chart_visual_' + userId;
    const queryText = "SELECT cv.ref_id, lower(mm.module_name) as  module_name,  count(cv.chart_id) count FROM "+tableName+" cv JOIN module_master mm on mm.uid = cv.ref_id  WHERE lower(cv.module_type) = $1 GROUP BY 1,2 ORDER BY 2";
    const queryParam = [req.body.moduleType];
    psqlAPM.fnDbQuery('getCVSubCategoryStat',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Metrics for this '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getAvlConfigCntForUid', async (req, res) => {
  try{
    const tableName = 'counter_master_' + req.body.uid;
    const queryText = "select count(CASE WHEN is_selected = true THEN 1 ELSE NULL END) AS configured, count(counter_id) AS available from "+tableName ;
    const queryParam = [];
    psqlAPM.fnDbQuery('getAvlConfigCntForUid',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Metrics for this '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getRumPageViews', async (req, res) => {
  try{
    let tableName ;
    let queryText ;
    tableName = 'rum_collector_'+ req.body.uid;
    queryText = "SELECT count(*) page_views, (SELECT max(received_on)::timestamp with time zone from "+tableName+") last_appedo_received_on FROM "+tableName+" where (now()- interval '1 hour') <= received_on";
    const queryParam = [];
    psqlAPM.fnDbQuery('getRumPageViews',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Views for last 1 hour '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getMetricStatusForUid', async (req, res) => {
  try{
    let tableName ;
    let queryText ;
    if (req.body.modType=='rum'){
      tableName = 'so_rum_threshold_breach_'+ req.decoded.userId;
      queryText = "select uid, count(case when breached_severity = 'WARNING' THEN 1 ELSE NULL END ) AS warning, count(case when breached_severity = 'CRITICAL' THEN 1 ELSE NULL END ) AS critical FROM "+tableName+" where uid = "+req.body.uid+" AND  (now()- interval '1 hour') <= received_on group by uid" ;
    } else if (req.body.modType == 'server' || req.body.modType =='application' || req.body.modType == 'database') {
      tableName = 'so_threshold_breach_' + req.decoded.userId;
      queryText = "Select * from crosstab( $$select uid::int,breached_severity, count(counter_id)::int AS status_count from (select b.uid, b.counter_id, b.breached_severity from "+tableName+" b inner join (select counter_id, MAX(so_tb_id) so_tb_id, uid from "+tableName+" where (now()- interval '1 hour') <= received_on AND uid = "+req.decoded.userId+" group by counter_id,uid ) as a on a.so_tb_id =b.so_tb_id) b  group by uid, breached_severity order by 1,2$$) as ct (uid int, critical int, warning int)" ;
    }
    const queryParam = [];
    psqlAPM.fnDbQuery('getMetricStatusForUid',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Critical, Warning for '+req.body.uid});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/validateConnection', async (req,res) => {
  try{
    let data = req.body;
    let connectionDetails = req.body.connection_details;
    let query ;
    if (data.engine_name != null) {
      switch (data.engine_name) {
        case 'postgresql':
          query = 'Select now()'
          pgCustom.fnDbQueryConn('validateConnection',connectionDetails,query, [], req, res).then( (result) => {
             if (result.success && result.rowCount>0){
              res.json({success:true, connection:true });
             } else {
               if (result.error){
                  res.json(result);
               } else {
                res.json({success:false, connection:false});
               }
             }
          })
          break;
        case 'mysql':
          res.json({success:false, message:"Yet to be implemented" });
          break;
        case 'mssql':
          query = "SELECT GETDATE()";
          mssqlCustom.mssqlQry('validateConnection',connectionDetails,query, [], req, res).then( (result) => {
            if (result.success && result.recordsets.length>0){
              res.json({success:true, connection:true });
             } else {
               if (result.error){
                  res.json(result);
               } else {
                res.json({success:false, connection:false });
               }
             }
          });
          break;
        case 'oracle':
          res.json({success:false, message:"Yet to be implemented" });
          break;
        case 'clickhouse':
          query = "select now()";
          chsqlCustom.chDbQuery('validateConnection',connectionDetails,query,req,res).then((result) => {
            if(result.success && result.result.length >0){
              res.json({success:true,connection:true});
            } else {
              if(result.error){
                res.json(result);
              } else {
                res.json({success:false, connection:false, message: "No rows found"});
              }
            }
          });
          break;
        default :
          res.json({success:false, message:"Yet to be implemented"});
      }
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getCVCardByRefId', async (req, res) =>{
  try{
    let userId = Number(req.body.entUserId == null ? req.decoded.userId : req.body.entUserId);
    let uid = Number(req.decoded.userId);
    let is_owner = uid == req.decoded.userId ? true : false;
    let eId = req.body.entId == 0 ? " AND (cv.e_id is null OR cv.e_id='') " : " AND cv.e_id ='"+ req.body.entId+"'"; 
    const queryParam = [userId,req.body.refId, req.body.module_type];
    const tableName = 'chart_visual_'+userId;
    const queryText = 'SELECT cv.chart_id, um.user_id, um.first_name, cv.chart_title, cv.e_id, cv.root_chart_type, cv.chart_desc, cv.module_type, cv.category, cv.chart_types_json, cv.dd_chart_id, ddcv.chart_title as dd_chart_name, cv.db_connector_id_query, db.connector_name, (CASE WHEN cv.aggr_query is null THEN false ELSE true END) AS has_aggr_qry, '+is_owner+' as is_owner, cv.is_system FROM '+tableName+' AS cv LEFT JOIN usermaster AS um on um.user_id = $1 LEFT JOIN '+tableName+' ddcv on ddcv.chart_id = cv.dd_chart_id LEFT JOIN db_connector_details db ON db.db_id = cv.db_connector_id_query WHERE cv.ref_id = $2 AND lower(cv.module_type)=$3'+eId;
    psqlAPM.fnDbQuery('getCVCardByRefId',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:'No Chart Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartVisualCard', async (req, res) =>{
  try{
    let userId = Number(req.body.entUserId == null ? req.decoded.userId : req.body.entUserId);
    let uid = Number(req.decoded.userId);
    let is_owner = uid == req.decoded.userId ? true : false;
    let eId = req.body.entId == 0 ? " AND (cv.e_id is null OR cv.e_id='') " : " AND cv.e_id ='"+ req.body.entId+"'"; 
    const queryParam = [userId,req.body.modType];
    const tableName = 'chart_visual_'+userId;
    const queryText = 'SELECT cv.chart_id, um.user_id, um.first_name, cv.chart_title, cv.e_id, cv.root_chart_type, cv.chart_desc, cv.module_type, cv.category, cv.chart_types_json, cv.dd_chart_id, ddcv.chart_title as dd_chart_name, cv.db_connector_id_query, db.connector_name, (CASE WHEN cv.aggr_query is null THEN false ELSE true END) AS has_aggr_qry, '+is_owner+' as is_owner, cv.is_system, EXTRACT(EPOCH FROM cv.created_on)*1000 as created_on FROM '+tableName+' AS cv LEFT JOIN usermaster AS um on um.user_id = $1 LEFT JOIN '+tableName+' ddcv on ddcv.chart_id = cv.dd_chart_id LEFT JOIN db_connector_details db ON db.db_id = cv.db_connector_id_query WHERE lower(cv.module_type) = lower($2)  '+eId +'Order by cv.chart_title';
    psqlAPM.fnDbQuery('getChartVisualCard',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:'No Chart Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/dbConnectorUpdate', async (req, res) =>{
  try{
    let dbConnData;
    await PgConfig.decrypt(req.body.data).then(res =>{
      dbConnData = JSON.parse(res);
    });
    let d = Date.now();
    let queryText; let queryParam;
    let currentDate = dateFormat(d,"isoDateTime");
    let msg;
    if (dbConnData.db_id != null){
      queryText = 'UPDATE db_connector_details SET connector_name = $2, connection_details = $3, engine_name = $4, modified_on = $5 WHERE db_id = $1';
      queryParam = [dbConnData.db_id,dbConnData.connector_name,dbConnData.connection_details,dbConnData.engine_name,currentDate];
      msg = "Database Connector Updated Successfully"
    } else {
      queryText = "INSERT INTO db_connector_details (user_id, connector_name, engine_name, connection_string, connection_details, driver_class, user_name, password, last_validated_on, validation_status, created_by) Values ($1,$2,$3,'Not Applicable',$4,'Not Applicable',$5,$6,$7,true,$1)";
      queryParam = [req.decoded.userId, dbConnData.connector_name, dbConnData.engine_name, dbConnData.connection_details,dbConnData.connection_details.user, dbConnData.connection_details.password,currentDate];
      msg = "Database Connector Created Successfully"
    }
    
    psqlAPM.fnDbQuery('dbConnectorUpdate',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:msg });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'Failed to Insert/Update'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartMappedCnt', async (req, res) => {
  try{
    const tableName = 'chart_visual_' + req.decoded.userId;
    const queryText = "SELECT count(chart_id) count FROM "+ tableName +" WHERE db_connector_id_query = $1 OR db_connector_id_aggr_query = $1"
    const queryParam = [req.body.dbId];
    psqlAPM.fnDbQuery('getChartMappedCnt',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success', result: result.rows });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'No Chart Mapped for '+req.body.dbId});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getColDef', async (req, res) => {
  try{
    let queryParam
    await PgConfig.decrypt(req.body.data).then(res =>{
      queryParam = JSON.parse(res);
    });
    let qryText = "SELECT column_name, data_type, CASE WHEN numeric_precision is not null THEN true ELSE false END AS is_numeric FROM information_schema.columns WHERE table_name = $1"
    let qryParam = [queryParam.table_name.split('.')[1]];
    let result = await pgCustom.fnDbQuery('getColDef',queryParam.connectionString, qryText, qryParam, null, null);
    if (result.success){
      res.json({success:true,invalidToken : false, rowCount: result.rowCount, result: result.rows});
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getPolicyCntByUid', async (req, res) => {
  try{
    let tableName = req.body.table_name;
    let queryText = "SELECT COUNT(*) FROM "+tableName+" WHERE uid = $1 AND LOWER(log_grok_name)=$2";
    let queryParam = [req.body.uid, req.body.log_grok];
    let result = await psqlAPM.fnDbQuery('getPolicyCntByUid', queryText, queryParam, null, null);
    if (result.success){
      res.json({success:true,invalidToken : false, rowCount: result.rowCount, result: result.rows});
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/delCustomQry', async (req, res) => {
  try{
    let queryText = "DELETE FROM custom_chart_queries WHERE id=$1";
    let queryParam = [req.body.id];
    let result = await psqlAPM.fnDbQuery('delCustomQry', queryText, queryParam, null, null);
    if (result.success){
      let tableName = "my_chart_visual_"+req.decoded.userId;
      queryText = "DELETE FROM "+tableName+" WHERE chart_id = $1 AND is_new_visualizer";
      await psqlAPM.fnDbQuery('delCustomQry - myChart', queryText, queryParam, null, null);
      res.json({success:true,invalidToken : false, message:"Successfully Deleted the selected Query"});
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/saveQuery', async (req, res) => {
  try{
    let param = req.body;
    let qryText;
    let qryParam;
    let msg = '';
    if (param.qry_id == null){
      qryText = "INSERT INTO custom_chart_queries (connector_id, table_name, group_by, filter_by, column_names, query_text, chart_type, created_by, created_on, qry_name, qry_desc, custom_params, order_by,is_advance_query, disp_columns) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$10,$11,$12, $13, $14)";
      qryParam = [ param.connector_id, param.table_name, param.group_by, param.filter_by, param.column_names, param.query_text, param.chart_type, req.decoded.userId, param.qry_name, param.qry_desc, param.custom_params, param.order_by, param.is_advance_query, param.disp_columns];
    } else {
      qryText = "UPDATE custom_chart_queries SET connector_id=$1, table_name=$2, group_by=$3,filter_by=$4,column_names=$5,query_text=$6,chart_type=$7,modified_by=$8,modified_on=now(),qry_name=$9, qry_desc=$10, custom_params=$12, order_by=$13, is_advance_query=$14, disp_columns=$15 WHERE id=$11"
      qryParam = [ param.connector_id, param.table_name, param.group_by, param.filter_by, param.column_names, param.query_text, param.chart_type, req.decoded.userId, param.qry_name, param.qry_desc, param.qry_id, param.custom_params, param.order_by, param.is_advance_query, param.disp_columns];
    }
    let result = await psqlAPM.fnDbQuery('saveQuery',qryText, qryParam,null,null);
    if (result.success){
      res.json({success:true,invalidToken : false, message: "Successfully saved the Query"});
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

function startOfWeek(date)
{
  let diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
  let stWeekDate = new Date(date.setDate(diff));
  return new Date(stWeekDate.getFullYear(), stWeekDate.getMonth(), stWeekDate.getDate());
}

router.post('/runRowCountQuery', async (req, res) => {
  try{
    let queryParam;
    await PgConfig.decrypt(req.body.data).then(res =>{
      queryParam = JSON.parse(res);
    });
    if(queryParam.cntQryText.includes('@startDate') && queryParam.queryText.includes('@endDate@')){
      let endDate = new Date().getTime()/1000;
      let startDate = (new Date().getTime()-60*60*1000)/1000;
      queryParam.cntQryText = queryParam.cntQryText.replace('@startDate@',startDate).replace('@endDate@',endDate);
    } else if(queryParam.cntQryText.includes('@startDay@')){
      let today = new Date();
      let startDay = new Date(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + queryParam.timeOffset).toISOString();
      queryParam.cntQryText = queryParam.cntQryText.replace('@startDay@',startDay).replace('@endDay@',today.toISOString());
    } else if(queryParam.cntQryText.includes('@startWeek@')){
      let stWeekDate = startOfWeek(new Date());
      let startWeek = new Date(stWeekDate.getTime() + queryParam.timeOffset).toISOString();
      queryParam.cntQryText = queryParam.cntQryText.replace('@startWeek@',startWeek).replace('@endWeek@',new Date().toISOString());
    } else if(queryParam.cntQryText.includes('@startMonth@')){
      let dt = new Date();
      let stMonth = new Date(dt.getFullYear(), dt.getMonth());
      let startMonth = new Date(stMonth.getTime() + queryParam.timeOffset).toISOString();
      queryParam.cntQryText = queryParam.cntQryText.replace('@startMonth@',startMonth).replace('@endMonth@',new Date().toISOString());
    }
    let result = await pgCustom.fnDbQuery('runRowCountQuery',queryParam.connectionString, queryParam.cntQryText, [], null, null);
    if (result.success){
      res.json({success:true,invalidToken : false, rowCount: result.rowCount, result: result.rows[0].count });
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/runQuery', async (req, res) => {
  try{
    let queryParam;
    await PgConfig.decrypt(req.body.data).then(res =>{
      queryParam = JSON.parse(res);
    });
    if(queryParam.queryText.includes('@startDate') && queryParam.queryText.includes('@endDate@')){
      let endDate = new Date().getTime()/1000;
      let startDate = (new Date().getTime()-60*60*1000)/1000;
      queryParam.queryText = queryParam.queryText.replace('@startDate@',startDate).replace('@endDate@',endDate);
    } else if(queryParam.queryText.includes('@startDay@')){
      let today = new Date();
      let startDay = new Date(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + queryParam.timeOffset).toISOString();
      queryParam.queryText = queryParam.queryText.replace('@startDay@',startDay).replace('@endDay@',today.toISOString());
    } else if(queryParam.queryText.includes('@startWeek@')){
      let stWeekDate = startOfWeek(new Date());
      let startWeek = new Date(stWeekDate.getTime() + queryParam.timeOffset).toISOString();
      queryParam.queryText = queryParam.queryText.replace('@startWeek@',startWeek).replace('@endWeek@',new Date().toISOString());
    } else if(queryParam.queryText.includes('@startMonth@')){
      let dt = new Date();
      let stMonth = new Date(dt.getFullYear(), dt.getMonth());
      let startMonth = new Date(stMonth.getTime() + queryParam.timeOffset).toISOString();
      queryParam.queryText = queryParam.queryText.replace('@startMonth@',startMonth).replace('@endMonth@',new Date().toISOString());
    }
    let result = await pgCustom.fnDbQuery('runQuery-mainQry',queryParam.connectionString, queryParam.queryText, [], null, null);
    if (result.success){
      res.json({success:true,invalidToken : false, rowCount: result.rowCount, result: result.rows, columns: result.fields});
    } else {
      res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getPsqlTables', async (req, res) => {
  try{
    let param;
    await PgConfig.decrypt(req.body.param).then(res =>{
      param = JSON.parse(res);
    });
    let isPartion = param.isPartitioned;
    let queryText;
    if (isPartion){
      queryText = "SELECT ist.table_schema||'.'||ist.table_name AS table_name FROM information_schema.tables ist JOIN pg_class pc ON pc.oid IN (SELECT DISTINCT inhparent FROM pg_inherits) AND relkind='r' AND ist.table_name = pc.relname WHERE ist.table_schema NOT IN ('pg_catalog','information_schema')"
    } else {
      queryText ="SELECT ist.table_schema||'.'||ist.table_name AS table_name FROM information_schema.tables ist JOIN pg_class pc ON pc.oid NOT IN (SELECT inhrelid FROM pg_inherits) AND pc.relkind='r' AND ist.table_name = pc.relname WHERE ist.table_schema NOT IN ('pg_catalog','information_schema')";
    }
    let result = await pgCustom.fnDbQuery('getPsqlTables',param.connectionString, queryText, [], null, null);
    if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, rowCount: result.rowCount, result: result.rows });
    } else {
      if(!result.error)
        res.json({success:false,invalidToken : false, message:'No Tables found'});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getDBConnectorForDbId', async (req, res) => {
  try{
    let dbData = req.body;
    const queryText = "SELECT db.db_id, db.connector_name, db.engine_name, db.connection_details, db.user_name, db.password, EXTRACT(EPOCH FROM db.created_on)*1000 as created_on, db.modified_on FROM db_connector_details db WHERE db.db_id = $1"
    const queryParam = [req.body.dbId];
    psqlAPM.fnDbQuery('getDBConnectorForDbId',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        let queryData; 
        PgConfig.encrypt(JSON.stringify(result.rows[0])).then(res1 =>{
          queryData = res1;
          res.json({success:true,invalidToken : false, message:'Success', result: queryData });
        });
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:'Db Id '+req.body.dbId+' not found.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.get('/getDbConnectorForCV', async (req, res) =>{
  try{
    const queryText = 'SELECT db.db_id, db.connector_name, db.engine_name, db.connection_details, db.last_validated_on, um.first_name, db.user_name, db.password, EXTRACT(EPOCH FROM db.created_on)*1000 as created_on, db.modified_on FROM db_connector_details db JOIN usermaster um ON um.user_id = db.user_id WHERE db.user_id = $1 OR db.is_system = true';
    const queryParam = [req.decoded.userId];
    psqlAPM.fnDbQuery('getDbConnectorForCV',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        let queryData; 
        PgConfig.encrypt(JSON.stringify(result.rows)).then(res1 =>{
          queryData = res1;
          res.json({success:true, message:"Success", result : queryData });
        });
      }  else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:'No DB connector Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/deleteDBConn', async (req, res) =>{
  try{
    let dbId = req.body.db_id;
    let tableName = "chart_visual_"+req.decoded.userId;
    let qryDelCV = "DELETE FROM "+tableName+" WHERE db_connector_id_query = "+dbId+" OR db_connector_id_aggr_query = "+dbId;
    let qryDelDbConn = "DELETE FROM db_connector_details WHERE db_id ="+dbId;
    let qryDelCustomchart = "DELETE FROM custom_chart_queries WHERE connector_id ="+dbId;
    let msg = "Could not delete from "
    async function executeParallelAsyncTasks () {
      const [ resDelCV, resDelDBConn, resDelCustomChart] = await Promise.all([ 
        psqlAPM.fnDbQuery('deleteDBConn-CV',qryDelCV, [], null, null),
        psqlAPM.fnDbQuery('deleteDBConn-DBConn',qryDelDbConn, [], null, null),
        psqlAPM.fnDbQuery('deleteDBConn-CustomChart',qryDelCustomchart, [], null, null),
      ]);
      if (resDelCV.success && resDelDBConn.success && resDelCustomChart.success){
        res.json({success:true, message:'DB Connector Deleted Successfully'});
      } else {
        if (qryDelCV.error) msg += " Chart Visual ";
        if (resDelDBConn.error) msg += " DB Connector ";
        if (resDelCustomChart.error) msg += " Custom Chart's ";
        res.json({success:false, message:msg}); 
      }
    }
    executeParallelAsyncTasks();
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getDatabase', async (req, res) =>{
  try{
    let eId = req.body.e_id;
    if (eId == null){
      wQry = " db.user_id = "+req.decoded.userId;
    } else {
      wQry = eId +" = ANY(arr_eid)";
    }
    const queryText = "SELECT db.db_id, db.engine_name, db.connection_details->>'database' as database, db.user_id, db.is_system, db.arr_eid, (SELECT COUNT(*) FROM custom_chart_queries WHERE connector_id=db.db_id) as cnt_qry FROM db_connector_details db WHERE "+wQry;
    const queryParam = [];
    let result = await psqlAPM.fnDbQuery('getDatabase',queryText, queryParam, null, null);
    if (result.rowCount > 0 ){
      res.json({success:true, message:"Success", result : result.rows});
    }  else {
      if (!result.error)
        res.json({success:false, invalidToken : false, message:'No Database found'});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.get('/getDbConnector', async (req, res) =>{
  try{
    const queryText = 'SELECT db.db_id, db.connector_name, db.engine_name, db.connection_details, db.last_validated_on, um.first_name, db.user_name, db.password, EXTRACT(EPOCH FROM db.created_on)*1000 as created_on, db.modified_on FROM db_connector_details db JOIN usermaster um ON um.user_id = db.user_id WHERE db.user_id = $1 ';
    const queryParam = [req.decoded.userId];
    psqlAPM.fnDbQuery('getDbConnector',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        let queryData; 
        PgConfig.encrypt(JSON.stringify(result.rows)).then(res1 =>{
          queryData = res1;
          res.json({success:true, message:"Success", result : queryData });
        });
      }  else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:'No DB connector Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/addToMyChart', async(req,res) => {
  try{
    let myData = req.body;
    const tableName = "my_chart_visual_"+req.decoded.userId;
    let queryText = "SELECT mc_id FROM "+tableName+" WHERE chart_id = $3 AND lower(trim(mc_name)) = lower(trim($1)) AND user_id = $2 AND is_new_visualizer = $4";
    let queryParam = [myData.mcName, req.decoded.userId, myData.chartId, myData.isNewVisualizer];
    psqlAPM.fnDbQuery('addToMyChart - select',queryText, queryParam, req, res).then(result => {
      if (result.rowCount == 0){
        queryText = "INSERT INTO "+tableName+" (mc_name, chart_id, user_id, e_id, e_owner_id, ref_id, module_type, modified_by, modified_on, is_system_chart,is_new_visualizer) VALUES ($1,$2,$3,$4,$5,$6,$7,$3,$8,$9,$10)";
        queryParam = [myData.mcName, myData.chartId, req.decoded.userId, myData.eId, myData.entOwnerId, myData.refId,myData.moduleType, myData.modifiedOn, myData.isSystem, myData.isNewVisualizer]
        psqlAPM.fnDbQuery('addToMyChart - insert',queryText, queryParam, req, res).then(result => {
          if (result.rowCount > 0){
            res.json({success:true,invalidToken : false, message:'Successfully Added' });
          } else {
            if(!result.error)
            res.json({success:false,invalidToken : false, message:'Unable to add to my chart'});
          else 
            res.json({success: false, invalidToken: false, message: result.message});
          }
        })
      } else {
        if(!result.error)
          res.json({success:false,invalidToken : false, message:"Chart Id "+myData.chartId+" is already mapped to "+myData.mcName });
        else
          res.json(result);
      }
    })
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
})

router.post('/removeChart', async (req, res) => {
  try{
    const tableName = "my_chart_visual_"+req.decoded.userId;
    const queryText = "DELETE FROM "+tableName+" WHERE mc_id=$1"
    const queryParam = [req.body.mcId];
    psqlAPM.fnDbQuery('removeChart',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,invalidToken : false, message:'Success' });
      } else {
        if(!result.error)
        res.json({success:false,invalidToken : false, message:'Failed to remove chart'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/saveChartParam', async (req, res) =>{
  try{
    let arrChartParam = req.body;
    const tableName = "my_chart_visual_"+req.decoded.userId;
    let updRes = [];
    let idxProcessed = 0;
    let suc = true;
    const queryText = 'UPDATE '+tableName+' SET chart_param=$2 WHERE mc_id=$1';
    arrChartParam.map((chartParam,idx) => {
      const queryParam = [arrChartParam[idx].mcId, arrChartParam[idx]];
      psqlAPM.fnDbQuery('saveChartParam',queryText, queryParam, req, res).then(result => {
        idxProcessed++;
        if (result.rowCount > 0){
          updRes.push({success:true,  invalidToken : false, message:'Success'})
        } else {
          if(!result.error) {
            updRes.push({success:false, invalidToken : false, message:"Update not successful."});
            suc = false;
          } else 
              updRes.push({success: false, invalidToken: false, message: result.message});
        }
        if (arrChartParam.length == idxProcessed ){
          if (suc)
            res.json({success:true, invalidToken: false, result: updRes});
          else {
            res.json({success:false, invalidToken: false, result: updRes});
          }
        }
      });
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getCustomQueryById', async (req, res) =>{
  try {
    const queryText = 'SELECT * FROM custom_chart_queries WHERE id=$1';
    const queryParam = [req.body.id];
    psqlAPM.fnDbQuery('getCustomQueryById',queryText, queryParam, null, null).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No Queries Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getConnectorCustomQry', async (req, res) =>{
  try {
    let userId= req.body.eId == null ? req.decoded.userId : req.body.eId;
    let qryWhere;
    if (req.body.eId == null){
      qryWhere = "AND created_by = $1 ";
    } else {
      qryWhere = "AND $1 = ANY(arr_eid) "
    }
    const queryText = "SELECT id, qry_name, qry_desc, arr_eid, is_scheduled, frequency, email_arr, enable_scheduler, report_title, report_description, send_as_attachment,last_email_sent_on, is_success, last_error_msg FROM custom_chart_queries WHERE connector_id=$4 "+qryWhere+" OFFSET $2 LIMIT $3";
    const queryParam = [userId, req.body.offset, req.body.limit, req.body.db_id];
    psqlAPM.fnDbQuery('getConnectorCustomQry',queryText, queryParam, null, null).then( result => {
      if (result.success){
        res.json({success:true, rowCount:result.rowCount, result:result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No Queries Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateReportEmail', async (req, res) =>{
  try{
    let param = req.body;
    const queryText = "UPDATE custom_chart_queries SET email_arr=$1, modified_on=now(), modified_by=$3 WHERE id = $2 "
    const queryParam = [param.email_arr, param.id, req.decoded.userId];
    let result = await psqlAPM.fnDbQuery('updateReportEmail',queryText, queryParam, null, null);
    if (result.rowCount > 0 ){
      res.json({success:true, message:"Successfully updated Email for the report"});
    }  else {
      if(!result.error)
        res.json({success:false, invalidToken : false, message:'Query id not found'});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateSchedule', async (req, res) =>{
  try{
    let param = req.body;
    const queryText = "UPDATE custom_chart_queries SET is_scheduled = true, frequency=$1, enable_scheduler=$2,report_title=$3,report_description=$4, send_as_attachment=$6, time_offset=$7, modified_on=now(),modified_by=$8 WHERE id = $5 "
    const queryParam = [param.frequency, param.enable_scheduler, param.report_title, param.report_description, param.id, param.send_as_attachment, param.time_offset, req.decoded.userId];
    let result = await psqlAPM.fnDbQuery('updateSchedule',queryText, queryParam, null, null);
    if (result.rowCount > 0 ){
      if (param.enable_scheduler){
        res.json({success:true, message:"Successfully scheduled the report"});
      } else {
        res.json({success:true, message:"Successfully updated the scheduler, scheduler is not activated, hence report will not be generated" });
      }
    }  else {
      if(!result.error)
        res.json({success:false, invalidToken : false, message:'Query id not found'});
      else 
        res.json(result);
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.get('/getEnterprise', async (req, res) =>{
  try{
    const queryText = 'SELECT DISTINCT em.e_id, em.e_name, em.user_id AS owner_id, CASE WHEN em.user_id = $1 THEN true ELSE FALSE END as is_owner FROM enterprise_master em LEFT JOIN user_enterprise_mapping uem ON uem.e_id=em.e_id WHERE (uem.user_id=$1 OR em.user_id=$1) AND NOT em.is_deleted ORDER BY 2';
    const queryParam = [req.decoded.userId];
    psqlAPM.fnDbQuery('getEnterprise',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'No Enterprise Configured'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.get('/getDashboard', async (req, res) =>{
  try{
    const tableName = "my_chart_visual_"+req.decoded.userId;
    const queryText = "SELECT lower(mc_name) mc_name from "+tableName+" group by lower(mc_name) order by 1";
    const queryParam = [];
    psqlAPM.fnDbQuery('getDashboard',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success", result : result.rows });
      }  else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:'No dashboard Configured'});
        else 
          res.json(result);
      }
    })
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLogCard', async(req,res)=>{
  try{
    const queryParam = [req.body.modCode, req.body.systemId];
    const queryText = "SELECT mm.uid, mm.module_name, mm.description, um.first_name as created_by, mm.created_on FROM module_master mm LEFT JOIN usermaster um on um.user_id = mm.created_by WHERE lower(mm.module_code) = $1 AND mm.system_id = $2" ;
    psqlAPM.fnDbQuery('getLogCard',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, rowCount:result.rowCount, message:"No record found for this user/enterprise, module code "+req.body.modCode});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getMMCardV2', async(req,res)=>{
  try{
    const queryParam = [req.body.modCode, req.body.systemId, req.body.offset, req.body.limit];
    const queryText = "SELECT mm.uid, mm.module_type, mm.module_name, mm.description, um.first_name as created_by, mm.created_on, mm.last_appedo_received_on, mm.user_status, CASE WHEN (now() - interval '5 minutes') <= mm.last_appedo_received_on THEN true ELSE false END AS active, mm.guid FROM module_master mm LEFT JOIN usermaster um on um.user_id = mm.created_by WHERE lower(mm.module_code) = $1 AND mm.system_id = $2 ORDER BY 9 desc, 3 asc OFFSET $3 LIMIT $4" ;
    psqlAPM.fnDbQuery('getMMCardV2',queryText, queryParam, req, res).then( result => {
      if (result.success){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, rowCount:result.rowCount, message:"No record found for this user/enterprise, module code "+req.body.modCode});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getRumBreachSettings', async(req,res)=>{
  try{
    // let userId = req.body.entId == 0 ? req.decoded.userId : req.body.entUserId;
    const queryParam = [req.body.uid];
    const queryText = "SELECT mm.uid, sla.sla_id, sla.warning_threshold_value, sla.critical_threshold_value,sla.min_breach_count,sla.is_above_threshold FROM module_master mm LEFT JOIN so_sla_rum sla on sla.uid=mm.uid WHERE mm.uid=$1" ;
    psqlAPM.fnDbQuery('getRumBreachSettings',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, rowCount:0, message:"No Breach settings found for this user/enterprise, module code "+req.body.modCode});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getMMCardRum', async(req,res)=>{
  try{
    let eId = req.body.entId == 0 ? "" : " AND e_id ="+ req.body.entId; 
    let userId = req.body.entId == 0 ? req.decoded.userId : req.body.entUserId;
    const queryParam = [userId,req.body.modCode,req.body.offset, req.body.limit];
    const queryText = "SELECT mm.uid, mm.module_name, mm.guid, mm.description, um.first_name as created_by, mm.created_on, mm.last_appedo_received_on, CASE WHEN (now()- interval '5 minutes') <= mm.last_appedo_received_on THEN true ELSE false END AS active from module_master mm LEFT JOIN usermaster um  on um.user_id = mm.user_id WHERE mm.user_id = $1 AND lower(mm.module_code) = $2 "+eId +" ORDER BY 7 desc, 2 asc OFFSET $3 LIMIT $4";
    psqlAPM.fnDbQuery('getMMCardRum',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, rowCount:result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, rowCount:0, message:"No record found for this user/enterprise, module code "+req.body.modCode});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getMMCard', async(req,res)=>{
  try{
    let eId = req.body.entId == 0 ? "" : " AND e_id ="+ req.body.entId; 
    let userId = req.body.entId == 0 ? req.decoded.userId : req.body.entUserId;
    const queryParam = [userId,req.body.modType];
    const queryText = "SELECT mm.uid, mm.guid, mm.module_code, mm.module_name, mm.description, mm.created_by, um.first_name, mm.created_on, mm.last_appedo_received_on, mm.clr_version,  mm.user_status, ctv.version, CASE WHEN (now()- interval '1 minutes') <= mm.last_appedo_received_on THEN true ELSE false END AS active from module_master mm LEFT JOIN counter_type_version ctv  on ctv.counter_type_version_id = mm.counter_type_version_id LEFT JOIN counter_type ct on ctv.counter_type_id = ct.counter_type_id   LEFT JOIN usermaster um  on um.user_id = mm.user_id WHERE mm.user_id = $1 AND (lower(ct.counter_type_name) = $2 OR lower(mm.module_type) = $2) "+eId +" ORDER BY 13 desc, 4 asc" ;
    psqlAPM.fnDbQuery('getMMCard',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success with "+result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, message:"No record found for this user/enterprise, module type "+req.body.modType});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getModuleMasterStat', async(req,res)=>{
  try{
    let eId = req.body.entId == 0 ? "" : " AND e_id ="+ req.body.entId; 
    let moduleCode = req.body.moduleName == "netstack" ? " AND lower(mm.module_code) IN ('netstack', 'nettrace')": " AND lower(mm.module_code) IN ('"+req.body.moduleName+"')";
    let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
    const queryParam = [userId];
    const queryText = "SELECT lower(COALESCE(mm.module_type,COALESCE(ct.counter_type_name,mm.module_code))) module_type, count(mm.uid) count FROM module_master mm LEFT JOIN counter_type_version ctv  on ctv.counter_type_version_id = mm.counter_type_version_id LEFT JOIN counter_type ct on ctv.counter_type_id = ct.counter_type_id WHERE mm.user_id = $1 "+moduleCode + eId +" GROUP BY 1";
    psqlAPM.fnDbQuery('getModuleMasterStat',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success with "+result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, message:"No record found for this user/enterprise, module "+req.body.moduleName });
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getChartVisualStat', async(req,res)=>{
  try{
    let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
    let eId = req.body.entId == 0 ? "  (e_id is null OR e_id='') " : " e_id ='"+ req.body.entId+"'"; 
    const queryParam = [];
    const table_name = "chart_visual_"+userId;
    const queryText = "SELECT lower(COALESCE(module_type,'NULL')) as module_type, count(chart_id) count FROM "+ table_name +" WHERE "+eId+" GROUP BY module_type ORDER BY 2 desc";
    psqlAPM.fnDbQuery('getChartVisualStat',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Success with "+result.rowCount, result : result.rows });
      } else {
        if (!result.error)
          res.json({success:false, message:"No record found for this user/enterprise"});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartDataByChartId', async(req, res)=>{
  let queryWithoutOffset;
  try{
    let chartData = req.body;
    let userId = req.body.entUserId == null ? req.decoded.userId : req.body.entUserId;
    let table_name;
    let queryText;
    let queryParam;
    console.log("from new", chartData.from_new);
    if (!chartData.from_new){
      table_name = "chart_visual_"+userId;
      queryText = "SELECT cv.chart_id, cv.chart_title,cv.category, cv.module_type, cv.ref_id, cv.is_system, cv.h_display,cv.enable_yaxis, cv.stack_cols, cv.stack_type, cv.xaxis_time_scale, cv.chart_types_json, cv.col_units_json, cv.col_critical, cv.col_warning,cv.root_chart_type,cv.query, cv.aggr_query, cv.ref_table_pkey_id,db.engine_name, db.connection_details, cv.dd_chart_id, cv.dd_param, false as from_new FROM "+table_name+" as cv JOIN db_connector_details db on db.db_id = cv.db_connector_id_query WHERE cv.chart_id = $1";
      queryParam = [chartData.chartId];
    } else {
      queryText = "SELECT cq.id as chart_id, cq.qry_name as chart_title, 'custom' as category, 'custom' as module_type, null as ref_id, false as is_system, CASE cq.custom_params->>'h_display' WHEN 'true' THEN true else false END AS h_display,CASE cq.custom_params->>'enable_yaxis' WHEN 'true' THEN true else false END AS enable_yaxis, cq.custom_params->>'stack_cols' AS stack_cols, null AS stack_type, CASE cq.custom_params->>'xaxis_time_scale' WHEN 'true' THEN true ELSE false END AS xaxis_time_scale, cq.custom_params->>'chart_types_json' AS chart_types_json, cq.custom_params->>'col_units_json' AS col_units_json, null as col_critical, null as col_warning,cq.custom_params->>'root_chart_type' AS root_chart_type,cq.custom_params->>'query' AS query, null as aggr_query, -1 as ref_table_pkey_id,lower(db.engine_name) as engine_name, db.connection_details, cq.custom_params->>'dd_chart_id' AS dd_chart_id, cq.custom_params->>'dd_param' AS dd_param, true as from_new FROM custom_chart_queries as cq JOIN db_connector_details db on db.db_id = cq.connector_id WHERE cq.id = $1";
      queryParam = [chartData.chartId];
    }
    psqlAPM.fnDbQuery('getChartDataByChartId',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0){
        let cvParam = result.rows[0];
        let connectionString = cvParam.connection_details;
        let query = chartData.qryType=="query"? cvParam.query: cvParam.aggr_query==null?cvParam.query: cvParam.aggr_query;
        let counterId = cvParam.ref_table_pkey_id;
        let engineName = cvParam.engine_name.toLowerCase();
        query = query.replace(/@dateTrunc@/gi, chartData.dtFormat).replace(/@startDate@/gi,chartData.startTime).replace(/@endDate@/gi, chartData.endTime).replace(/@counterId@/gi, counterId).replace(/@aggr_date@/gi,chartData.aggQryTableName).replace(/@@param1@@/gi,chartData.param1).replace(/@dateTrunc_ms@/gi,chartData.dateTrunc_ms).replace(/@@param2@@/gi,chartData.param2).replace(/@@param3@@/gi,chartData.param3).replace(/@@param4@@/gi,chartData.param4).replace(/@@param5@@/gi,chartData.param5);
        if(engineName == 'clickhouse'){
          if (chartData.qryInterval == '1 MINUTE' || chartData.qryInterval == '1 MINUTES'){
              query = query.replace(/@timeInterval@/gi,"toStartOfMinute");
            } else if (chartData.qryInterval == '5 MINUTES'){
              query = query.replace(/@timeInterval@/gi,"toStartOfFiveMinute");
            } else if(chartData.qryInterval == '15 MINUTES' || chartData.qryInterval == '30 MINUTES'){
              query = query.replace(/@timeInterval@/gi,"toStartOfFifteenMinutes");
            } else {
              query = query.replace(/@timeInterval@/gi,"toStartOfHour");
            }

          let startDate = new Date(chartData.startTime*1000).toISOString().slice(0,19);
          startDate = startDate.replace('T',' ')
          let endDate = new Date(chartData.endTime*1000).toISOString().slice(0,19);
          endDate = endDate.replace('T',' ')
          query = query.replace(/@startDate@/gi,startDate).replace(/@endDate@/gi, endDate);
        }else{
          query = query.replace(/@timeInterval@/gi,chartData.qryInterval);
          if (cvParam.root_chart_type == "table"){
            queryWithoutOffset = query.toString();
            query += " OFFSET "+req.body.offset+" LIMIT "+req.body.limit;
          }
        }
        if (engineName !=null && connectionString != null){
          switch (engineName) {
            case 'postgresql':
              pgCustom.fnDbQuery('getChartDataByChartId',connectionString, query, [], req, res).then((result) => {
                if (result.success) {
                  if (result.rowCount > 0) {
                    cvParam.data = result.rows;
                    cvParam.execQry = queryWithoutOffset;
                    delete cvParam['query'];
                    delete cvParam["ref_table_pkey_id"];
                    let queryData; 
                    PgConfig.encrypt(JSON.stringify(cvParam)).then(res1 =>{
                      queryData = res1;
                      res.json({ success: true, invalidToken: false, error:result.error, message: 'Success', result: queryData});
                    });
                  }
                  else {
                    res.json({ success: false, invalidToken: false, error:result.error, message: "No rows returned" });
                  }
                }
                else {
                  res.send(result);
                }
              });
              break;
            case 'mssql':
              mssqlCustom.mssqlQry('customQuery-mssql',connectionString,query,'',req,res).then(result => {
                if (result.success) {
                  if (result.recordsets.length > 0) {
                    cvParam.data = result.recordset;
                    delete cvParam['query'];
                    delete cvParam["ref_table_pkey_id"];
                    let queryData; 
                    PgConfig.encrypt(JSON.stringify(cvParam)).then(res1 =>{
                      queryData = res1;
                      res.json({ success: true, invalidToken: false, error:result.error, message: 'Success', result: queryData });
                    });
                  } else {
                    //returning field array for validating chart and allow user to save chart
                    res.json({ success: true, invalidToken: false, error:result.error, message: "No rows returned",result: result.fields });
                  }
                } else {
                  res.send(result);
                }
              });
              break;
            case 'clickhouse':
              chsqlCustom.chDbQuery('customQuery-chsql',connectionString,query,req,res).then(result => {
                if(result.success){
                  if(result.result.length > 0){
                    cvParam.data = result.result;
                    delete cvParam['query'];
                    delete cvParam["ref_table_pkey_id"];
                    let queryData;
                    PgConfig.encrypt(JSON.stringify(cvParam)).then(res1 =>{
                      queryData = res1;
                      res.json({success: true,invalidToken: false,message: 'Success',result: queryData });
                    });
                  } else {
                    res.json({ success: true,invalidToken: false,message: "No rows returned",result: result.fields });
                  }
                } else{
                  res.send(result);
                }
              })
              break;
            default :
                res.json({ success: false, invalidToken: false, error:"enginename "+engineName+" not found", message: "enginename "+engineName+" not found" });
          }
        } else {
          res.json({ success: false, invalidToken: false, error:result.error, message: "engine name or connection string is null" });
        }
      }else {
        if (!result.error) 
          res.json({success:false, message:"Chart Id "+chartData.chartId+" does not exist." });
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartVisualForChartId', async(req,res)=>{
  try{
    const queryParam = [req.body.chartId];
    const table_name = "chart_visual_"+req.decoded.userId;
    const queryText = "SELECT cv.chart_id, cv.chart_desc, dc_qry.engine_name qry_engine_name,dc_aggr.engine_name aggr_engine_name,  dc_qry.connection_details qry_connection_details, dc_aggr.connection_details aggr_connection_details, cv.chart_title, cv.category, cv.module_type, cv.root_chart_type, cv.chart_types_json, cv.col_units_json, cv.label_name,cv.xaxis_time_scale, cv.enable_yaxis, cv.h_display, cv.col_critical, cv.col_warning, cv.is_drilldown, cv.dd_chart_id, cv.query, cv.db_connector_id_query, dc_qry.connector_name query_connector_name,cv.aggr_query, cv.db_connector_id_aggr_query, dc_aggr.connector_name aggr_connector_name, cv.ref_table_pkey_id counter_id, cv.is_system, cv.ref_id, cv.dd_param FROM "+table_name+" as cv LEFT JOIN db_connector_details as dc_qry on dc_qry.db_id = cv.db_connector_id_query LEFT JOIN  db_connector_details as dc_aggr on dc_aggr.db_id = cv.db_connector_id_aggr_query WHERE cv.chart_id = $1 " ;
    psqlAPM.fnDbQuery('getChartVisualForChartId',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        let queryData; 
        PgConfig.encrypt(JSON.stringify(result.rows)).then(res1 =>{
          queryData = res1;
          res.json({success:true, message:"Success with "+result.rowCount, result : queryData });
        });
      } else {
        if (!result.error) 
          res.json({success:false, message:"Chart id "+ req.body.chartId+ " does not exist" });
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/customQuery', async(req, res) => {
  try{
    let queryData; 
    await PgConfig.decrypt(req.body.data).then(res =>{
      queryData = JSON.parse(res);
    });
    let userId = req.decoded.userId;
    let queryText = queryData.query.replace(/@dateTrunc@/gi, queryData.dtFormat).replace(/@timeInterval@/gi,queryData.qryInterval).replace(/@startDate@/gi,queryData.startTime).replace(/@endDate@/gi, queryData.endTime).replace(/@aggr_date@/gi,queryData.aggQryTableName).replace(/@userId@/gi, userId).replace(/@counterId@/gi,queryData.counterId)
    let queryParam = [];
    let connectionString = queryData.connectionString;
    let engineName = queryData.engineName;
    if (engineName !=null && connectionString != null){
      switch (engineName) {
        case 'postgresql':
          pgCustom.fnDbQuery('customQuery-psql',connectionString, queryText, queryParam, req, res).then((result) => {
            if (result.success) {
              if (result.rowCount > 0) {
                res.json({ success: true, invalidToken: false, error:result.error, message: 'Success', result: result.rows });
              }
              else {
                //returning field array for validating chart and allow user to save chart
                res.json({ success: true, invalidToken: false, error:result.error, message: "No rows returned",result: result.fields });
              }
            }
            else {
              res.send(result);
            }
          });
          break;
        case 'mysql':
          res.json({success:false, message:"Yet to be implemented" });
          break;
        case 'mssql':
          mssqlCustom.mssqlQry('customQuery-mssql',connectionString,queryText,'',req,res).then(result => {
            if (result.success) {
              if (result.recordsets.length > 0) {
                res.json({ success: true, invalidToken: false, error:result.error, message: 'Success', result: result.recordset });
              }
              else {
                //returning field array for validating chart and allow user to save chart
                res.json({ success: true, invalidToken: false, error:result.error, message: "No rows returned",result: result.fields });
              }
            } else {
              res.send(result);
            }
          });
          break;
        case 'oracle':
          res.json({success:false, message:"Yet to be implemented" });
          break;
        case 'clickhouse':
          chsqlCustom.chDbQuery('customQuery-chsql',connectionString,queryText,req,res).then(result => {
            if (result.success) {
              if(result.result.length > 0) {
                res.json({success:true,invalidToken:false,message:'Success',result:result.result});
              } else{
                res.json({success:true,invalidToken:false,message:"No rows returned",result:result.result});
              }
            } else{
              res.send(result);
            }
          });
          break;
        default :
          res.json({success:false, message:"Yet to be implemented" });
      } 
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartDataPsql', async (req, res) =>{
  try{
    await PgConfig.decrypt(req.body.data).then(decrptData =>{
      qryData = JSON.parse(decrptData);
    });
    if(qryData.query.includes('@startDay@')){
      let today = new Date();
      let startDay = new Date(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + qryData.timeOffset).toISOString();
      qryData.query = qryData.query.replace('@startDay@',startDay);
    } else if(qryData.query.includes('@startWeek@')){
      let stWeekDate = startOfWeek(new Date());
      let startWeek = new Date(stWeekDate.getTime() + qryData.timeOffset).toISOString();
      qryData.query = qryData.query.replace('@startWeek@',startWeek);
    } else if(qryData.query.includes('@startMonth@')){
      let dt = new Date();
      let stMonth = new Date(dt.getFullYear(), dt.getMonth());
      let startMonth = new Date(stMonth.getTime() + qryData.timeOffset).toISOString();
      qryData.query = qryData.query.replace('@startMonth@',startMonth);
    }
    let queryText = qryData.query;
    let connectionDetails = qryData.connection_details;
    let queryParam = [];
    let result = await pgCustom.fnDbQuery('getChartDataPsql',connectionDetails,queryText, queryParam, req, res);
    if (result.success) {
      res.json({success:true, message:result.rowCount, result : result.rows });
    } else {
      res.json({success:false, message:result.message });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartDataMssql', async (req, res) =>{
  try{
    await PgConfig.decrypt(req.body.data).then(decrptData =>{
      qryData = JSON.parse(decrptData);
    });
    let queryText = qryData.query;
    let connectionDetails = qryData.connection_details;
    let queryParam = [];
    let result = await mssqlCustom.mssqlQry('customQuery-mssql',connectionDetails,queryText,'',req,res);
    if (result.success) {
      res.json({success:true, message:result.recordset.length, result : result.recordset });
    } else {
      res.json({success:false, message:result.message });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getChartDataChsql', async(req, res) => {
  try{
    let qryData;
    await PgConfig.decrypt(req.body.data).then(decrptData =>{
      qryData = JSON.parse(decrptData);
    });
    let queryText = qryData.query;
    let connectionDetails = qryData.connection_details;
    let result = await chsqlCustom.chDbQuery('getChartDataChsql-chsql',connectionDetails,queryText,req,res);
    if(result.success){
      result.result.map((res, idx) => {
        res.date_time = new Date(res.date_time+'Z').getTime();
      });
      res.json({success:true, message:result.result.length, result : result.result });
    } else {
      res.json({success:false, message:result.message });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }  
});

router.get('/getMyEnterprises', async (req, res) =>{
  try{
    let queryParam = [req.decoded.userId];
    let queryText = "SELECT e_id, e_name FROM enterprise_master WHERE user_id = $1 AND is_deleted = false";
    let result = await psqlAPM.fnDbQuery('getMyEnterprises',queryText, queryParam, null, null);
    if (result.success && result.rowCount > 0) {
      res.json({success:true, rowCount:result.rowCount, result : result.rows });
    } else {
      if (result.error){
        res.json({success:false, result: result});
      } else 
        res.json({success:false, message:"No Enterprise available" });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updCustQryEntMap', async (req, res) =>{
  try{
    let queryParam = [req.body.ent_ids, req.body.db_id];
    let queryText = "UPDATE custom_chart_queries SET arr_eid = $1 WHERE id=$2";
    let result = await psqlAPM.fnDbQuery('updCustQryEntMap',queryText, queryParam, null, null);
    if (result.success) {
      res.json({success:true, message:"Successfully updated Map/UnMap of the Enterprise to the Custom Query"});
    } else {
      res.json({success:false, message:"Failed to map enterprise" });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updDBEntMap', async (req, res) =>{
  try{
    let queryParam = [req.body.ent_ids, req.body.db_id];
    let queryText = "UPDATE db_connector_details SET arr_eid = $1 WHERE db_id=$2";
    let result = await psqlAPM.fnDbQuery('updDBEntMap',queryText, queryParam, null, null);
    if (result.success) {
      res.json({success:true, message:"Successfully updated Map/UnMap of the Enterprise to the DB Connector"});
    } else {
      res.json({success:false, message:"Failed to map enterprise" });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getMappedEntName', async (req, res) =>{
  try{
    let queryParam = req.body.ent_ids.toString();
    let queryText = "SELECT e_id, e_name FROM enterprise_master WHERE e_id IN ("+queryParam+")";
    let result = await psqlAPM.fnDbQuery('getMappedEntName',queryText, [], null, null);
    if (result.success) {
      res.json({success:true, rowCount:result.rowCount, result : result.rows });
    } else {
      res.json({success:false, message:"No Enterprise Mapped" });
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});


router.post('/getChartQuery', async (req, res) =>{
  try{
    let msg = req.body.entId == 0 ?" " : " for Enterprise "+ req.body.entName;
    let table_name;
    let table_name1;
    let queryText ;
    let queryParam;
    let refId;
    errMsg = [];
    refId = req.body.myDash;
    if(req.body.isFromMyChart){
     table_name = "my_chart_visual_"+req.decoded.userId;
     table_name1 = req.body.chartUsrId == null ? "chart_visual_"+req.decoded.userId : "chart_visual_"+req.body.chartUsrId;
     queryText = 'SELECT mc.mc_id, cv.chart_id, cv.chart_title, cv.category, cv.module_type, mc.chart_param, cv.root_chart_type, cv.chart_types_json, cv.col_units_json, cv.label_name,cv.xaxis_time_scale, cv.enable_yaxis, cv.h_display, cv.col_critical, cv.col_warning, cv.stack_cols, cv.stack_type, cv.is_drilldown, cv.dd_chart_id, cv.ref_table_pkey_id, cv.ref_table_name, cv.ref_id, cv.query, cv.aggr_query, cv.is_active, cv.is_alert_enabled, cv.chart_desc, cv.is_system, db_qry.connection_details qry_connection_details, lower(db_qry.engine_name) qry_engine_name, db_aggr.connection_details aggr_connection_details,lower(db_aggr.engine_name) aggr_engine_name, cv.dd_param, false as from_new FROM '+table_name1+' as cv JOIN '+table_name+' as mc ON mc.is_new_visualizer = false AND cv.chart_id = mc.chart_id AND LOWER(mc_name)=LOWER($3) AND user_id = $1 AND CASE WHEN $2 = 0 THEN mc.e_id is NULL ELSE mc.e_id = $2 END JOIN db_connector_details as db_qry ON db_qry.db_id = cv.db_connector_id_query LEFT JOIN db_connector_details as db_aggr ON db_aggr.db_id = cv.db_connector_id_aggr_query ORDER BY cv.category, cv.chart_title';
     queryParam = [req.decoded.userId,req.body.entId,req.body.myDash];
     //getting charts from new visualizer custom query
     queryText1 = "SELECT mc.mc_id, cq.id as chart_id, cq.qry_name as chart_title, 'custom' as category, 'custom' as module_type, mc.chart_param, cq.custom_params->>'root_chart_type' AS root_chart_type, cq.custom_params->>'chart_types_json' AS chart_types_json, cq.custom_params->>'col_units_json' AS col_units_json, 'NA' AS label_name, CASE cq.custom_params->>'xaxis_time_scale' WHEN 'true' THEN true ELSE false END AS xaxis_time_scale, CASE cq.custom_params->>'enable_yaxis' WHEN 'true' THEN true else false END AS enable_yaxis, CASE cq.custom_params->>'h_display' WHEN 'true' THEN true else false END AS h_display, null AS col_critical, null AS col_warning, cq.custom_params->>'stack_cols' AS stack_cols, null AS stack_type, false AS is_drilldown, cq.custom_params->>'dd_chart_id' AS dd_chart_id, -1 as ref_table_pkey_id, 'NA' AS ref_table_name, null AS ref_id, cq.custom_params->>'query' AS query, null AS aggr_query, true AS is_active, false AS is_alert_enabled, cq.qry_desc AS chart_desc, false AS is_system, db_qry.connection_details AS qry_connection_details, lower(db_qry.engine_name) AS qry_engine_name, null AS aggr_connection_details, null AS aggr_engine_name, cq.custom_params->>'dd_param' AS dd_param, true as from_new FROM custom_chart_queries AS cq JOIN "+table_name+" AS mc ON mc.is_new_visualizer AND mc.chart_id = cq.id AND LOWER(mc_name)=LOWER($3) AND user_id = $1 AND CASE WHEN $2 = 0 THEN mc.e_id is NULL ELSE mc.e_id = $2 END JOIN db_connector_details as db_qry ON db_qry.db_id = cq.connector_id";
     queryParam1 = [req.decoded.userId,req.body.entId,req.body.myDash];
     let rows = []; let rowCount = 0;
     async function executeParallelAsyncTasks () {
      const [ resMyChartOld, resMyChartNew ] = await Promise.all([
        psqlAPM.fnDbQuery('getChartQuery-cvold',queryText, queryParam, null, null), 
        psqlAPM.fnDbQuery('getChartQuery-cvnew',queryText1, queryParam1, null, null), 
      ]);
      if(resMyChartOld.success && resMyChartOld.rowCount>0){
        rows = resMyChartOld.rows;
        rowCount = resMyChartOld.rowCount;
      } else {
        if (resMyChartOld.error)
          errMsg.push(resMyChartOld);
      }
      if (resMyChartNew.success && resMyChartNew.rowCount>0){
        resMyChartNew.rows.map(row =>{
          row.col_units_json = JSON.parse(row.col_units_json);
          row.chart_types_json = JSON.parse(row.chart_types_json);
        });
        rows = rows.concat(resMyChartNew.rows);
        rowCount += resMyChartNew.rowCount;
      } else {
        if (resMyChartNew.error)
          errMsg.push(resMyChartOld);
      }
      let encryptResult;
      if (rows.length > 0 && errMsg.length == 0){
        encryptResult = await PgConfig.encrypt(JSON.stringify(rows));
        res.json({success:true, message:rowCount, result: encryptResult });
      } else if (errMsg.length > 0 && rows.length > 0) {
        res.json({success:true, error:true, message:rowCount, result: encryptResult, errMsg:errMsg})
      } else {
        res.json({success:false, invalidToken : false, message:'No charts mapped to this dashboard '+req.body.myDash + msg});
      }
     }
     executeParallelAsyncTasks();
    } else {
      table_name =  req.body.chartUsrId == null ? "chart_visual_"+req.decoded.userId : "chart_visual_"+req.body.chartUsrId;
      table_name1 = "counter_master_"+req.body.myDash;
      let qryExt ='';
      if(req.body.moduleCode.toLowerCase() == 'database'){
        qryExt = ' AND cv.ref_table_pkey_id IN (SELECT counter_id FROM '+table_name1+' WHERE is_selected UNION select ref_table_pkey_id from '+table_name+' WHERE ref_table_pkey_id = '+refId+')';
      }else if (req.body.moduleCode != 'log' && req.body.moduleCode != 'rum' && req.body.moduleCode != 'avm' && req.body.moduleCode != 'sum' && req.body.moduleCode != 'netstack' && req.body.moduleCode != 'network') {
        qryExt = ' AND cv.ref_table_pkey_id IN (SELECT counter_id FROM '+table_name1+' WHERE is_selected)';
      }else if (req.body.moduleCode == 'network'){
        refId = req.decoded.userId;
        qryExt = ' AND cv.ref_table_pkey_id = '+req.body.myDash;
      }
      queryText ='SELECT cv.chart_id mc_id, cv.chart_id, cv.chart_title, cv.category, cv.module_type, null chart_param, cv.root_chart_type, cv.chart_types_json, cv.col_units_json, cv.label_name,cv.xaxis_time_scale, cv.enable_yaxis, cv.h_display, cv.col_critical, cv.col_warning, cv.stack_cols, cv.stack_type, cv.is_drilldown, cv.dd_chart_id, cv.ref_table_pkey_id, cv.ref_table_name, cv.ref_id, cv.query, cv.aggr_query, cv.is_active, cv.is_alert_enabled, cv.chart_desc, cv.is_system, db_qry.connection_details qry_connection_details, lower(db_qry.engine_name) qry_engine_name, db_aggr.connection_details aggr_connection_details,lower(db_aggr.engine_name) aggr_engine_name, cv.dd_param FROM '+table_name+' as cv JOIN db_connector_details as db_qry ON db_qry.db_id = cv.db_connector_id_query LEFT JOIN db_connector_details as db_aggr ON db_aggr.db_id = cv.db_connector_id_aggr_query WHERE cv.ref_id = $1 AND cv.is_drilldown = false AND LOWER(cv.module_type) = $4'+qryExt +' ORDER BY cv.category, cv.chart_title OFFSET $2 LIMIT $3';
      queryParam = [refId, req.body.offset, req.body.limit, req.body.moduleCode];
      let result = await psqlAPM.fnDbQuery('getChartQuery-cv',queryText, queryParam, req, res);
      if (result.success){
        let encryptResult = await PgConfig.encrypt(JSON.stringify(result.rows));
        res.json({success:true, message:result.rowCount, result: encryptResult });
      } else {
        if (!result.error)
        res.json({success:false, invalidToken : false, message:'No charts mapped to this dashboard '+req.body.myDash + msg});
      else 
        res.json(result);
      }
    }
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
})

router.post('/getDashCharts', async (req, res) =>{
  try{
   let msg = req.body.entId ==0 ?" " : " for Enterprise "+ req.body.entName;
   let table_name;
   let table_name1;
   let queryText ;
   let queryParam;
   if(req.body.isFromMyChart){
    table_name = "my_chart_visual_"+req.decoded.userId;
    table_name1 = "chart_visual_"+req.decoded.userId;
    queryText = 'SELECT mc.mc_id, cv.chart_id, cv.chart_title, cv.category, cv.module_type, mc.chart_param, cv.root_chart_type, cv.chart_types_json, cv.col_units_json, cv.label_name,cv.xaxis_time_scale, cv.enable_yaxis, cv.h_display, cv.col_critical, cv.col_warning, cv.stack_cols, cv.stack_type, cv.is_drilldown, cv.dd_chart_id, cv.ref_table_pkey_id, cv.ref_table_name, cv.ref_id, cv.query, cv.aggr_query, cv.is_active, cv.is_alert_enabled, cv.chart_desc, cv.is_system, db_qry.connection_details qry_connection_details, lower(db_qry.engine_name) qry_engine_name, db_aggr.connection_details aggr_connection_details,lower(db_aggr.engine_name) aggr_engine_name, cv.dd_param FROM '+table_name1+' as cv JOIN '+table_name+' as mc ON cv.chart_id = mc.chart_id AND LOWER(mc_name)=LOWER($3) AND user_id = $1 AND CASE WHEN $2 = 0 THEN mc.e_id is NULL ELSE mc.e_id = $2 END JOIN db_connector_details as db_qry ON db_qry.db_id = cv.db_connector_id_query LEFT JOIN db_connector_details as db_aggr ON db_aggr.db_id = cv.db_connector_id_aggr_query ORDER BY cv.category, cv.chart_title';
    queryParam = [req.decoded.userId,req.body.entId,req.body.myDash];
   } else {
     table_name = "chart_visual_"+req.decoded.userId;
     table_name1 = "counter_master_"+req.body.myDash;
     let qryExt ='';
     if (req.body.moduleCode != 'LOG' && req.body.moduleCode != 'RUM' && req.body.moduleCode != 'AVM') {
       qryExt = ' AND cv.ref_table_pkey_id IN (SELECT counter_id FROM '+table_name1+' WHERE is_selected)';
     }
     queryText ='SELECT cv.chart_id mc_id, cv.chart_id, cv.chart_title, cv.category, cv.module_type, null chart_param, cv.root_chart_type, cv.chart_types_json, cv.col_units_json, cv.label_name,cv.xaxis_time_scale, cv.enable_yaxis, cv.h_display, cv.col_critical, cv.col_warning, cv.stack_cols, cv.stack_type, cv.is_drilldown, cv.dd_chart_id, cv.ref_table_pkey_id, cv.ref_table_name, cv.ref_id, cv.query, cv.aggr_query, cv.is_active, cv.is_alert_enabled, cv.chart_desc, cv.is_system, db_qry.connection_details qry_connection_details, lower(db_qry.engine_name) qry_engine_name, db_aggr.connection_details aggr_connection_details,lower(db_aggr.engine_name) aggr_engine_name, cv.dd_param FROM '+table_name+' as cv JOIN db_connector_details as db_qry ON db_qry.db_id = cv.db_connector_id_query LEFT JOIN db_connector_details as db_aggr ON db_aggr.db_id = cv.db_connector_id_aggr_query WHERE cv.ref_id = $1'+qryExt + ' ORDER BY cv.category, cv.chart_title OFFSET $2 LIMIT $3';
     queryParam = [req.body.myDash, req.body.offset, req.body.limit];
   }
   psqlAPM.fnDbQuery('getDashCharts-cv',queryText, queryParam, req, res).then( result => {
     if (result.success){
       function callback() {
         res.json({success:true, message:result.rowCount, result : result.rows });
       }
       const chartArray = result.rows;
       let queryProcessed = 0;
       chartArray.map((chart,chartIdx) =>{
         let query; let connectionDetails; let engineName;
         if (req.body.qryType=="query"){
           query =chart.query;
           connectionDetails = chart.qry_connection_details;
           engineName = chart.qry_engine_name;
         } else {
           if (chart.aggr_query != null && chart.aggr_query.length>0){
             query = chart.aggr_query;
             connectionDetails = chart.aggr_connection_details;
             engineName = chart.aggr_engine_name;
            } else {
             query = chart.query;
             connectionDetails = chart.qry_connection_details;
             engineName = chart.qry_engine_name;
            }
         }
         query = query.replace(/@dateTrunc@/gi, req.body.dtFormat).replace(/@timeInterval@/gi,req.body.qryInterval).replace(/@startDate@/gi,req.body.startTime).replace(/@endDate@/gi, req.body.endTime).replace(/@counterId@/gi, chart.ref_table_pkey_id).replace(/@aggr_date@/gi,req.body.aggQryTableName).replace(/@dateTrunc_ms@/gi,req.body.dateTrunc_ms);
         if (engineName != null && connectionDetails !=null ){
          switch (engineName.trim()) {
            case 'postgresql':
              pgCustom.fnDbQuery('getDashCharts-data',connectionDetails,query, [], req, res).then( (subResult) => {
                queryProcessed++;
                delete chart["ref_table_name"];
                delete chart["qry_connection_details"];
                delete chart["aggr_connection_details"];
                delete chart["qry_engine_name"];
                if (subResult.error){
                  chart.error = "Connection or engine name not set or "+ subResult.message;
                } else {
                  if (!subResult.success){
                    chart.error = subResult.message;
                  } else {
                    if (subResult.rowCount>0){
                      chart.data = subResult.rows;
                    } else {
                      chart.data =[];
                    }
                  }
                }
                if (queryProcessed == chartArray.length){
                  callback();
                }
              });
              break;
            case 'mysql':
              res.json({success:false, message:"Yet to be implemented" });
              break;
            case 'mssql':
              mssqlCustom.mssqlQry('customQuery-mssql',connectionDetails,query,'',req,res).then(subResult => {
                queryProcessed++;
                delete chart["query"];
                delete chart["aggr_query"];
                delete chart["ref_table_name"];
                delete chart["qry_connection_details"];
                delete chart["aggr_connection_details"];
                delete chart["qry_engine_name"];
                if (subResult.error){
                  chart.error = "Connection or engine name not set or "+ subResult.message;
                } else {
                  if (!subResult.success){
                    chart.error = subResult.message;
                  } else {
                    if (subResult.recordsets.length>0){
                      chart.data = subResult.recordset;
                    } else {
                      chart.data =[];
                    }
                  }
                }
                if (queryProcessed == chartArray.length){
                  callback();
                }
              });
              break;
            case 'oracle':
              res.json({success:false, message:"Yet to be implemented" });
              break;
            default :
              res.json({success:false, message:"Yet to be implemented" });
          }
        } else {
          queryProcessed++;
          chart.error = "connection or engine name null";
          if (queryProcessed == chartArray.length){
            callback();
          }
        }
       });
     }  else {
       if (!result.error)
         res.json({success:false, invalidToken : false, message:'No charts mapped to this dashboard '+req.body.myDash + msg});
       else 
         res.json(result);
      }
   })
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
 });

router.get('/profile', async (req, res) =>{
  try{
    const queryText = "Select first_name, last_name, email_id, mobile_no, pgp_sym_decrypt(password, $2) as password from usermaster where user_id =$1";
    const queryParam = [req.decoded.userId, PgConfig.dbPwdPvtKey];
    psqlAPM.fnDbQuery('profile',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        PgConfig.encrypt(JSON.stringify(result.rows[0])).then(res1 =>{
        queryData = res1;
          res.json({success:true,invalidToken : false, message:'Success', result: queryData });
        });
      } else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:'User not found'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/checkEmailAvl', async (req, res) =>{
  try{
    const queryText = "SELECT user_id, email_id, first_name, last_name, mobile_no from usermaster where email_id = $1 and user_id != $2";
    const queryParam = [req.body.email, req.decoded.userId];
    psqlAPM.fnDbQuery('checkEmailAvl',queryText, queryParam, req, res).then(result => {
      if (result.rowCount == 0){
        res.json({success:true,  invalidToken : false, message:'Success'});
      } else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:"Email already exist",result:result.rows});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/checkEmailAvlInclOwner', async (req, res) =>{
  try{
    const queryText = "SELECT user_id, email_id, first_name, last_name, mobile_no from usermaster where email_id = $1";
    const queryParam = [req.body.email];
    psqlAPM.fnDbQuery('checkEmailAvlInclOwner',queryText, queryParam, req, res).then(result => {
      // if (result.rowCount == 0){
      //   res.json({success:true,  invalidToken : false, message:'Success'});
      // } else {
      //   if (!result.error)
      //     res.json({success:false, invalidToken : false, message:"Email already exist",result:result.rows});
      //   else 
      //     res.json(result);
      // }
      if (result.rowCount > 0) {
        res.json({success:true, invalidToken : false, message:"Email already exist", userExist:true, result:result.rows});
      } else {
        if (result.error) {
          res.json(result);
        } else {
          res.json({success:true, invalidToken : false, userExist:false, message:"Success."});
        }
      }

    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/chgPassword', async (req, res) =>{
  try{
    let pass;
    await PgConfig.decrypt(req.body.data).then(res =>{
      pass = JSON.parse(res);
    });
    let queryText; 
    let queryParam;
    queryText = "Select pgp_sym_decrypt(password, $2) as password from usermaster where user_id =$1";
    queryParam = [req.decoded.userId, PgConfig.dbPwdPvtKey];
    psqlAPM.fnDbQuery('chgPassword-sel',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        if (result.rows[0].password == pass.oldPassword) {
          queryText = 'UPDATE usermaster set password = pgp_sym_encrypt($3, $2) WHERE user_id=$1';
          queryParam = [req.decoded.userId, PgConfig.dbPwdPvtKey, pass.newPassword];
          psqlAPM.fnDbQuery('chgPassword-upd',queryText, queryParam, req, res).then(result1 => {
            if (result1.rowCount > 0) {
              res.json({success:true,  invalidToken : false, message:'Password changed successfully. Please login to continue.'});
            } else {
              if (!result.error)
                res.json({success:false, invalidToken : false, message:"Update not successful."});
              else 
                res.json(result);
            }
          });
        } else {
          res.json({success:false, invalidToken : false, message:"Wrong Old Password"});
        }
      } else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:"User not found"});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/profileUpdate', async (req, res) =>{
  try{
    let profileData;
    await PgConfig.decrypt(req.body.data).then(res =>{
      profileData = JSON.parse(res);
    });
    const queryText = 'UPDATE usermaster set first_name=$1, last_name=$2, mobile_no=$3, email_id=$5 WHERE user_id=$4';
    const queryParam = [profileData.first_name, profileData.last_name, profileData.mobile_no, req.decoded.userId, profileData.email_id];
    psqlAPM.fnDbQuery('profileUpdate',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,  invalidToken : false, message:'Success'});
      } else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:"Update not successful."});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updateCVbyChartId', async (req, res) =>{
  try{
    let queryData; 
    await PgConfig.decrypt(req.body.data).then(res =>{
      queryData = JSON.parse(res);
    });

    const lastActive = dateFormat(queryData.last_active_time,"isoDateTime")
    const tableName = "chart_visual_"+req.decoded.userId;
    const queryText = "UPDATE "+tableName+" SET h_display = $1,enable_yaxis = $2, xaxis_time_scale = $3, chart_types_json = $4, col_units_json = $5, root_chart_type = $6, chart_title = $7, chart_desc = $8,category = $9,query = $10,aggr_query = $11,db_connector_id_query = $12,db_connector_id_aggr_query = $13,col_critical = $14,col_warning = $15,is_system = $16,last_active_time = $17,is_drilldown = $18,e_id = $19, dd_chart_id = $21, dd_param = $22, stack_cols = $23, stack_type = $24 WHERE chart_id = $20";
    const queryParam = [queryData.h_display,queryData.enable_yaxis,queryData.xaxis_time_scale,queryData.chart_types_json, queryData.col_units_json, queryData.root_chart_type, queryData.chart_title, queryData.chart_desc, queryData.category, queryData.query,  queryData.aggr_query, queryData.db_connector_id_query, queryData.db_connector_id_aggr_query, queryData.col_critical,  queryData.col_warning, queryData.is_system, lastActive, queryData.is_drilldown, queryData.e_id,queryData.chart_id, queryData.dd_chart_id, queryData.dd_param, queryData.stack_cols, queryData.stack_type];
    psqlAPM.fnDbQuery('updateCVbyChartId',queryText, queryParam, req, res).then(result => {
      if (result.rowCount > 0){
        res.json({success:true,  invalidToken : false, message: queryData.chart_id+' updated Successfully'});
      } else {
        if (!result.error)
          res.json({success:false, invalidToken : false, message:"Update not successful."});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/addChartVisual', async (req, res) =>{
  try{
    let queryData; 
    await PgConfig.decrypt(req.body.data).then(res =>{
      queryData = JSON.parse(res);
    });
    let d = Date.now();
    const tableName = 'chart_visual_'+req.decoded.userId;
    let created_on =  dateFormat(d,"isoDateTime");
    let last_active = created_on;
    const queryText = "INSERT INTO "+tableName+" (h_display ,enable_yaxis , xaxis_time_scale , chart_types_json , col_units_json , root_chart_type , chart_title , chart_desc ,category ,query,aggr_query ,db_connector_id_query ,db_connector_id_aggr_query ,col_critical ,col_warning ,is_system ,last_active_time ,is_drilldown ,e_id,created_by, created_on,ref_id, ref_table_name, ref_table_pkey_id,chart_type,label_name,module_type, dd_param, stack_cols, stack_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,-1,'NA',-1,$6,'NA','custom', $22,$23,$24)";
    const queryParam = [queryData.h_display,queryData.enable_yaxis,queryData.xaxis_time_scale,queryData.chart_types_json, queryData.col_units_json, queryData.root_chart_type, queryData.chart_title, queryData.chart_desc, queryData.category, queryData.query,  queryData.aggr_query, queryData.db_connector_id_query, queryData.db_connector_id_aggr_query, queryData.col_critical,  queryData.col_warning, queryData.is_system, last_active, queryData.is_drilldown, queryData.e_id,req.decoded.userId,created_on, queryData.dd_param, queryData.stack_cols, queryData.stack_type];
    psqlAPM.fnDbQuery('addChartVisual',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message:"Successfully Added.", result : result.rows });
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:'Insert Not Successful.'});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/updMyChartGridParam', async (req, res) =>{
  try{
    const tableName = 'my_chart_visual_'+req.decoded.userId;
    const queryText = "UPDATE "+tableName+" SET chart_param=$1, modified_on=now(), modified_by=$3 WHERE mc_id = $2";
    const queryParam = [req.body.chart_param, req.body.mc_id, req.decoded.userId];
    psqlAPM.fnDbQuery('updMyChartGridParam',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message: "Modified grid param updated successfully"});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:"Failed to update grid parameter"});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/delCVbyChartId', async (req, res) =>{
  try{
    const tableName = 'chart_visual_'+req.decoded.userId;
    const queryText = "DELETE FROM "+tableName+" WHERE chart_id = $1";
    const queryParam = [req.body.chartId];
    psqlAPM.fnDbQuery('delCVbyChartId',queryText, queryParam, req, res).then( result => {
      if (result.rowCount > 0 ){
        res.json({success:true, message: "Chart Id "+req.body.chartId+" successfully deleted."});
      }  else {
        if(!result.error)
          res.json({success:false, invalidToken : false, message:"Chart Id "+req.body.chartId+" could not be deleted."});
        else 
          res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});
router.post('/getLogDetailsRowCount', async (req, res) =>{
  try{
    let param = req.body;
    let qryText;
    let qryParam;
    let stDate = new Date(param.startDate).toISOString();
    let endDate = new Date(param.endDate).toISOString();
    let tableName;
    if (param.log_table_name != 'avm_test_run_details' && param.log_table_name != 'so_log_threshold_breach_' && param.log_table_name != 'so_threshold_breach_'){
      tableName = param.log_table_name+param.uid;
      qryText = "SELECT count(*) FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2";
      qryParam = [stDate, endDate];
    }
    else if (param.log_table_name == 'so_log_threshold_breach_'){
      tableName = param.log_table_name+param.user_id;
      qryText = "SELECT count(*) FROM "+tableName+" WHERE log_grok_name ='AVM' AND uid=$3 AND appedo_received_on BETWEEN $1 AND $2";
      qryParam = [stDate, endDate,param.uid];
    }
    else if (param.log_table_name == 'so_threshold_breach_'){
      tableName = param.log_table_name+param.user_id;
      qryText = "SELECT count(*) FROM "+tableName+" WHERE lower(breached_severity) = $4 AND uid=$3 AND received_on BETWEEN $1 AND $2";
      qryParam = [stDate, endDate,param.uid, param.grok];
    }
    else {
      tableName = param.log_table_name;
      qryText = "SELECT count(*) FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2";
      qryParam = [stDate, endDate];
    }
    psqlAPM.fnDbQuery('getLogDetailsRowCount',qryText, qryParam, null, null).then(result => {
      if (result.success ){
        res.json({success:true, rowCount:result.rowCount, result:result.rows});
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

router.post('/getLogDetails', async (req, res) =>{
  try{
    let param = req.body;
    let qryText;
    let qryParam;
    let stDate = new Date(param.startDate).toISOString();
    let endDate = new Date(param.endDate).toISOString();
    if(param.log_table_name == 'log_syslog_'){
      let tableName = param.log_table_name+param.uid;
      qryText = "SELECT id, appedo_received_on, os, source, program, priority, pid,facility, logmessage FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 2 DESC OFFSET $3 LIMIT $4";
      qryParam = [stDate, endDate,param.offset, param.limit];
    } else if (param.log_table_name == 'network_http_v7_'){
      let tableName = param.log_table_name+param.user_id;
      qryText = "SELECT uid, appedo_received_on, client_ip, event_category, CASE WHEN event_duration is NULL THEN null ELSE event_duration/1000000 END as event_duration_ms, url_path, url_query, url_port, http_res_status, http_res_status_code, http_res_bytes FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 AND uid=$3 ORDER BY 2 DESC OFFSET $4 LIMIT $5";
      qryParam = [stDate, endDate, param.uid,param.offset, param.limit];
    } else if (param.log_table_name == 'network_icmp_v7_'){
      let tableName = param.log_table_name+param.user_id;
      qryText = "SELECT uid, appedo_received_on, client_ip, event_category, CASE WHEN event_duration is NULL THEN null ELSE event_duration/1000000 END as event_duration_ms, network_type, icmp_version, status, req_msg, res_msg, res_code, network_direction FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 AND uid=$3 ORDER BY 2 DESC OFFSET $4 LIMIT $5";
      qryParam = [stDate, endDate, param.uid, param.offset, param.limit];
    } else if (param.log_table_name == 'log_windows_event_v7_'){
      let tableName = param.log_table_name+param.uid;
      qryText=" SELECT uid, appedo_received_on, level, event_action, message FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 2 DESC OFFSET $3 LIMIT $4"
      qryParam = [stDate, endDate,param.offset, param.limit];
    } else if (param.log_table_name == 'log_custom_log_v7_'){
      let tableName = param.log_table_name+param.uid;
      qryText=" SELECT uid, appedo_received_on, file_path, log_message FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 2 DESC OFFSET $3 LIMIT $4"
      qryParam = [stDate, endDate,param.offset, param.limit];
    } else if (param.log_table_name == 'log_iis_error_v7_'){
      let tableName = param.log_table_name+param.uid;
      qryText = "SELECT uid, appedo_received_on, remote_ip, remote_port, queue_name, reason_phase FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 2 DESC OFFSET $3 LIMIT $4";
      qryParam = [stDate, endDate,param.offset, param.limit];
    } else if (param.log_table_name == 'log_iis_access_v7_'){
      let tableName = param.log_table_name+param.uid;
      qryText = "SELECT uid, appedo_received_on, url_path, port, query, source_address, response_status_code, duration, response_body_bytes FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 2 DESC OFFSET $3 LIMIT $4";
      qryParam = [stDate, endDate,param.offset, param.limit];
    } else if (param.log_table_name == 'log_tomcat_access_'){
      
    } else if (param.log_table_name == 'log_tomcat_catalina_'){
      
    } else if (param.log_table_name == 'log_avm_'){
      let tableName = param.log_table_name+param.uid;
      qryParam = [stDate, endDate,param.offset, param.limit];
      qryText = "SELECT avm_test_id, appedo_received_on, country, state, city, success, resp_time_ms, bandwidth, status_text, status_code,content_length,substring(resp_body from 1 for 100) as response,agent_tested_on FROM "+tableName+" WHERE appedo_received_on BETWEEN $1 AND $2 ORDER BY 2 DESC OFFSET $3 LIMIT $4";
    } else if (param.log_table_name == 'avm_test_run_details'){
      qryParam = [stDate, endDate,param.offset, param.limit, param.uid];
      qryText = "SELECT ard.avm_test_id, atm.testname, atm.testurl, ard.location, ard.agent_tested_on, ard.status_text, ard.status_code, ard.resp_time_ms FROM avm_test_run_details ard JOIN avm_test_master atm ON atm.avm_test_id = ard.avm_test_id WHERE agent_tested_on BETWEEN $1 AND $2 AND agent_id = $5 ORDER BY agent_tested_on DESC OFFSET $3 LIMIT $4";
    } else if (param.log_table_name == 'so_log_threshold_breach_'){
      let tableName = param.log_table_name+param.user_id;
      qryParam = [stDate, endDate,param.offset, param.limit, param.uid,param.grok];
      qryText = "SELECT appedo_received_on, breached_severity, breach_pattern, SUBSTRING(received_message,POSITION(breach_pattern in received_message),100) as recived_message, received_response_code, grok_column, is_above_threshold as is_above, critical_threshold_value as critical, warning_threshold_value as warning, received_value FROM "+tableName+" WHERE log_grok_name = $6 AND uid = $5 AND appedo_received_on BETWEEN $1 AND $2 ORDER BY 1 DESC OFFSET $3 LIMIT $4";
    } else if (param.log_table_name == 'so_threshold_breach_'){
      let tableName = param.log_table_name+param.user_id;
      let cmTable = "counter_master_"+param.uid;
      let where = ''
      if (param.grok != undefined){
        where += " AND LOWER(breached_severity) = '"+param.grok+"'"
      }
      qryParam = [stDate, endDate,param.offset, param.limit, param.uid];
      qryText = "SELECT sot.received_on, sot.counter_id as metric_id, cm.counter_name as metric_name, sot.process_name, sot.is_above, sot.critical_threshold_value as critical, sot.warning_threshold_value as warning, sot.received_value FROM "+tableName+" as sot JOIN "+cmTable+" cm ON cm.counter_id = sot.counter_id WHERE uid = $5 "+where+" AND received_on BETWEEN $1 AND $2 ORDER BY 1 DESC OFFSET $3 LIMIT $4";
    }
    psqlAPM.fnDbQuery('getLogDetails',qryText, qryParam, null, null).then(result => {
      if (result.success ){
        res.json({success:true, rowCount:result.rowCount, result:result.rows});
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    logger.error(process.pid,e.stack);
    res.json({success:false, error:true, message: e.stack});
  }
});

async function fnDbQuery(methodName, queryText, queryParam, req, res) {
  let client;
  let qryResult;
  let start;
  try {
    start = Date.now();
    client = await pool.connect();
    try {
      const result = await client.query(queryText, queryParam);
      const duration = Date.now() - start;
      result.success = true;
      result.error = false;
      console.log(dateFormat(start,"isoDateTime")+', '+methodName +' , '+duration+' ms'+' ,Pool Idle: '+pool.idleCount +' ,QueryWaiting: '+pool.waitingCount +' Pool Total Cnt: '+pool.totalCount);
      logger.info(process.pid,'appedo psql',methodName,duration +' ms',pool.idleCount,pool.waitingCount,pool.totalCount);
      qryResult = result;
    } catch (e) {
      console.error(e);
      logger.error(process.pid,methodName,e.stack);
      qryResult = {success:false, error:true, message: e.stack};
    }
  } catch (e) {
    qryResult = {success:false, error:true, message: e.stack};
  } finally {
    client.release();
  	return qryResult;
  }
}

process.on('unhandledRejection', (err) => { 
  logger.error(process.pid,'unhandledRejection',err);
  console.error(err)
})

pool.on('error', (err) => {
  console.error('An idle client has experienced an error', err.stack)
});
