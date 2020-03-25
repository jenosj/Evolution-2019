const Router = require('express-promise-router')
const psqlAPM = require('./psqlAPM');
const settings = require('../config/apd_constants');
global.avmScheduleLogger = require('../log');
// const locationQueue = new Queue();
function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}};

// it allows you to use async functions as route handlers
const router = new Router()

// export our router to be mounted by the parent application
module.exports = router;
avmScheduleLogger.info('AVM Scheduler running mode is :',settings.avmSchedulerRunningMode);
avmScheduleLogger.info('AVM Scheduler in Debug mode :',settings.avmSchedulerDebug);

let updateAVMSchedule = false;
let testHandler = [];
let testHandlerNameArr = [];
let locationWiseQueue = [];
let locationNameColl = [];
let testLoggerArr = {};
startAVMSchedulerService();

function startAVMSchedulerService() {
    if(settings.avmSchedulerRunningMode){
        getAvmSchedule();
    } else {
        avmScheduleLogger.info("AVM scheduler is in stopped state");
    }
};

//write location wise queue status once in an hour to the log
setInterval(()=>{
    if (!settings.avmSchedulerRunningMode) return;
    locationNameColl.map(location => {
        avmScheduleLogger.info(location, "No. of Pending test", locationWiseQueue[location].getLength());
    });
},60*60*1000)

/*updateAVMSchedule is updated to true if there is any update to the AVM test happened. 
* if happens, AVM scheduler will get reset and fetch the fresh data from the Table.
*/
setInterval(() => {
    if (!settings.avmSchedulerRunningMode) return;
    if (updateAVMSchedule){
        updateAVMSchedule = false;
        if (settings.avmSchedulerDebug){
            avmScheduleLogger.info("Scheduler reset command received and getting the new schedule");
        }
        getAvmSchedule();
    }
}, 60000);
/*
The below code is remove the test from queue if agent is not found and queue is piling up. Beyond 50 test, this will get triggered. all test that are scheduled 5 min before are removed from the queue.
*/
setInterval(() => {
    if (!settings.avmSchedulerRunningMode) return;
    locationNameColl.map(location => {
        let queryText = '';
        let cnt = 0;
        let queueLength = locationWiseQueue[location].getLength();
        for (let i = 0; i < queueLength; i++){
            let test = locationWiseQueue[location].dequeue();
            try{
                test = JSON.parse(test);
            } catch {
                //do nothing
            }
            if (new Date(test.scheduledTime).getTime() < new Date().getTime()-5*60*1000){
                avmScheduleLogger.info(location, " not found. waited for 5 min in queue, could not run this test " ,test.avm_test_id, "Scheduled Time :",test.scheduledTime);
                cnt++;
                if(settings.noLocationDBUpdate){
                    let loc = location.split('#');
                    queryText += "INSERT INTO log_avm_"+test.avm_test_id+"(avm_test_id, appedo_received_on, country, state, city, region, zone, success,err_code, err_msg, errno, agent_tested_on, resp_body, status_text) VALUES ("+test.avm_test_id+",'"+new Date().toISOString()+"','"+loc[0]+"','"+loc[1]+"','"+loc[2]+"','"+loc[3]+"','"+loc[4]+"',"+false+",'LocationNotFound','"+location+" Not Found','LocationNotFound','"+new Date().toISOString()+"','Could not run the test as "+location+" is not available at "+test.scheduledTime+"','No Location');";
                } 
            } else {
                locationWiseQueue[location].enqueue(JSON.stringify(test));
            }
        }
        avmScheduleLogger.info(location,cnt,"out of",queueLength,"are deQueued, queryText length is", queryText.length)
        if (!settings.noLocationDBUpdate){
            avmScheduleLogger.info(location, "noLocationDBUpdate is set to false, hence not updated the DB for the dequeued AVM test");
        } else {
            if (queryText.length > 0 ){
                // console.log(queryText);
                deQueueLocationQueue(queryText);
            }
        }
    });
}, 5*60*1000);

async function deQueueLocationQueue(queryText) {
    if (!settings.avmSchedulerRunningMode) return;
    let result = await psqlAPM.fnDbQuery("DeQueueLocationQueue", queryText, [], null, null);
    if (result.success) {
        avmScheduleLogger.info("deQueueLocationQueue, successfully updated the DB for location not found");
    }
    else {
        avmScheduleLogger.error("deQueueLocationQueue, Failed to update the DB for the location not found", result.message, queryText);
    }
}

async function getAvmSchedule(){
    if (!settings.avmSchedulerRunningMode) return;
    try{
        if (testHandlerNameArr.length>0){
            avmScheduleLogger.info(testHandlerNameArr.length+" previously Scheduled handlers are cleared.")
            testHandlerNameArr.map(handler =>{
                avmScheduleLogger.info(handler," scheduler handler cleared");
                clearInterval(testHandler[handler]);
            })
        }
        testLoggerArr = {};
        let dt = new Date().getTime();
        let queryText = "SELECT atm.avm_test_id, atm.testname,atm.testurl, atm.start_date, atm.end_date, atm.frequency, atm.start_time, atm.end_time, atm.request_method, atm.request_headers,atm.request_parameters, atm.request_body, atm.authorize_type, atm.authorize_param, atm.variables, m.country, m.state, m.city, m.region, m.zone,m.t_a_m_id as agent_id, atm.user_id, atm.guid FROM avm_test_master atm JOIN avm_test_agent_mapping m ON atm.avm_test_id = m.avm_test_id WHERE atm.end_date >= $1 AND atm.is_active = true AND atm.is_delete = false;";
        let queryParam = [dt];
        let result = await psqlAPM.fnDbQuery('getAvmSchedule',queryText, queryParam, null, null);
        if(result.rowCount > 0){
            if (settings.avmSchedulerDebug){
                avmScheduleLogger.info("Details of the test", JSON.stringify(result));
                avmScheduleLogger.info("Total no. of Test to be scheduled",result.rowCount);
            } else {
                avmScheduleLogger.info(result.rowCount, ' are going to be scheduled');
            }
            createLocationArr(result.rows);
        } else{
            avmScheduleLogger.info(process.pid,"There is no scheduled AVM test.");
        }
    } catch(e){
        avmScheduleLogger.error("getAvmSchedule",e.message, e.stack);
        avmScheduleLogger.error("getAvmSchedule failed and will be checked again after 10 seconds")
        setTimeout(() => {
            getAvmSchedule();
        }, 10000);
    }
};

function scheduleTest(data){
    try {
        data.map(test => {
            testHandlerNameArr.push('id' + test.avm_test_id);
            testLoggerArr['id' + test.avm_test_id] = 0;
            testHandler['id'+test.avm_test_id] = setInterval(()=>{
                scheduleTestTimer(test);
            }, test.frequency*60*1000);
        });
        avmScheduleLogger.info(data.length, "AVM test scheduled. Schedule Handlers are created for each test");
    } catch (e) {
        avmScheduleLogger.error("scheduleTest() failed with exception",e.message,e.stack);
    }
}

function scheduleTestTimer(test) {
    try {
        let dt = new Date().getTime();
        let locationM = test.country + '#' + test.state + '#' + test.city + '#' + test.region + '#' + test.zone;
        if (test.end_date >= dt && Number(test.start_date) <= dt) {
            test["scheduledTime"] = new Date().toISOString();
            locationWiseQueue[locationM].enqueue(JSON.stringify(test));
            avmScheduleLogger.info("AVM Test Id", test.avm_test_id, "added to queue. Current Queue Length", locationWiseQueue[locationM].getLength(), "in location", locationM, "frequency ", test.frequency, " minutes");
        }
        else if (test.end_date < dt) {
            avmScheduleLogger.info("AVM Test Id", test.avm_test_id, " is finished its run. Test end datetime is ", new Date(Number(test.end_date)).toLocaleString());
            clearInterval(testHandler['id' + test.avm_test_id]);
            testHandlerNameArr.splice(testHandlerNameArr.indexOf('id'+test.avm_test_id),1);
        }
        else {
            // to ensure log happens only once 
            if (testLoggerArr['id' + test.avm_test_id] == 0){
                avmScheduleLogger.info("AVM Test Id", test.avm_test_id, " is skipped to queue as start time is in future " + new Date(Number(test.start_date)).toLocaleString());
                testLoggerArr['id' + test.avm_test_id] = 1;
            }
        }
    }
    catch (e) {
        avmScheduleLogger.error("Could not schedule test for test id ", test.avm_test_id, test.testname, "Exception", e.message, e.stack);
    }
}

function createLocationArr(data){
    try {
        data.map(loc => {
            location = loc.country+'#'+loc.state+'#'+loc.city+'#'+loc.region+'#'+loc.zone;
            if (locationNameColl.indexOf(location) == -1){
                locationNameColl.push(location);
                locationWiseQueue[location] = new Queue();
            } else {
                avmScheduleLogger.info(location, "already exists continuing with same queue");
            }
        });
        avmScheduleLogger.info(locationNameColl.join()," Queue created for these locations and ready to receive test.");
        scheduleTest(data);
    } catch (e) {
        avmScheduleLogger.error("createLocationArr", e.message, e.stack);
    }
}

router.get('/updAVMAgents', async(req,res)=>{
    try {
        if (!settings.avmSchedulerRunningMode) {
            updateAVMSchedule = false;
        } else {
            avmScheduleLogger.info("UpdateAVMSchedule received");
            updateAVMSchedule = true;
        }
        counter = 0;
        res.json({success:true, message:"AVM Test update command received"});
    } catch (e) {
      logger.error(process.pid,e.stack);
      res.json({success:false, error:true, message: e.stack});
    }
})
  
router.post('/getAVMTest', async(req,res)=>{
    try {
        if (!settings.avmSchedulerRunningMode) {
         test = {success:false, message:"AVM Scheduler not running"};
        } else {
            let param = req.body;
            let test;
            if (locationWiseQueue[param.location] != undefined){
                if (locationWiseQueue[param.location].getLength() > 0)
                {
                    test = {success:true, result:JSON.parse(locationWiseQueue[param.location].dequeue())};
                    avmScheduleLogger.info(new Date().toLocaleString(), 'AVMScheduler', param.location, "queueLength", locationWiseQueue[param.location].getLength());
                }
                else {
                    let res = {avm_test_id: 'nopendingtest'};
                    test = {success:false, result:res};
                }
            } else {
                let res = {avm_test_id: 'nopendingtest'};
                test = {success:false, result:res};
            }
        }
        res.json(test);
    } catch (e) {
      logger.error(process.pid,e.stack);
      res.json({success:false, error:true, message: e.stack});
    }
})
