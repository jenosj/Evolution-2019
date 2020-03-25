const Router = require('express-promise-router');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const jwt = require('jsonwebtoken');
const settings = require('../config/apd_constants');

const router = new Router();
module.exports = router;

function getURL(url, method, headers, body){
    return fetch(url, { method: method, headers: JSON.parse(headers), body: body})
    .then(async res => {
        let bodyContent = await res.text();
        return {success:res.ok,error:false, res: res, resBody:bodyContent};
    })
    .then(fullResponse => {
        return fullResponse;
    })
    .catch(err =>{
        return {success:false, error:true, err:err};
    })
}

router.use((req,res,next) => {
    const token = req.headers['authorization'];
    if (!token){
      res.json({success:false, invalidToken : true ,message: 'No token provided'});
    } else {
      jwt.verify(token, settings.privateKey, (err,decoded) => {
        if(err) {
          if (err.message == 'jwt expired' && settings.collRefreshToken[token].expiryTime <= Math.floor(new Date().getTime())){
            req.decoded = settings.collRefreshToken[token].decoded;
            settings.collRefreshToken[token].expiryTime = Math.floor(new Date().getTime()/1000)+settings.tokenExpInSec;
            next();
          } else {
            delete settings.collRefreshToken[token];
            res.json({success:false, invalidToken : true, message:'Session Expired'});
          }
        } else {
          req.decoded = decoded;
          next();
        }
      })
    }
  });
  
router.post('/getUrl', async(req,res)=>{
    let result;
    if (req.body.method != "WSDL" && req.body.bodyType != 'form-data'){
        result = await getURL(req.body.url, req.body.method, req.body.headers, req.body.body);
    } else {
        if (req.body.bodyType == 'form-data'){
            let formData = Object.keys(req.body.body);
            let body = new URLSearchParams();
            formData.map(key=>{
                body.append(key, req.body.body[key]);
            });
            result = await getURL(req.body.url, req.body.method, req.body.headers, req.body.body);
        }
    }
    if (result.error){
        res.json(result);
    } else {
        let resultJson = {success:result.res.ok, body:result.resBody, statusText:result.res.statusText, status:result.res.status,headers:result.res.headers.raw(), type:result.res.type, redirected:result.res.redirected, redirectedUrl: result.res.url,reqUrl:req.body.url};
        res.json(resultJson);
    }
})