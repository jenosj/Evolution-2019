//const Router = require('express-promise-router')
const { Pool } = require('pg')
const dateFormat = require('dateformat');
const PgConfig = require('../config/apd_constants');
const pool = new Pool (PgConfig.pgDbConfig);
global.logger = require('../log');

module.exports.fnDbQuery = fnDbQuery;

async function fnDbQuery(methodName,queryText, queryParam, req, res) {
  let client ;
  //let pool;
  let start;
  let qryResult;
  try {
    //pool = new Pool(connectionString);
    start = Date.now();
    client = await pool.connect();
    try {
      const result = await client.query(queryText, queryParam);
      const duration = Date.now() - start;
      result.success = true;
      result.error = false;
      console.log(dateFormat(start,"isoDateTime")+", "+methodName+" , "+duration+' ms'+' ,Pool Idle: '+pool.idleCount +' ,QueryWaiting: '+pool.waitingCount +' Pool Total Cnt: '+pool.totalCount);
      logger.info(process.pid,'psql custom',methodName,duration +' ms',pool.idleCount,pool.waitingCount,pool.totalCount);
      qryResult =  result;
    } catch (e) {
        logger.error(process.pid,methodName,e.stack);
        console.log(e.stack);
        qryResult = {success:false, error: true, message: e.stack};
    } finally {
      client.release();
    }
  } catch (e){
    console.log('psqlAPM - connection error');
    qryResult = {success:false, error: true, message: e.stack};
  } finally {
    return qryResult;
  }
}

pool.on('error', (err) => {
  console.error('An idle client has experienced an error', err.stack)
});
