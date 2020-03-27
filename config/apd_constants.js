const crypto = require('crypto').randomBytes(32).toString('hex');
const keyEncryptDecrypt = '5c88acf79eecbc7841';
const Crypt = require('crypto');

module.exports = {
privateKey: crypto,
dbPwdPvtKey:'$2a$10$c8rSSIT2EOz/iqjAPP#d0DR2R/xcqw9O..',
keyEncryptDecrypt: '5c88acf79eecbc7841',
//resourcePath: 'c:/Appedo/',
resourcePath: '/appedo/',
attachementPath: 'resource/csv/',
emailTemplatePath: 'resource/email_templates/',
downloads: 'resource/downloads/',
seleniumScriptClassFilePath: 'resource/sum/',
pgDbConfig:{
        user: 'postgres', 
        database: 'appedo_apm', 
        password: '#Gauntlet$F!ve432', 
        host: '3.229.9.128', 
        port: 5432, 
        max: 100, // max number of clients in the pool
        idleTimeoutMillis: 300000
    },
smtpConfig:{
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
       user: 'qam_automail@softsmith.com',
       pass: 'smith*135'
    }
},
Currency: 'rs',
ReportSchedulerRunningMode: true,
NumberFormat: 'crore', //supported values are Crore, Million, thousands if not given will take thousands as default
tokenExpiresIn: '30m', 
tokenExpInSec: 30*60, //converted above value in sec, this is important for calculating refresh token calculation
collRefreshToken : [],
avmSchedulerDebug : false,
avmSchedulerRunningMode : true,
noLocationDBUpdate : true
}

module.exports.encrypt = encrypt;
async function encrypt(val) {
    const cipher = Crypt.createCipher('aes192', keyEncryptDecrypt);
    let encrypted = cipher.update(val, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

module.exports.decrypt = decrypt;
async function decrypt(val) {
    const decipher = Crypt.createDecipher('aes192', keyEncryptDecrypt);
    let decrypt = decipher.update(val, 'hex', 'utf8');
    decrypt += decipher.final('utf8');
    return decrypt;
}

hi
