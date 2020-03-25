const Router = require('express-promise-router')
const psqlAPM = require('./psqlAPM');
const PgConfig = require('../config/apd_constants');
const appedoMailer = require('./appedoMailer');
const pgCustom = require('./psqlCustom');
const { Parser } = require('json2csv');
const json2csvParser = new Parser();
const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
global.reportLogger = require('../log');

// it allows you to use async functions as route handlers
const router = new Router()

// export our router to be mounted by the parent application
module.exports = router;
module.exports.startReportService = startReportService;


SCHEDULER_SERVICE_INTERVAL_MS = 1000 * 60 * 60; // 10 Minutes
//PgConfig.ReportSchedulerRunningMode ? setInterval(startReportService, SCHEDULER_SERVICE_INTERVAL_MS) : '';
PgConfig.ReportSchedulerRunningMode ? appedoMailer.loadMailTemplate() : '';
let EMAIL_ATTACHMENT_PATH = PgConfig.resourcePath+PgConfig.attachementPath;
reportLogger.info('Report Scheduler running mode is :',PgConfig.ReportSchedulerRunningMode);

SCHEDULER_SERVICE_START_TIME_MS = (60*60*1000) - (new Date().getTime()%(60*60*1000));

var start_interval = setInterval(startReportService, SCHEDULER_SERVICE_START_TIME_MS);

function startReportService() {
    if(PgConfig.ReportSchedulerRunningMode){
        setInterval(reportSchedulerTimerStart, SCHEDULER_SERVICE_INTERVAL_MS);
        reportSchedulerTimerStart();
    }
    clearInterval(start_interval);
};

async function reportSchedulerTimerStart(){
    try{
        let query_text = "select id, connector_id, query_text, created_by, is_scheduled, frequency, email_arr, enable_scheduler, report_title, report_description, send_as_attachment, last_email_sent_on, is_success, time_offset from custom_chart_queries where is_scheduled AND enable_scheduler AND (CASE WHEN last_email_sent_on IS NULL THEN true WHEN lower(frequency) = 'hourly' THEN last_email_sent_on + interval '1 hour' <= now() WHEN lower(frequency) = 'daily' THEN last_email_sent_on + interval '1 day' <= now() WHEN lower(frequency) = 'weekly' THEN last_email_sent_on + interval '7 day' <= now() WHEN lower(frequency) = 'fortnightly' THEN last_email_sent_on + interval '14 day' <= now() WHEN lower(frequency) = 'monthly' THEN last_email_sent_on + interval '1 month' <= now() WHEN lower(frequency) = 'quarterly' THEN last_email_sent_on + interval '3 month' <= now() WHEN lower(frequency) = 'halfyearly' THEN last_email_sent_on + interval '6 month' <= now() WHEN lower(frequency) = 'yearly' THEN last_email_sent_on + interval '12 month' <= now() END)";
        let queryParam = [];
        let result = await psqlAPM.fnDbQuery('reportScheduler-TimerStart',query_text, queryParam, null, null);
        if(result.rowCount > 0){
            await executeReport(result.rows);
        }else{
            reportLogger.info(process.pid,"There is now no new reports available.");
        }
    }catch(e){
        reportLogger.error(process.pid,e.stack);
    }
};

async function executeReport(reports){
    try{
        let mailBody; 
        let reportData = {};
        for(let j=0;j<reports.length;j++) {
            let report = reports[j];
            let DbConnectionString = await getDBConnectorForDbId(report.connector_id);
            report.connectionString = DbConnectionString.connection_details;
            let queryRst = await runQuery(report);
            if(queryRst.length != 0){
                if(report.send_as_attachment){
                    await CreateCsv(report.id, queryRst);
                    report.attachment_detail = {filename: report.report_description+'.csv', path: EMAIL_ATTACHMENT_PATH+'report_'+report.id+'.csv'};
                }else{
                    mailBody = await mailBodyContent(report.report_description, queryRst);
                    report.mailBody = mailBody;
                }
                reportData[report.id] = report;
                reports[j].qry_rst = true;
            }else{
                reportLogger.info(process.pid,"There is no query result in this report-id :", report.id);
                reports[j].qry_rst = false;
            }
        }
        let MailReport = await createMailWiseRportId(reports);

        if(Object.keys(MailReport).length != 0 && Object.keys(reportData).length != 0){
            await sendMailWiseRports(MailReport, reportData);
        }else{
            Object.keys(MailReport).length == 0 ? reportLogger.info(process.pid,"There is no Email-ID in current reports") : '';
        }

    }catch(e){
        reportLogger.error(process.pid,e.stack);
    }
}

async function getDBConnectorForDbId(dbId){
    let rst;
    try{
        const query_text = "SELECT db.db_id, db.connector_name, db.engine_name, db.connection_details, db.user_name, db.password, EXTRACT(EPOCH FROM db.created_on)*1000 as created_on, db.modified_on FROM db_connector_details db WHERE db.db_id = $1"
        const queryParam = [dbId];
        let result = await psqlAPM.fnDbQuery('getDBConnectorForDbId',query_text, queryParam, null, null)
          if (result.rowCount > 0){
            rst = result.rows[0]
          } else {
            rst = 'No rows return';
          }
    } catch (e) {
        reportLogger.error(process.pid,e.stack);
    } finally {
        return rst;
    }
}

async function runQuery(queryParam){
    let rst;
    try{
        let updated_endData;
        let epochTime;

        if(queryParam.frequency.toLowerCase() == 'hourly'){
            epochTime = new Date().getTime() - (new Date().getTime()%(60*60*1000));
        }else{
            epochTime = new Date().getTime() - (new Date().getTime()%(24*60*60*1000));
        }

        updated_endData = new Date(epochTime-1);
        queryParam.updated_email_sent_on = updated_endData;

        if(queryParam.query_text.includes('@startDate') && queryParam.query_text.includes('@endDate@')){
          //let endDate = new Date().toISOString();
          let endDate = updated_endData.toISOString(); 
          let startDate = new Date(new Date().getTime()-60*60*1000).toISOString();
          queryParam.query_text = queryParam.query_text.replace('@startDate@',startDate).replace('@endDate@',endDate);
        } else if(queryParam.query_text.includes('@startDay@')){
          let today = new Date();
          let startDay = new Date(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + queryParam.time_offset).toISOString();
          queryParam.query_text = queryParam.query_text.replace('@startDay@',startDay).replace('@endDay@',today.toISOString());
        } else if(queryParam.query_text.includes('@startWeek@')){
          let stWeekDate = startOfWeek(new Date());
          let startWeek = new Date(stWeekDate.getTime() + queryParam.time_offset).toISOString();
          queryParam.query_text = queryParam.query_text.replace('@startWeek@',startWeek).replace('@endWeek@',new Date().toISOString());
        } else if(queryParam.query_text.includes('@startMonth@')){
          let dt = new Date();
          let stMonth = new Date(dt.getFullYear(), dt.getMonth());
          let startMonth = new Date(stMonth.getTime() + queryParam.time_offset).toISOString();
          queryParam.query_text = queryParam.query_text.replace('@startMonth@',startMonth).replace('@endMonth@',new Date().toISOString());
        }
    
        let result = await pgCustom.fnDbQuery('runQuery-reportScheduler',queryParam.connectionString, queryParam.query_text, [], null, null);
        if (result.success){
            rst = result.rows;
        }
    } catch (e) {
        reportLogger.error(process.pid,e.stack);
    }finally {
        return rst;
    }
};

async function sendMailWiseRports(mailIds, reports){
    try{
        let EmailIds = Object.keys(mailIds);
        for(let i =0; i<EmailIds.length; i++ ){
            let mailID = EmailIds[i];
            let mailBody = '';
            let attachement_body = '';
            let is_attachemet = false;
            let attachement_field = [];
            let subject = '';

            attachement_body += '<p> Herewith enclosing daily status report. below the report enclosed. <ul style=\"list-style-type:circle; color:blue;\">';

            mailIds[mailID].map(reportId => {
                subject = reports[reportId].report_title;
                if(reports[reportId].send_as_attachment){
                    attachement_field.push(reports[reportId].attachment_detail)
                    attachement_body += '<li>'+reports[reportId].report_description+'</li>';
                    is_attachemet = true;
                }else{
                    mailBody += reports[reportId].mailBody;
                }
            });

            attachement_body += '</ul></p><br>';

            if(is_attachemet){
                mailBody += attachement_body;
            }
            if(mailIds[mailID].length > 1){
                subject = 'Scheduled Reports';
            }

            appedoMailer.sendMail(mailID, subject, mailBody, attachement_field).then( result => {
                if(result.success){
                    reportLogger.info(process.pid,'Successfully sent reports of '+mailIds[mailID]+' to '+mailID);
                }else{
                    reportLogger.error(process.pid,result.message);
                }
            });
        }
        await updateLastSentTime(reports);
    }catch(e){
        reportLogger.error(process.pid,e.stack);
    }
}

async function updateLastSentTime(reports){
    try{
        let reportIds = Object.keys(reports);
        reportIds.map(async reportId => {
            let query_text = "update custom_chart_queries set last_email_sent_on = $1 WHERE id = $2";
            let queryParam = [reports[reportId].updated_email_sent_on, reportId];
            let result = await psqlAPM.fnDbQuery('updateLastSentTime - reportID '+reportId,query_text, queryParam, null, null);
            if(result.rowCount > 0){
                reportLogger.info(process.pid,'Update successful for last_email_sent_on in this report id :', reportId);
            }else{
                reportLogger.error(process.pid,'Unable to update for last_email_sent_on in this report id :', reportId);
            }
        });
    }catch(e){
        reportLogger.error(process.pid,e.stack);
    }
}

async function createMailWiseRportId(reports){
    let mailIds = {};
    try{
        reports.map( report => {
            report.email_arr == null ? report.email_arr = [] : report.email_arr;
            if(report.email_arr.length == 0){
                reportLogger.info(process.pid,"There is no Email-Id in this report :", report.id);
            }
            if(report.qry_rst){
                report.email_arr.map(mailId => {
                    if(mailIds.hasOwnProperty(mailId)){
                        mailIds[mailId].push(report.id);
                    }else{
                        mailIds[mailId] = [report.id];
                    }
                });
            }
        })
    }catch(e){
        reportLogger.error(process.pid,e.stack);
        throw e;
    }
    return mailIds;
}

async function CreateCsv(reportId, queryRst){
    try{
        let csvData = json2csvParser.parse(queryRst);
        let filename = 'report_'+reportId+'.csv';
        await writeFile(EMAIL_ATTACHMENT_PATH + filename, csvData, 'utf8');
    }catch(e){
        reportLogger.error(process.pid,'CreateCsv : ',e.stack);
    }
}

async function mailBodyContent(reportDescription, queryRst){
    let mailBody = '';
    try{
        mailBody += '<p><b>Report Name : </b>'+reportDescription+'</p><br>';
        mailBody += '<table id=\"t01\"><tr>';
        let qryColumn = Object.keys(queryRst[0]);
        qryColumn.map(key => {
            mailBody += '<th>'+key+'</th>';
        });
        mailBody += '</tr>';
        for(let i=0; i<queryRst.length;i++){
            mailBody += '<tr>';
            Object.keys(queryRst[i]).map(key => {
                if(queryRst[i][key] == 'Up' || queryRst[i][key] == 'Ok'){
                    mailBody += '<td style=\"background :#00b050;\">'+queryRst[i][key]+'</td>';
                }else if(queryRst[i][key] == 'Down'){
                    mailBody += '<td style=\"background :red;\">'+queryRst[i][key]+'</td>';
                }else{
                    mailBody += '<td>'+queryRst[i][key]+'</td>';
                }
            });
            mailBody += '</tr>';
        }
        mailBody += '</table><br><br>';
    }catch(e){
        reportLogger.error(process.pid,e.stack);
    }finally{
        return mailBody;
    }
}

function startOfWeek(date)
{
  let diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
  let stWeekDate = new Date(date.setDate(diff));
  return new Date(stWeekDate.getFullYear(), stWeekDate.getMonth(), stWeekDate.getDate());
}