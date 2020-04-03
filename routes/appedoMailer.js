const nodemailer = require('nodemailer');
global.logger = require('../log');
const fs = require('fs');
const PgConfig = require('../config/apd_constants');
global.reportLogger = require('../log');

module.exports.sendMail = sendMail;
module.exports.loadMailTemplate = loadMailTemplate;
let EMAIL_TEMPLATES_PATH = PgConfig.resourcePath+PgConfig.emailTemplatePath;
let MAIL_CONTENT;

const transport = nodemailer.createTransport(PgConfig.smtpConfig);

const message = {
    from: 'qam_automail@softsmith.com', // Sender address
    //to: 'siddiqa@softsmith.com',        // List of recipients
    //subject: 'Design Your Model S | Tesla', // Subject line
    //text: 'Have the most fun you can in a car. Get your Tesla today!' // Plain text body
};

async function loadMailTemplate(){
    try{
        fs.readFile(EMAIL_TEMPLATES_PATH+'report_status_email.html', 'utf-8', function (err, content){
            if(err){
                console.log(err);
            }else{
                MAIL_CONTENT = content;
            }
        });
    }catch(e){
        reportLogger.error(process.pid,e.stack);
    }
}

async function sendMail(to_address, subject, mailBody, attachment_data){
    let rtnResult;
    try{
        let content = MAIL_CONTENT.replace(/{{mailBody}}/gi, mailBody);
        message.to = to_address;
        message.subject = subject;
        message.html = content;
        message.attachments = attachment_data;
        const result = await transport.sendMail(message);
        result.success = true;
        result.error = false; 
        rtnResult = result;
    }catch(e){
        reportLogger.error(process.pid,e.stack);
        rtnResult = {success:false, error: true, message: e.stack};
        throw e;
    }finally {
        return rtnResult;
    }
};

// async function sendMail(to_address, subject, mailBody, attachment_data){

//     try{
//         fs.readFile('C:\\Appedo\\resource\\email_templates\\report_status_email.html', 'utf-8', function (err, content){
//             if (err)
//                 console.log(err);
//             content = content.replace(/{{mailBody}}/gi, mailBody);
//             message.to = to_address;
//             message.subject = subject;
//             message.html = content;
//             message.attachments = attachment_data;
//             transport.sendMail(message, (error, info) => {
//                 if(error){
//                     console.log(error);
//                 }else{
//                     console.info(info);
//                 }
//             });
//         });

//     }catch(e){
//         console.log(e);
//     }
// }

async function sendMail_old(mailBody){
    console.log('inside the sendMail functon...');
    // transport.sendMail(message, function(err, info) {
    //     if (err) {
    //       console.log(err)
    //     } else {
    //       console.log(info);
    //     }
    // });
    //message.html = mailBody;
    message.attachments = mailBody;
    transport.sendMail(message, (error, info) => {
        if (error) {
            console.log('Error occurred');
            console.log(error);
            console.log(error.message);
            return process.exit(1);
        }

        console.log('Message sent successfully!');
        console.log(info);
        console.log(nodemailer.getTestMessageUrl(info));

        // only needed when using pooled connections
        //transporter.close();
    });
}
hi 
