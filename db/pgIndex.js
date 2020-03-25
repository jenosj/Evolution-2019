//not in use.
const { Pool } = require('pg')
const PgConfig = require('../config/apd_constants');
const pool = new Pool (PgConfig.pgDbConfig);

module.exports = {
  query: (text, params) => {
    console.log("inside pgIndex pool ");
    console.log(text +' '+ params);
    
    const result = pool.query(text, params);
    console.log(result[0]);
  }
}