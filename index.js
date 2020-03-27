const compression = require('compression')
const express = require('express');
const router = express.Router();
const mountRountes = require('./routes');
global.logger = require('./log');

const app = express();
app.use(compression());
const apdConst = require('./config/apd_constants');
const path = require('path');
//const authentication = require('./routes/authentication')(router);
const downloader = require('./routes/downloader');
const wpt = require('./routes/downloader');
const pgDbAuth = require('./routes/pgDbAuth');
const bodyParser = require('body-parser');
const cors = require('cors');

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
console.log("Number of CPUs: "+numCPUs);
logger.info("Number of CPUs: ",numCPUs)
pgDbAuth.loadAllConfig();
//console.log("current directory located in " + __dirname);
//console.log("The current working directory is " + process.cwd());
// if (cluster.isMaster) {
// 	console.log(`Master ${process.pid} is running`);
  
// 	// Fork workers.
// 	for (let i = 0; i < numCPUs; i++) {
// 	  cluster.fork();
// 	}
// 	cluster.on('fork', (worker) => {
// 		console.log(`worker ${worker.process.pid} running`);
// 		logger.info("worker",worker.process.pid," running");
//     });
  
// 	cluster.on('exit', (worker, code, signal) => {
// 		console.log(`worker ${worker.process.pid} died`);
// 		logger.info("worker",worker.process.pid," died");
// 	});
// } else {
	app.use(cors({
		// starting point for angular 5 client project
		origin: 'http://localhost:4200'
	}));
	// parse application/x-www-form-urlencoded
	app.use(bodyParser.urlencoded({ extended: false }));
	
	// parse application/json
	app.use(bodyParser.json());

	app.use('/downloader',downloader);
	app.use('/wpt', wpt);
	//app.use('/harviewer',express.static('c:\\Appedo\\harviewer\\'));
	app.use(express.static(__dirname + '/evolution2019/dist/evolution2019/'));
	//app.use('/authentication',authentication);
	mountRountes(app);
	
	app.get('*', (req, res) => res.sendFile(path.join(__dirname + '/evolution2019/dist/evolution2019/index.html')));
	// app.use(function applyXFrame(req, res, next) {
	// 	res.set('X-Frame-Options', 'DENY');
	// 	next(); 
	// });
	//HTTP listening port can be modified by changing below.
	var httpPort=3000;
	app.listen(httpPort, () => console.log('Appedo Server listening on port '+httpPort+'!'));
//}
hi
how are  u
