const compression = require('compression');  
const express = require('express');
const router = express.Router();
const mountRountes = require('./routes');
global.logger = require('./log');

const app = express();
app.use(compression());  
const fs = require('fs');
const apdConst = require('./config/apd_constants');
const path = require('path');
//const authentication = require('./routes/authentication')(router);
const downloader = require('./routes/downloader');
const wpt = require('./routes/downloader');
const pgDbAuth = require('./routes/pgDbAuth');
const rsAlert = require('./routes/reportSchedulerServices');
const bodyParser = require('body-parser');
const cors = require('cors');

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
console.log("Number of CPUs: "+numCPUs);
logger.info("Number of CPUs: ",numCPUs)

//Loading all application constants.
pgDbAuth.loadAllConfig();
rsAlert.startReportService();
//SSL CONFIG
var key = fs.readFileSync('/mnt/nodejs_certs/ui-key.pem');
var cert = fs.readFileSync( '/mnt/nodejs_certs/ssl_certificate.cer' );
var ca = fs.readFileSync( '/mnt/nodejs_certs/IntermediateCA.cer' );


var options = {
key: key,
cert: cert,
ca: ca
};
//HTTPS listening port can be modified by changing below.
var httpsPort=443;
var https = require('https');
https.createServer(options, app).listen(httpsPort,"10.0.3.125", () => console.log('Appedo Server listening on port '+httpsPort+'!'));

//HTTP listening port can be modified by changing below.
var httpPort=80;
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(httpPort,"10.0.3.125");

//console.log("current directory located in " + __dirname);
//console.log("The current working directory is " + process.cwd());
// if (cluster.isMaster) {
//      console.log(`Master ${process.pid} is running`);

//      // Fork workers.
//      for (let i = 0; i < numCPUs; i++) {
//        cluster.fork();
//      }
//      cluster.on('fork', (worker) => {
//              console.log(`worker ${worker.process.pid} running`);
//              logger.info("worker",worker.process.pid," running");
//     });

//      cluster.on('exit', (worker, code, signal) => {
//              console.log(`worker ${worker.process.pid} died`);
//              logger.info("worker",worker.process.pid," died");
//      });
// } else {
        app.use(cors({
                // starting point for angular 5 client project
                origin: 'http://localhost:4200'
        }));
	//Added for avoiding clickjacking
//	app.use(function applyXFrame(req, res, next) {
//	  res.set('X-Frame-Options', 'sameorigin');
//	  next(); 
//       }); 

       // parse application/x-www-form-urlencoded
        app.use(bodyParser.urlencoded({ extended: false }));

        // parse application/json
        app.use(bodyParser.json());
		
		// Added below url for allowing to send request directly.
        app.use('/downloader',downloader);
        app.use('/wpt', wpt);
        
        app.use(express.static(__dirname + '/evolution2019/dist/evolution2019/'));
        //app.use('/authentication',authentication);
        mountRountes(app);
        //app.get('*/externalMonAuth',externalMonAuth);
        app.get('*', (req, res) => res.sendFile(path.join(__dirname + '/evolution2019/dist/evolution2019/index.html')));
        //app.listen(3000, () => console.log('Appedo Server listening on port 3000!'));

// app.use(function(req, res, next) {
//     if (req.secure) {
//         next();
// } else {
//         res.redirect('https://' + req.headers.host + req.url);
// }
// });
//}
