///Not in use
const {Pool} = require('pg');
const PgConfig = require('../config/apd_constants');
const pool = new Pool (PgConfig.pgDbConfig);

module.exports = {
    Query: (text, params, callback) => {
        console.log("inside pgscript: "+text);
        const start = Date.now();
        if (text != undefined){
            return pool.query(text, params, (err, res) => {
                const duration = Date.now() - start;
                console.log('executed query', { text, duration, rows: res.rowCount });
                callback(err, res);
              }
            )
        } else {
            console.log("text/query is undefined ");
            return null;
        }
    },
    GetClient: (callback) => {
        pool.connect((err, client, done) => {
            callback(err, client, done)
            }
        )
    }
}
