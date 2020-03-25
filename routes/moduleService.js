const Router = require('express-promise-router')
const jwt = require('jsonwebtoken');
const { Pool } = require('pg')
const PgConfig = require('../config/apd_constants');
const pool = new Pool (PgConfig.pgDbConfig);
const dateFormat = require('dateformat');
const pgCustom = require('./psqlCustom');
const psqlAPM = require('./psqlAPM');
const pgDbAuth = require('./pgDbAuth');
var url = require('url');
var path = require("path");

global.logger = require('../log');

// it allows you to use async functions as route handlers
const router = new Router();
// export our router to be mounted by the parent application
module.exports = router;

async function getSystemId(req, res){
    try{
        let apd_uuid = req.body.systemGeneratorUUID;
        let queryText = 'SELECT system_id FROM server_information WHERE apd_uuid = $1';
        let queryParam = [apd_uuid];
        let result = await psqlAPM.fnDbQuery('getSystemId-LinuxUnification',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            res.json({success:true, failure:false, message: "successfully getting System Id", systemId:result.rows[0].system_id});
        }else{
            res.json({success:false, failure:true, message: "System Id could not be found in ServerInformation table, Contact System Admin."});
        }
    }catch(e){
        logger.error('getSystemId',e.stack);
        res.json({success:false, failure:true, message: e.stack});
    }
}

async function getModuleStatus(req, res){
    try{
        let GUID = req.body.GUID;
        let queryText = 'SELECT user_status FROM module_master WHERE guid = $1';
        let queryParam = [GUID];
        let result = await psqlAPM.fnDbQuery('getModuleStatus-LinuxUnification',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            let status = result.rows[0].user_status;
            if(status.toLowerCase() == 'restart'){
                queryText = 'UPDATE module_master SET user_status = $1 WHERE guid = $2';
                queryParam = ['Running', GUID];
                let result = await psqlAPM.fnDbQuery('updateModuleStatus-LinuxUnification',queryText, queryParam, null, null);
            }
            res.json({success:true, failure:false, message: status});
        }else{
            res.json({success:true, failure:false, message: "Kill"});
        }
    }catch(e){
        logger.error('getModuleStatus',e.stack);
        res.json({success:false, failure:true, message: e.stack});
    }
}

async function createLinuxModule(req, res, data){
    let cmd;
    let queryText;
    let queryParam;
    let msg={};
    if(data.ModuleType=="SERVER"){
        cmd="cmd";
        queryText = 'INSERT INTO module_master (user_id, guid, module_code, counter_type_version_id, module_name, description, created_by, created_on, e_id, client_unique_id, system_id, module_type, type_version, user_status) VALUES ($1, uuid_generate_v4(), $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12) RETURNING uid, guid';
        queryParam = [data.userId, data.moduleType, 0, data.moduleName, data.moduleName, data.userId, data.enterprise_Id, data.UUID, data.systemId, data.moduleType, data.VERSION_ID, 'Running'];
    } else if(data.ModuleType=="DATABASE"){
        cmd="query";
        queryText = 'INSERT INTO module_master (user_id, guid, module_code, counter_type_version_id, module_name, description, created_by, created_on, e_id, client_unique_id, system_id, module_type, type_version, user_status, jmx_port) VALUES ($1, uuid_generate_v4(), $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12, $13) RETURNING uid, guid';
        queryParam = [data.userId, data.moduleType, 0, data.moduleName, data.moduleName, data.userId, data.enterprise_Id, data.UUID, data.systemId, data.moduleType, data.VERSION_ID, 'Running', data.jmx_port];
    }else{
        cmd="jvm";
        queryText = 'INSERT INTO module_master (user_id, guid, module_code, counter_type_version_id, module_name, description, created_by, created_on, e_id, client_unique_id, system_id, module_type, type_version, user_status, jmx_port) VALUES ($1, uuid_generate_v4(), $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12, $13) RETURNING uid, guid';
        queryParam = [data.userId, data.moduleType, 0, data.moduleName, data.moduleName, data.userId, data.enterprise_Id, data.UUID, data.systemId, data.moduleType, data.VERSION_ID, 'Running', data.jmx_port];
    }
    try{
        let result = await psqlAPM.fnDbQuery('createLinuxModule-LinuxUnification',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            msg = {
                message : 'successfully created linux module.',
                moduleGUID : result.rows[0].guid,
                moduleUID: result.rows[0].uid,
                moduleTypeName : data.moduleTypeName
            }
            let uid = result.rows[0].uid;
            let guid = result.rows[0].guid;
            console.log('Uid : ',uid,' GUID : ',guid);

            cmd = data.moduleTypeName.toLowerCase().includes('apache') ? 'http' : cmd;
            queryText = 'SELECT create_counter_table_partitionsV1($1, $2::json, $3, $4, $5, $6) ';
            queryParam = [uid, '{}', data.userId, guid, cmd, data.moduleTypeName];
            let resultCM = await psqlAPM.fnDbQuery('insCounterMasterTable-LinuxUnification',queryText, queryParam, null, null);
            if (resultCM.error){
                msg= {
                    moduleGUID : result.rows[0].guid,
                    moduleUID: result.rows[0].uid,
                    moduleTypeName : data.moduleTypeName,
                    message: "successfully created linux module; Error in creating counter table partition: " + resultCM.message
                }
            }
     
            queryText = 'SELECT * from insert_chart_visual_data($1, $2, $3, $4) ';
            queryParam = [uid, data.userId, data.moduleType, data.moduleName];
            let resultChart = await psqlAPM.fnDbQuery('insChartVisTable-LinuxUnification',queryText, queryParam, null, null);
            if (resultChart.error){
                msg = {
                    moduleGUID : result.rows[0].guid,
                    moduleUID: result.rows[0].uid,
                    moduleTypeName : data.moduleTypeName,
                    message: "successfully created linux module; Error in inserting data for chart visual: " + resultChart.message
                }
            }
        res.json({success:true, failure:false, message: msg});
        } else{
           res.json({success:false, failure:true, message: "Unable to insert Module Master table due to : "+result.message});
        }
    }   catch(e){
        //console.log("Error in createLinuxModule: ",e.stack)
        logger.error('Error in createLinuxModule: ',e.stack);
        res.json({success:false, failure:true, message: e.stack});
    }
}

async function getSystemInfo(req, res, param){
    try{
        let apd_uuid = req.body.UUID;
        console.log(apd_uuid);
        let queryText = 'select system_name, system_number, system_id, user_id from server_information WHERE apd_uuid = $1';
        let queryParam = [apd_uuid];
        let result = await psqlAPM.fnDbQuery('getSystemInfo-LinuxUnification',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            param.moduleName = result.rows[0].system_name+'_'+param.moduleTypeName;
            param.moduleDescription = result.rows[0].system_name+'_'+param.moduleTypeName;
            param.userId = result.rows[0].user_id;
        }else{
            res.json({success:false, failure:true, message: "System information could not be found in ServerInformation table, Contact System Admin."});
        }
    }catch(e){
        console.log("Error in getSystemInfo: ", e.stack);
        logger.error('Error in getSystemInfo: ',e.stack);
        res.json({success:false, failure:true, message: e.stack});
    }
}

async function createServerModule(req, res){
    try{
        let moduleTypeName;
        let serverInformation = JSON.parse(req.body.moduleInformation);
        
        if(serverInformation.PRETTY_NAME.toLowerCase().includes("amazon")){
            moduleTypeName = 'AMAZON_LINUX_TEST';
        }else if(serverInformation.PRETTY_NAME.toLowerCase().includes("centos")){
            moduleTypeName = 'CentOS';
        }else if(serverInformation.PRETTY_NAME.toLowerCase().includes("red hat")){
            moduleTypeName = 'RedHat';
        }else if(serverInformation.PRETTY_NAME.toLowerCase().includes("fedora")){
            moduleTypeName = 'Fedora';
        }else if(serverInformation.PRETTY_NAME.toLowerCase().includes("ubuntu")){
            moduleTypeName = 'Ubuntu';
        }else if(serverInformation.PRETTY_NAME.toLowerCase().includes("solaris")){
            moduleTypeName = 'Solaris';
        }

        let param = {
            joCounterSet : JSON.parse(req.body.jocounterSet),
            systemId : req.body.systemId,
            UUID : req.body.UUID,
            enterprise_Id : req.body.Enterprise_Id,
            moduleTypeName : moduleTypeName,
            moduleVersion : serverInformation.VERSION_ID,
            moduleType : 'SERVER'
        }

        let queryText = 'SELECT uid, guid from module_master WHERE system_id = $1 AND lower(module_type) = lower($2)';
        let queryParam = [param.systemId, moduleTypeName];
        let result = await psqlAPM.fnDbQuery('createServerModule-LinuxUnification',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            let msg = {
                message : 'successfully create module.',
                moduleGUID : result.rows[0].guid,
                moduleTypeName : moduleTypeName
            };
            res.json({success:true, failure:false, message: msg});
        }else{
            //need some clarfication from SK.
            await getSystemInfo(req, res, param);
            await createLinuxModule(req, res, param);
        }
    }catch(e){
        logger.error('Error in createServerModule: ',e.stack);
        res.json({success:false, failure:true, message: e.stack});
    }
}

async function linuxUnification(req, res){
    try{
        let command = req.body.command;
        switch(command){
            case 'systemGeneratorInfo':
                getSystemId(req, res);
                break;
            case 'moduleRunningStatus':
                getModuleStatus(req, res);
                break;
            case 'serverInformation':
                createServerModule(req, res);
                break;
            case 'appInformation':
                createApplicationModule(req,res);
                break;
            case 'DBInformation':
                createDatabaseModule(req,res);
                break;
            default:
                console.log('sorry, we are out of command..');
                res.json({success:false, failure:false, message: "sorry, could not create linux unified module due to invalid input for 'command' type.."});
                break;
        }
    }catch(e){
        logger.error('Error in linuxUnification: ',e.stack);
        res.json({success:false, failure:true, message: e.stack});
    }
}

async function getApacheBeatCounterId(req,res)
{
    try 
    {
        counterIds = [];
        let guid = req.body.guid

        let queryText = 'SELECT uid FROM module_master WHERE guid = $1';
        let queryParam = [guid];
        let result = await psqlAPM.fnDbQuery('getUID-ApacheBeatCounterId', queryText, queryParam, null, null);
        if(result.rowCount > 0){
            let uid = result.rows[0].uid;
            queryText = 'SELECT counter_id, category, counter_name from counter_master_'+uid+' order by 1';
            queryParam = [];
            let resCounterIds = await psqlAPM.fnDbQuery('getCounterIds-ApacheBeatCounterId', queryText, queryParam, null , null);
            if(resCounterIds.rowCount > 0){
                for(i=0;i<resCounterIds.rowCount;i++){
                    let counterId = resCounterIds.rows[i].counter_id;
                    let counterName = resCounterIds.rows[i].category +'-'+resCounterIds.rows[i].counter_name;
                    let counter_list = {
                        counterId : counterId,
                        counterName : counterName
                    }
                    counterIds[i] = counter_list;
                }
                res.send(counterIds);
            } else{
                res.send('cannot get counterIds');
            }
        }else{
            res.send('cannot get UID');
        }  

    }
catch(e){
    logger.error('Error in getApacheBeatCounterId: ',e.stack);
        res.send(e.stack);
}
}
async function getApacheBeatConfigCounters(req, res){
    try{
        let rtnCounters = [];
        let guid = req.body.guid;
        let queryText = 'SELECT uid FROM module_master WHERE guid = $1';
        let queryParam = [guid];
        let result = await psqlAPM.fnDbQuery('getUID-ApacheBeatCounters',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            let uid = result.rows[0].uid;
            queryText = 'SELECT counter_id, category, counter_name from counter_master_'+uid+' WHERE is_selected = true order by counter_id';
            queryParam = [];
            let resCounters = await psqlAPM.fnDbQuery('getCounters-ApacheBeatCounters',queryText, queryParam, null, null);
            if(resCounters.rowCount > 0){
                for(i=0;i<resCounters.rowCount;i++){
                    let category = resCounters.rows[i].category;
                    let counter_name = resCounters.rows[i].counter_name;
                    let couter_list = (category == 'status') ? 'apache.'+category+'.'+counter_name : 'apache.status.'+category+'.'+counter_name;
                    rtnCounters[i] = couter_list;
                }
                res.send(rtnCounters);
            }else{
                res.send('Unable to get config Counters');
            } 
        }else{
            res.send('Unable to get UID, Try again later.');
        }
    }catch(e){
        logger.error('Error in getApacheBeatConfigCounters: ',e.stack);
        res.send(e.stack);
    }
}

async function addApacheBeat(req, res){
    try{
        let rtnGUID, system_id, user_id;
        let query_param = {
            apd_uuid : req.body.apd_uuid,
            moduleName : req.body.moduleName,
            encryptedUserId : req.body.encryptedUserId,
            moduleTypeName : req.body.moduleTypeName,
            VERSION_ID : req.body.VERSION_ID,
            enterpriseId : req.body.enterpriseId,
            moduleType : 'APPLICATION'
        };
        let queryText = 'SELECT system_id, user_id FROM server_information WHERE apd_uuid = $1';
        let queryParam = [query_param.apd_uuid];
        let result = await psqlAPM.fnDbQuery('isApdUUIDExists-ApacheBeat',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            system_id = result.rows[0].system_id;
            user_id = result.rows[0].user_id;
            console.log('System_id : '+system_id);
            query_param.system_id = system_id;
            query_param.user_id = user_id;
            queryText = 'SELECT mm.GUID FROM module_master mm join server_information si on si.system_id=mm.system_id and si.user_id=mm.user_id WHERE si.system_id = $1 AND module_code = $2 AND lower(module_type) = lower($3) ';
            queryParam = [system_id, 'APPLICATION', 'apachebeat'];
            let result1 = await psqlAPM.fnDbQuery('GetModuleGUID-ApacheBeat',queryText, queryParam, null, null);
            if(result1.rowCount > 0){
                console.log(result1);
                rtnGUID = result1.rows[0].guid;
                res.send(rtnGUID);
            }else{
                insertApacheBeat(query_param, req, res);
            }
        }else{
            res.send('System Id not found in our system');
        }
    }catch(e){
        logger.error(process.pid,e.stack);
        res.send(e.stack);
    }
}

async function insertApacheBeat(param, req, res){
    try{
        console.log(param);
        let queryText = 'INSERT INTO module_master (user_id, guid, module_code, counter_type_version_id, module_name, description, created_by, created_on, e_id, client_unique_id, system_id, module_type, type_version, user_status) VALUES ($1, uuid_generate_v4(), $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12) RETURNING uid, guid';
        let queryParam = [param.user_id, 'APPLICATION', 0, param.moduleName, param.moduleName, param.user_id, param.enterpriseId, param.apd_uuid, param.system_id, param.moduleTypeName, param.VERSION_ID, 'Running'];
        let result = await psqlAPM.fnDbQuery('insModuleMaster-ApacheBeat',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            let uid = result.rows[0].uid;
            let guid = result.rows[0].guid;
            
            queryText = 'SELECT create_counter_table_partitionsV1($1, $2::json, $3, $4, $5, $6) ';
            queryParam = [uid, '{}', param.user_id, guid, 'beat', param.moduleTypeName];
            let resultCM = await psqlAPM.fnDbQuery('insCounterMasterTable-ApacheBeat',queryText, queryParam, null, null);

            queryText = 'SELECT * from insert_chart_visual_data($1, $2, $3, $4) ';
            queryParam = [uid, param.user_id, param.moduleType, param.moduleName];
            let resultChart = await psqlAPM.fnDbQuery('insChartVisTable-ApacheBeat',queryText, queryParam, null, null);

            res.send(guid)
        }else{
            res.send('Unable to insert Module Master table.');
        }
        
    }catch(e){
        logger.error('insertApacheBeat :',e.stack);
        res.send(e.stack);
    }
}

async function getModuleIdIfExists(param){
    try{
        let mod_info=JSON.parse(param.appInformation);
        let sys_id=param.systemId;
        let qryText;
        let qryParam=[];
        let context_name;
        let module_type;
        let joModuleData={};
        let jmx_port=mod_info.hasOwnProperty('jmx_port')?mod_info.jmx_port:null;
        mod_info.moduleTypeName.toLowerCase()=='jboss'?(context_name=false, module_type=mod_info.moduleTypeName):(context_name=true, module_type=mod_info.moduleName);
        qryText = "SELECT uid, guid from module_master where system_id = $1 "
        qryParam = [sys_id];
        if(!context_name){
        qryText+= " AND module_type = $2"
        } else {
        qryText+=" AND application_context_name = $2"
        }
        qryParam[qryParam.length]=module_type
        if(jmx_port!=null){
            qryText+=" AND jmx_port = $3"
            qryParam[qryParam.length]=jmx_port;
        }
        //console.log(qryText,qryParam);
        let result = await psqlAPM.fnDbQuery('getUidGuid-createApplicationModule',qryText, qryParam, null, null);
        if(result.rowCount > 0){
            joModuleData.lModuleId=result.rows[0].uid;
            joModuleData.moduleGUID=result.rows[0].guid;
            joModuleData.isExistsGUID=true
        }else{
            joModuleData.isExistsGUID=false;        
        }
        return joModuleData;
    }catch(e){
        logger.error('Error in getModuleIdIfExists method: ',e.stack);
    }
}

async function createApplicationModule(req, res){
    try{
        let param = {
            appInformation : req.body.moduleInformation,
            moduleTypeName : JSON.parse(param.appInformation).moduleTypeName,
            joCounterSet : req.body.jocounterSet,
            systemId : req.body.systemId,
            UUID : req.body.UUID,
            Enterprise_Id : req.body.Enterprise_Id,
            moduleType:"APPLICATION"
        };
        let jmxPort=param.jmx_port=JSON.parse(param.appInformation).hasOwnProperty('jmx_port')?JSON.parse(param.appInformation).jmx_port:null;
        let modDetails=await getModuleIdIfExists(param);
        if(!modDetails.isExistsGUID){
            await getSystemInfo(req,res,param);
            param.moduleDescription=(jmxPort==null?param.appInformation.moduleName:param.appInformation.moduleName+"::"+jmxPort);
            await createLinuxModule(req, res, param);
        }else{
            res.send("Application module already exists with GUID: ",modDetails.moduleGUID);
        }
    } catch(e){
        logger.debug("Error creating application module: ", e.stack);
        res.send({success:false, failure:true, message: "Error creating application module: "+e.stack});
    }
}

async function createDatabaseModule(req, res){
    try{
        let param = {
            appInformation: req.body.moduleInformation,
            //joCounterSet: req.body.jocounterSet,
            systemId: req.body.systemId,
            UUID: req.body.UUID,
            Enterprise_Id: req.body.Enterprise_Id,
            moduleType: "DATABASE"
        };
        let jmxPort=param.jmx_port=JSON.parse(param.appInformation).hasOwnProperty('jmx_port')?JSON.parse(param.appInformation).jmx_port:null;
        let modDetails = await getModuleIdIfExists(param);
        if(!modDetails.isExistsGUID){
            await getSystemInfo(req,res,param);
            param.moduleDescription=(jmxPort==null?param.appInformation.moduleName:param.appInformation.moduleName+"::"+jmxPort);
            await createLinuxModule(req,res,param);
        }else{
            res.send("Database module already exists with GUID: ",modDetails.moduleGUID);
        }
    }catch(e){
        logger.debug("Error creating database module: ", e.stack);
        res.send({success:false, failure:true, message: "Error creating application module: "+e.stack});
    }
}

async function isApdUUIDExists(apdgenuuid, param){
    let qryText = "SELECT system_id FROM server_information WHERE apd_uuid = $1;";
    let qryParam = [apdgenuuid];
    try{
        let result = await psqlAPM.fnDbQuery('isApdUUIDExists-addLogNetworkMonitor: ',qryText, qryParam, null, null);
        if(result.rowCount > 0){
            param.sysId=result.row[0].system_id;
        } else{
            param.sysId=0;
        }
    }catch(e){
        logger.debug("Error checking isApdUUIDExists: ", e.stack);
    }
}


async function addLogMonitor(req, res){
    try{
        let param={
            moduleName: req.body.moduleName,
            apdGenUUID: req.body.apd_uuid,
            clientUniqueId: req.body.client_unique_id,
            encryptedUserId: req.body.encryptedUserId,
            description: req.body.description,
            enterpriseId: req.body.enterpriseId == null? "0":req.query.enterpriseId,
            moduleType: "LOG"
        }
        let loginUserDtl={};
        let serviceMapDtl={};
        let apdgenuuid=param.apdGenUUID;
        await isApdUUIDExists(apdgenuuid, param);
        let lSystemId=param.sysId;
        if(lSystemId > 0){
            await isModuleExists(param,param.moduleType);
            let bExist = param.usrMappingExists;
            if(bExist){
                await getGUID(param,param.moduleType);
                if(param.GUID == ""){
                    await getNameFromUUID(param);
                    strGuid = "UUID mapped with another USER, Please contact System Admin / "+param.strUserName;
                    param.GUID=strGuid;
                }
            }else{
                let curdatetime=new Date().toISOString().slice(0,19);
                curdatetime=curdatetime.replace('T','_').replace(':','').replace('-','');
                strModuleName = "LOG_MONITOR_"+curdatetime;
                if(param.moduleName.length()==0){
                    param.moduleName=strModuleName;
                }
                param.agentVersionId=-1;
                await addLogOrNetWorkMonitor(param);
                await getUserIdFromServerInfo(param,loginUserDtl);
                await mapModuleToSystemServiceMap(req,res,param,loginUserDtl,serviceMapDtl);
                await insertServiceMapDetails(req,res,serviceMapDtl,loginUserDtl);
                }
            }
        else{
            strGuid = "System Id not found in our system";
            param.Guid=strGuid;
        }
    }catch(e){
        logger.debug("There was an error while trying to addLogMonitor: ", e.stack);
    }
}

async function addNetworkMonitor(req,res){
    try{
        let param={
            moduleName: req.body.moduleName,
            apdGenUUID: req.body.apd_uuid,
            clientUniqueId: req.body.client_unique_id,
            encryptedUserId: req.body.encryptedUserId,
            description: req.body.description,
            enterpriseId: req.body.enterpriseId == null? "0":req.query.enterpriseId,
            moduleType: "NETWORK"
        }
        let loginUserDtl={};
        let serviceMapDtl={};
        let apdgenuuid=param.apdGenUUID;
        await isApdUUIDExists(apdgenuuid, param);
        let lSystemId=param.sysId;
        if(lSystemId > 0){
            await isModuleExists(param,param.moduleType);
            let bExist = param.usrMappingExists;
            if(bExist){
                await getGUID(param,param.moduleType);
                if(param.GUID == ""){
                    await getNameFromUUID(param);
                    strGuid = "UUID mapped with another USER, Please contact System Admin / "+param.strUserName;
                    param.GUID=strGuid;
                }
            }else{
                let curdatetime=new Date().toISOString().slice(0,19);
                curdatetime=curdatetime.replace('T','_').replace(':','').replace('-','');
                strModuleName = "NETWORK_MONITOR_"+curdatetime;
                if(param.moduleName.length()==0){
                    param.moduleName=strModuleName;
                }
                param.agentVersionId=-1;
                await addLogOrNetWorkMonitor(param);
                await getUserIdFromServerInfo(param,loginUserDtl);
                await mapModuleToSystemServiceMap(req,res,param,loginUserDtl,serviceMapDtl);
                await insertServiceMapDetails(req,res,serviceMapDtl,loginUserDtl);
                }
            }
        else{
            strGuid = "System Id not found in our system";
            param.Guid=strGuid;
        }
    }catch(e){
        logger.debug("There was an error while trying to addLogMonitor: ", e.stack);
    }
}

async function insertServiceMapDetails(req,res,servicemapdtl,loginusrdtl){
    let joMappedModule={};
    let result;
    try{
        for(i=0;i<servicemapdtl.keys(myObject).length;i++){
            joMappedModule=servicemapdtl[i];
            qryText="INSERT INTO service_map_details (service_map_id, mapped_service) VALUES ($1, $2::json)";
            qryParam=[joMappedModule.serviceMapId,joMappedModule.serviceMapDetails];
            result = await psqlAPM.fnDbQuery('insertServiceMapDetails-addNetworkMonitor',qryText, qryParam, null, null);
        }
        res.json({success:true,error:false,result:result});
    }catch(e){
        res.json({success:false,error:e.stack,message:"There was an error while insertServiceMapDetails"});
    }
}

async function mapModuleToSystemServiceMap(req,res,param,loginusrdtl,servicemapdtl){
    let joModule ={"module_master":"module_code: "+param.moduleType,"uid":param.moduleId}
    qryText="SELECT service_map_id FROM service_map WHERE user_id = $1 AND is_system = TRUE ";
    qryParam=[loginusrdtl.userId];
    try{
        let result = await psqlAPM.fnDbQuery('mapModuleToSystemServiceMap-addNetworkMonitor',qryText, qryParam, null, null);
        if(result.rowCount > 1){
            res.json({success:true, error:false, message:"More than 1 row were returned"});
        } else if(result.rowCount == 1){
            res.json({success:true, error:false, message:"1 row was returned"});
        }
        servicemapdtl.serviceMapId=result.row[0].service_map_id;
        servicemapdtl.serviceMapDetails=joModule;        
    }catch(e){
        res.json({success:false, error:e.stack, message:"There was an error while trying to mapModuleToSystemServiceMap"});
    }
}

async function addLogOrNetWorkMonitor(param){
    qryText="INSERT INTO module_master (user_id, guid, module_code, module_type, counter_type_version_id, module_name, description, e_id, client_unique_id, system_id, created_by, created_on) "
            .append(" SELECT si.user_id, uuid_generate_v4(), $1, $2, $3, $4, si.manufacturer||' | '||si.system_name||' | '||si.system_number, ")
            .append(" $5, si.system_uuid, si.system_id, si.user_id, now() from server_information si where si.system_id = $7 returning uid" );
    qryParam=[param.ModuleType, param.ModuleType, param.AgentVersionId, param.moduleName, param.enterpriseId>0?param.enterpriseId:null,param.systemId];
    try{
        let result = await psqlAPM.fnDbQuery('addLogOrNetWorkMonitor-addLogMonitor',qryText, qryParam, null, null);
        if(!result.rowCount==1){
            param.moduleId="";
            logger.debug("Could not insert log monitor..");
        }else{
            param.moduleId=result.rows[0].uid;
        }
    }catch(e){
        logger.debug("There was an error while trying to addLogOrNetWorkMonitor: ",e.stack);
    }   
}

async function getUserIdFromServerInfo(param,loginUsrDtl){
    qryText="SELECT user_id FROM server_information WHERE system_id = $1";
    qryParam=[param.sysId];
    try{
        let result = await psqlAPM.fnDbQuery('getUserIdFromServerInfo-addLogMonitor',qryText, qryParam, null, null);
        if(result.rowCount > 0){
            loginUsrDtl.userId=result.row[0].user_id;
        }else{
            loginUsrDtl.userId=0;
            logger.debug("Could not get user id from serverInfo database...")
        }
    }catch(e){
        logger.debug("There was an error while trying to getUserIdFromServerInfo: ",e.stack);
    }
}


async function getNameFromUUID(param){
    let qryText="select first_name, last_name from usermaster where user_id = (select user_id from server_information where apd_uuid = $1";
    let qryParam=[param.apdUUID];
    let strUserName="";
    try{
        let result = await psqlAPM.fnDbQuery('getNameFromUUID-addLogMonitor',qryText, qryParam, null, null);
        if(result.rowCount > 0){
            param.strUserName=result.row[0].first_name+" "+result.row[0].last_name;
        }
    }catch(e){
        logger.debug("Error checking getNameFromUUID: ", e.stack);;
    }
}

async function isModuleExists(param,strmodulecode){
    let qryText="SELECT EXISTS (SELECT 1 FROM module_master WHERE system_id = $1 AND module_code = $2) AS is_system_id_exists";
    let qryParam=[param.sysId, strmodulecode];
    let usrMappingExists=false;
    try{
        let result = await psqlAPM.fnDbQuery('isModuleExists-addLogNetworkMonitor',qryText, qryParam, null, null);
        if(result.rowCount > 0){
            param.usrMappingExists=result.row[0].is_system_id_exists;
        }
    }catch(e){
        logger.debug("Error checking isModuleExists: ", e.stack);
    }
}

async function getGUID(param, strmodulecode){
    qryText="SELECT mm.GUID FROM module_master mm join server_information si on si.system_id=mm.system_id and si.user_id=mm.user_id WHERE si.system_id = $1 AND module_code = $2";
    qryParam=[param.sysId, strmodulecode];
    let strGUID="";
    try{
        let result = await psqlAPM.fnDbQuery('getGUID-addLogNetworkMonitor',qryText, qryParam, null, null);
        if(result.rowCount > 0){
            param.GUID=result.row[0].GUID;
        }else{
            param.GUID="";
        }
    }catch(e){
        logger.debug("Error checking getGUID: ", e.stack);
    }
}


router.post('/apm/addApacheBeat', async (req, res) => {
    console.log('inside the insert Apache Beat fun...')
    addApacheBeat(req, res);  
});

router.post('/apm/javaUnification', async (req, res) => {
    linuxUnification(req, res); 
});

router.post('/apm/getApacheBeatCounterId', async (req, res) => {
    console.log('getting the counter Ids list.')
    getApacheBeatCounterId(req, res);  
});

router.post('/apm/getApacheBeatConfigCounters', async (req, res) => {
    console.log('inside the getting Apache Beat config counters fun...')
    getApacheBeatConfigCounters(req, res);  
});

router.post('/log/addLogMonitor',async(req,res)=>{
    console.log('inside the add log monitor fun...')
    addLogMonitor(req,res);
});

router.post('/log/addNetworkMonitor',async(req,res)=>{
    console.log('inside the add network monitor fun...')
    addNetworkMonitor(req,res);
});

router.post('/registerAVL',async(req,res) => {
    let data = req.body;
    let queryText = "SELECT agent_id,last_received_url_cnt FROM avm_agent_master WHERE guid=$1"
    let queryParam = [data.guid];
    let result = await psqlAPM.fnDbQuery('registerAVL-Select',queryText, queryParam, null, null);
    if (result.rowCount == 0){
        queryText = "INSERT INTO avm_agent_master(user_id,is_private,ip_address,country,state,city,region, zone, latitude,longitude, os_type,operating_system, os_version,agent_version, status, created_by, created_on, guid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING agent_id";
        queryParam = [data.user_id,data.is_private,data.ip_address,data.country,data.state,data.city,data.region, data.zone, data.latitude,data.longitude, data.os_type,data.operating_system, data.os_version,data.agent_version, data.status, data.created_by, data.created_on, data.guid];
        let result1 = await psqlAPM.fnDbQuery('registerAVL-Insert',queryText, queryParam, null, null);
        if (result1.success){
            res.json({success:true,message:"AVM Agent registered "+result1.rows[0].agent_id, agentId: result1.rows[0].agent_id, urlCnt:0});
        } else {
            res.json({success:false,message:"AVM Agent could not be registered"});
        }
    } else {
        res.json({success:true,message:"AVM Agent already registered with id "+result.rows[0].agent_id+" total url processed till now "+result.rows[0].last_received_url_cnt, agentId:result.rows[0].agent_id, urlCnt:result.rows[0].last_received_url_cnt});
    }
});

async function avmHeartBeat(data){
    let queryText = "INSERT INTO avm_heartbeat_log(agent_id,location,appedo_received_on, ip_address, latitude, longitude) VALUES($1,$2,now(),$3, $4, $5)";
    let queryParam = [data.agentId, data.location, data.ipAddress, data.latitude, data.longitude];
    let result = await psqlAPM.fnDbQuery("avmHeartBeat",queryText, queryParam, null, null);
    if (result.success){
        logger.info("Successfully inserted the AVM heartbeat status",data.agentId)        
    } else {
        logger.error("Failed to insert the AVM heartbeat status",JSON.stringify(data));
    }
}

router.post('/updateAVMAgentStatus',async(req,res) => {
    avmHeartBeat(req.body);
    let data = req.body;
    let queryText = "UPDATE avm_agent_master SET last_requested_on=$1, last_received_url_cnt=$2, last_responded_on=$3,last_error_on=$4, modified_on=now(), modified_by=1 WHERE agent_id=$5";
    let queryParam = [data.last_requested_on, data.last_received_url_cnt,data.last_responded_on,data.last_error_on,data.agentId];
    let result = await psqlAPM.fnDbQuery('updateAVMAgentStatus',queryText, queryParam, null, null);
    if (result.success){
        res.json({success:true,message:"Successfully updated the agent status"});
    } else {
        res.json({success:false ,message:"Error updating the agent status"});
    }
});

