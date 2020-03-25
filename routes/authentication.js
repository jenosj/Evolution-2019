//Not in use -- moved to postgres 
const User = require('../models/mongoDbScripts');
const jwt = require('jsonwebtoken');
const config = require('../config/apd_constants');
module.exports = (router) =>{
//mongoDbScripts	
	router.post('/profileUpdate',(req,res) => {
		console.log("inside profile update server side");
		User.updateOne({_id: req.body.id}, {$set:{name:req.body.name, mobile_no: req.body.mobile}},function(err){
			if (err){
				console.log("update Error "+err);
				res.json({success:false, message: err});
			} else {
				console.log("updated successfully");
				res.json({sucess:true, message:'Profile Update Successful'});
			}
		});
	});

	router.post('/register',(req,res) => {
 		let user = new User({
			email : req.body.email,
			name : req.body.name,
			password : req.body.password
		});
		
//		let user = new User();

		user.save((err) =>{
			if (err){
				console.log (err);
				res.json({success : false, invalidToken : false, message:'Could not save user'+ err});
			} else {
				res.json({success : true, invalidToken : false, message : 'User Saved'});
			}
		});
	});

	router.post('/login', (req,res) =>{
		if (!req.body.email){
			res.json({success: false, invalidToken : false, message:"Email not provided"});
		}else {
			if (!req.body.password){
			res.json({success: false, invalidToken : false, message: "Password not provided"});
			}
			else {
				User.findOne({email:req.body.email.toLowerCase()}, (err , user) => {
					if (err != undefined){
						res.json({success:false, invalidToken : false, message:'error', err});
					} else {
						if(!user) {
							res.json({success:false, invalidToken : false, message:"User not found"});
						} else {
//							console.log(user);
							const validPassword = user.comparePassword(req.body.password);
							if (!validPassword){
								res.json({success:false, invalidToken : false, message:"Password Invalid"});
							} else {
								const token = jwt.sign({userId:user._id, license: user.license}, config.privateKey,{expiresIn: '24h'});
								res.json({success:true, invalidToken : false, message:"Success", token: token, user :{name: user.name, email: user.email,id: user._id, license: user.license}});
							}
						}

					}
				})
			}
		} 
	});

	router.use((req,res,next)=>{
		const token = req.headers['authorization'];
		if (!token){
			res.json({success:false, invalidToken : true ,message: 'No token provided'});
		} else {
			jwt.verify(token, config.privateKey, (err,decoded) => {
				if(err) {
					res.json({success:false, invalidToken : true, message:'Token invalid '+ err});
				} else {
					req.decoded = decoded;
					next();
				}
			})
		}
	})

	router.get('/profile', (req,res)=>{
//		User.findOne({_id: req.decoded.userId}).select('name email').exec((err, user)=>{
		User.findOne({_id: req.decoded.userId}).exec((err, profile)=>{
				if (err != undefined){
				res.json({success:false, invalidToken : false,  message:'error', err});
			} else {
				if(!profile) {
					res.json({success:false, invalidToken : false, message:"User not found"});
				} else {
					res.json({success:true, invalidToken : false, user: profile});
				}
			}
		});
	})

	return router;
}
