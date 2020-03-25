const { Pool } = require('pg');
const mssql = require('mssql');
const dateFormat = require('dateformat');
global.logger = require('../log');
//var _ = require('lodash');
let poolColl = [];

module.exports.fnDbQuery = fnDbQuery;
module.exports.fnDbQueryConn = fnDbQueryConn;

async function fnDbQuery(methodName,connectionString,queryText, queryParam, req, res) {
  let client ;
  let start;
  let qryResult;
  try {
    // let pool = _.find(poolColl,function(o) {return o.options.host == connectionString.host && o.options.database == connectionString.database})
    let pool = poolColl.find(x => x.options.host == connectionString.host && x.options.database == connectionString.database);
    if (pool == undefined) {
      connectionString['idleTimeoutMillis'] = 300000;
      connectionString['max'] = 50;
      pool = new Pool(connectionString);
      poolColl.push(pool);
    }
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
        qryResult = {success:false, error: true, message: e.stack};
    } finally {
        client.release();
    }
  } catch (e){
    logger.error(process.pid,methodName,e.stack);
    qryResult = {success:false, error: true, message: e.stack};
  } finally {
    return qryResult;
  }
}

async function fnDbQueryConn(methodName,connectionString,queryText, queryParam, req, res) {
  let client ;
  let start;
  let qryResult;
  try {
    let pool = new Pool(connectionString)
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
        qryResult = {success:false, error: true, message: e.stack};
    } finally {
        client.release();
    }
  } catch (e){
    logger.error(process.pid,methodName,e.stack);
    qryResult = {success:false, error: true, message: e.message};
  } finally {
    return qryResult;
  }
}
