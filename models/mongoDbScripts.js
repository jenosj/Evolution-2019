const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

const bcrypt = require('bcrypt-nodejs');
const licenseSchema = new Schema({
		license_type: String,
		data_reten_days: Number,
		data_size_mb: Number,
		license_details: {
			sum: {measure: String, desktop_max_measure: Number, mobile_max_measure: Number, max_cities: Number, max_test: Number},
			rum: {measure: String, max_measure: String},
			lt: {measure: String, max_run: Number, max_users: Number},
			profiler: {measure: String,	max_agent: Number, disk_limit_mb: Number},
			ci: {measure: String,max_events: Number},
			log: {measure: String,disk_limit_mb: Number},
			application: {max_agents: Number, max_metrics: Number},
			os: {max_agents: Number, max_metrics: Number},
			db: {max_agents: Number, max_metrics: Number},
			enterprise: {max_users: Number}
		}
	}
)

const userSchema = new Schema({
	email: {type: String, required: true, unique: true, lowercase: true},
	password: {type: String, required: true},
	name: {type: String, required: true},
	country_code: {type:String, default:'+91'},
	mobile_no: {type:Number, default:null},
	enable_jmeter: {type: Boolean, default: false},
	created_date: {type: Date, default: Date.now},
	license: licenseSchema
});

const level0 = {
	license_type: 'level0',
	data_reten_days: 1,
	data_size_mb: 1024,
	license_details: {
		sum: {measure: 'daily', desktop_max_measure: 96, mobile_max_measure: 0,	max_cities: 1,max_test: 2},
		rum: {measure: 'daily',	max_measure: 5000},
		lt: {measure: 'daily', max_run: 3, max_users: 25},
		profiler: {measure: 'daily',max_agent: 1,disk_limit_mb: 512},
		ci: {measure: 'daily', max_events: 5},
		log: {measure: 'daily', disk_limit_mb: 512},
		application: {max_agents: 5, max_metrics: 10},
		os: {max_agents: 5, max_metrics: 10},
		db: {max_agents: 5, max_metrics: 10},
		enterprise: {max_users: 0}
	}
}
userSchema.pre('save', function(next){
	this.license = level0;
	if(!this.isModified('password'))
		return next();
	
	bcrypt.hash(this.password,null,null, (err,hash) =>{
		if (err) return next(err);
		this.password = hash;
		next();
	});

});

userSchema.methods.comparePassword = function(password) {
	return bcrypt.compareSync(password, this.password);
};


module.exports = mongoose.model('User',userSchema);