import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders} from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { environment } from '../../environments/environment';
import { tokenNotExpired } from 'angular2-jwt';
import { Router } from '@angular/router';
import { AlertService } from '../_services/alert.service';


import 'rxjs/add/operator/map';

@Injectable()
export class AuthenticationService {
    domain = environment.domain;
    //dbConnectorPath = environment.dbEngineName;

    private localStorage = new Subject<boolean>()

    constructor(
        private http: HttpClient,
        private router: Router,
        private alertService: AlertService
    ) { }

    //Custom DB Connector Query Starts
    customQuery(qryData){
        //console.log("customQuery "+ this.dbConnectorPath[engineName]);
        return this.http.post<any>(this.domain + '/pgDbAuth/customQuery', qryData);
    }
    //Custom DB connector Query Ends
    addChartVisual(chartData){
        return this.http.post<any>(this.domain + '/pgDbAuth/addChartVisual', chartData);
    }
    updateCVbyChartId (chartData){
        return this.http.post<any>(this.domain + '/pgDbAuth/updateCVbyChartId', chartData);

    }
    watchStorage(): Observable<any> {
        return this.localStorage.asObservable();
    }
    setItem(key: string, data: any) {
        localStorage.setItem(key, data);
        this.localStorage.next(true);
    }

    removeItem(key) {
    localStorage.removeItem(key);
    this.localStorage.next(false);
    }

	registerUser(user){
		console.info('inside registerUser');
		console.info(user);
		return this.http.post<any>(this.domain + '/authentication/register', user);
    }

	profileUpdate(profile){
		console.info('inside profileUpdate');
		console.info(profile);
		return this.http.post<any>(this.domain + '/pgDbAuth/profileUpdate', profile);
    }

    dbConnectorUpdate(dbConnData){
		return this.http.post<any>(this.domain + '/pgDbAuth/dbConnectorUpdate', dbConnData);
    }

    login(user){
        console.log("domain :" + this.domain);
        return this.http.post<any>( this.domain +'/pgDbAuth/login',user);
    }

    chkDDChartId(chkData){
        return this.http.post<any>(this.domain +'/pgDbAuth/chkDDChartId',chkData);
    }

    addToMyChart(myChartData){
        return this.http.post<any>(this.domain +'/pgDbAuth/addToMyChart',myChartData);
    }
    
    removeChart(rcData){
        return this.http.post<any>(this.domain +'/pgDbAuth/removeChart',rcData);
    }

    storeSessionData(token,user){
        this.setItem('token',token);
        this.setItem('apdUser', JSON.stringify(user.name));
    }

    getCVSubCategoryStat(cvSCData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getCVSubCategoryStat',cvSCData);
    }

    getCVCardByRefId(cvData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getCVCardByRefId',cvData);
    }

    getAvlConfigCntForUid(msData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getAvlConfigCntForUid',msData);
    }

    getMetricStatusForUid(msData) {
        return this.http.post<any>(this.domain+'/pgDbAuth/getMetricStatusForUid',msData);
    }
    
    getMMCard(mmData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getMMCard', mmData);
    }

    getModuleMasterStat(mmData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getModuleMasterStat', mmData);
    }

    getChartVisualStat(cvData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getChartVisualStat', cvData);
    }

    getChartMappedCnt(dbData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getChartMappedCnt',dbData);
    }

    getDBConnectorForDbId(dbData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getDBConnectorForDbId',dbData);
    }
    getChartDataByChartId(chartData) {
        return this.http.post<any>(this.domain+'/pgDbAuth/getChartDataByChartId',chartData);
    }
    getChartVisualForChartId(chartData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getChartVisualForChartId',chartData);
    }

    delCVbyChartId(chartData){
        console.log("inside auth service "+chartData.chartId);
        return this.http.post<any>(this.domain+'/pgDbAuth/delCVbyChartId',chartData);
    }
    getChartVisualCard(userData){
        return this.http.post<any>(this.domain+'/pgDbAuth/getChartVisualCard',userData);
    }

    getDbConnector(){
        return this.http.get<any>(this.domain+'/pgDbAuth/getDbConnector');
    }

    getProfile(){
        return this.http.get<any>(this.domain + '/pgDbAuth/profile');
    }

    getDashboard(){
        return this.http.get<any>(this.domain + '/pgDbAuth/getDashboard');
    }
    validateConnection(dbConnData){
        return this.http.post<any>(this.domain + '/pgDbAuth/validateConnection',dbConnData);
    }
    
    getEnterprise(){
        return this.http.get<any>(this.domain + '/pgDbAuth/getEnterprise');
    }
    getDashCharts(myDash){
        return this.http.post<any>(this.domain+'/pgDbAuth/getDashCharts',myDash);
    }
    postChartParam(arrChartParam){
        console.log("postChartParam");
        console.log(arrChartParam);
        return this.http.post<any>(this.domain + '/pgDbAuth/saveChartParam',arrChartParam);
    }
    logout() {
        // remove user from local storage to log user out
        this.removeItem('token')
        this.removeItem('apdUser')
        this.removeItem('entCollection')
    }

    loggedIn() {
        return tokenNotExpired();
    }

    invalidSession(res: any) {
        let msg;
        if (res.invalidToken) {
            msg = res.message
            this.logout();
            this.router.navigate(['/login']);
        } else if (res.error) {
            let pos = res.message.indexOf(' at ');
            msg = pos > 0 ? res.message.substring(6,pos) : res.message; 
        } else {
            msg = res.message
        }
        console.log("msg :"+msg);
        this.alertService.error(msg,true);
    }
}