//const Router = require('express-promise-router')
const { ClickHouse } = require('clickhouse');
const dateFormat = require('dateformat');
const ChConfig = require('../config/apd_constants');
global.logger = require('../log');

module.exports.chDbQuery = chDbQuery;

async function chDbQuery(methodName,connectionString,queryText,req,res){
  let start;
  let qryResult;
  try{
        const chcustom = new ClickHouse({
            database: connectionString.database,
            host: connectionString.host,
            port: connectionString.port,
            basicAuth: {
                username: connectionString.user,
                password: connectionString.password
            },
            config: {
                session_timeout                         : 60,
                output_format_json_quote_64bit_integers : 0,
                enable_http_compression                 : 0
            }
        });
        start=Date.now();
        try {
            const result = await chcustom.query(queryText).toPromise();
            const duration = Date.now() - start;
            console.log(dateFormat(start,"isoDateTime")+", "+methodName+" , "+duration+' ms');
            logger.info(process.pid,'ch sql custom',methodName,duration +' ms');
            qryResult =  {success:true, error: false, result: result};
        } catch (e) {
            qryResult = {success:false, error: true, message: e.message};
            console.log(dateFormat(start,"isoDateTime")+", "+methodName+" , Connection Error!!!, Check error log for more details");
            logger.error(process.pid,methodName,e.stack);
        }
    } catch (e){
        console.log('chsqlCustom - connection error, check error log for more information');
        qryResult = {success:false, error: true, message: e.message};
    } finally {
        chcustom.disconnect();
        return qryResult;
    }
}