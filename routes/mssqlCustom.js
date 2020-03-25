const Router = require('express-promise-router')
const jwt = require('jsonwebtoken');
const mssql = require('mssql');
const dateFormat = require('dateformat');

global.logger = require('../log');

module.exports.mssqlQry = mssqlQry;


async function mssqlQry(methodName,connectionString,queryText, queryParam, req, res) {
    let client ;
    let start;
    let qryResult;
    try {
      start = Date.now();
      //client = await mssql.connect(connectionString);
      try {
        //console.log("inside psqlcustom fndbquery");
        //let result = await client.request().query(queryText)
        let result = await new mssql.ConnectionPool(connectionString).connect().then(pool => {
          return pool.request().query(queryText)
        });
        const duration = Date.now() - start;
        result.success = true;
        result.error = false;
        console.log(dateFormat(start,"isoDateTime")+", "+methodName+" , "+duration+' ms');
        logger.info(process.pid,'mssql custom',methodName,duration +' ms');
        qryResult =  result;
      } catch (e) {
          //console.log(e.stack);
          logger.error(process.pid,methodName,e.stack);
          qryResult = {success:false, error: true, message: e.stack};
  
      } finally {
          //return qryResult;
      }
    } catch (e){
      logger.error(process.pid,methodName,e.stack);
      qryResult = {success:false, error: true, message: e.stack};
    } finally {
      mssql.close();
      return qryResult;
    }
  }