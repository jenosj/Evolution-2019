import { Component,Directive, OnInit, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {  FormControl, NgModel } from '@angular/forms';
import { AlertService, AuthenticationService } from '../_services/index';
//import {AllModuleCardComponent} from '../all-module-card/all-module-card.component';
//import * as _ from 'lodash';

@Component({
  selector: 'app-dashboard-header',
  templateUrl: './dashboard-header.component.html',
  styleUrls: ['./dashboard-header.component.css']
})
export class DashboardHeaderComponent {
  /* Calendar slider Setting*/
  showCalendarIcon = true; showSlider = true; sliderFrom = 0; stepMin = 5; startDt: Date; endDt: Date; SelectedDateTime;
  dtFormat:String = 'MINUTES'; qryInterval:String = '1 MINUTE' ; qryType:string = 'query'; //key name of the type of query to be used. either aggr_query or query
  aggQryTableName ='_'; prevSliderFromValue:Number; prevCalSetValue; max = new Date(); min: Date;
  
/* dashboard intialization */
  dashboardColl; dashSelVal; chartDetails= []; editChartMode = false; editModeTitle = "Click to Enable Edit Mode";
  drawChartData=[]; drawChartXY=[];

  isLoading = false;
  entSelectedItem;
//  firstTimeLoading = true;
/* chart drag drop move settings */  
  x = [];   y= []; px: number; py: number; width = []; height = []; d3width =[]; d3height =[]; minArea: number;
  draggingCorner: boolean; draggingWindow: boolean; resizer: Function; idx: number;
 
  obsEnt;
  //variable for calling from module card
  isFromMyChart = true; uidLabel; 
  //variable for adding to mychart
  myChart = []; myChartName; myChartSelVal; myChartColl


  constructor(
    private router: Router,
    private alertService: AlertService,
    private authService: AuthenticationService,
    //private moduleCard: AllModuleCardComponent
  ) { }

  ngOnDestroy(){
    //console.log("inside on destroy, dashboard");
    if (this.obsEnt != undefined)
      this.obsEnt.unsubscribe();
  }
  ngOnInit() {
    localStorage.setItem("currentRoute","dashboard");
    //Whenever changes noticed to the enterprise selected item the below service will get triggered. 
    this.obsEnt = this.authService.watchStorage().subscribe(data =>{
      if (data && JSON.parse(localStorage.getItem('entItem')) != null){
        this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName);
      }
    });
    //set the date to last one hour 
    this.isLoading = true;
    this.min =new Date(this.max);
    this.min.setMonth(this.max.getMonth()-2);
    this.endDt = new Date();
    this.startDt = new Date(this.endDt);
    this.startDt.setHours(this.endDt.getHours() - 1);
    this.SelectedDateTime = new FormControl([this.startDt, this.endDt]);
    //setting the old values to the array to compare for any change
    this.prevCalSetValue = [this.SelectedDateTime.value[0].getTime(), this.SelectedDateTime.value[1].getTime()];
    //console.log (this.startDt.getTime()+' '+this.endDt.getTime());
    //get the dashboard (my Chart) list 
    let uidData = localStorage.getItem('drawChartUid') !=undefined ? JSON.parse(localStorage.getItem('drawChartUid')) :undefined;
    if (uidData != undefined ){
      this.uidLabel = uidData.uid+" :: "+uidData.module_name;
      this.isFromMyChart = false;
      this.dashSelVal = uidData.uid;
      this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName);
    } else {
      this.authService.getDashboard().subscribe( dash => {
        if (dash.success){
          this.dashboardColl = dash.result;
          //this.dashboardColl.push({mc_name: "Critical & Warning"});
          this.dashSelVal = localStorage.getItem('dashSelVal');
          if(this.dashSelVal == undefined){
            this.dashSelVal = "--select--";
            localStorage.setItem("dashSelVal",this.dashSelVal);
          }
          this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName);
        } else {
          this.isLoading=false;
          this.authService.invalidSession(dash);
        }
      },
      error => {
        console.log (error);
        this.alertService.error("Connection Error");
      });
    }
  }

  myChartChanged(selVal){
    if (!this.isLoading){
      this.myChartSelVal = selVal;
    } else {
      this.alertService.error("Loading not yet completed, please wait....");
    }
  }

  cancelEditMyChart(idx){
    console.log("inside cancel");
    this.myChart[idx] = false;
    this.myChartName = undefined;
  }
  
  onEditMyChartName(){
    console.log(this.myChartName);
    const reqExp = new RegExp(/^[a-zA-Z ]*$/);
    if (reqExp.test(this.myChartName)){
      return true;
    } else {
      this.alertService.error("Name cannot be empty, Special Characters and numeric are not allowed.")
      return false;
    }
  }

  addToMyChart(idx, chartId, refId, moduleType,isSystem){
    console.log(idx,chartId,refId,moduleType, this.myChartName);
    let entItem = JSON.parse(localStorage.getItem('entItem'))
    let mcName = this.myChartSelVal=="--select--" && this.myChartName != undefined ? this.myChartName.trim() : this.myChartSelVal != "--select--" ? this.myChartSelVal : undefined;
    if (mcName == undefined || mcName == '' || !this.onEditMyChartName() ){
      //this.alertService.info("My Chart Name cannot be empty.");
      return ;
    }
    let myChartData = {
      mcName : mcName ,
      chartId : chartId,
      refId : refId == null ? -1 : refId,
      moduleType : moduleType,
      eId : entItem != undefined && entItem.e_id != undefined && entItem.e_id !=0 ? entItem.e_id : null,
      entOwnerId : entItem != undefined && entItem.owner_id != null && entItem.owner_id !=0 ? entItem.owner_id : null,
      modifiedOn : new Date(),
      isSystem : isSystem
    }
    this.authService.addToMyChart(myChartData).subscribe( dash => {
      if (dash.success){
        this.alertService.success(dash.message,true);
        this.cancelEditMyChart(idx);
      } else {
        this.authService.invalidSession(dash);
      }
    },
    error => {
      console.log (error);
      this.alertService.error("Connection Error");
    });
  }

  enableAddMychart(i){
    this.chartDetails.map((ele,idx) =>{
      if (idx != i)
        this.myChart[idx] = false;
    });
    this.myChart[i] = true;
    this.myChartSelVal = undefined;
    this.authService.getDashboard().subscribe( dash => {
      if (dash.success){
        this.myChartColl = dash.result;
        if(this.myChartSelVal == undefined){
          this.myChartSelVal = "--select--";
        }
      } else {
        this.authService.invalidSession(dash);
      }
    },
    error => {
      console.log (error);
      this.alertService.error("Connection Error");
    });
  }

  fromD3chart(event){
    //console.log("from d3 chart",event);
    if (event.ddMetricId == null ){
      //check for 1st column be time scale, if time scale entire graph will be plotted with +30min and -30 min from the selected date
      //console.log(Object.keys(event));
      //console.log(this.dashSelVal, this.isFromMyChart);
      if (event.xAxisTimeScale){
        let selTime = event[Object.keys(event)[0]]; // getting the first key value 
        if (selTime < (new Date().getTime() - 1*60*60*1000) ){
          let stTime = selTime - 30*60*1000;
          let eTime = selTime + 30*60*1000;
          this.dtFormat = 'MINUTES';
          this.qryInterval = '1 MINUTE';
          this.qryType = 'query';
          this.aggQryTableName ='_';
          this.pvtGetCharts(this.dashSelVal, stTime, eTime, this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName);
        } else {
          this.alertService.info("Selected time must be 1 hour less than current time.");
        }
      } else {
        this.alertService.info("Drilldown yet to be developed");
      }
    } else {
      this.alertService.info("Drilldown yet to be developed");
    }
  }
  onBackFromDash(){
    //console.log("inside on Back From dash");
    localStorage.removeItem('drawChartUid');
    this.router.navigate(['/modulecard']);
  }
  
  private removeChart(mcId){
    this.isLoading = true;
    //console.log("mc_id "+mcId);
    let rcData = {mcId: mcId};
    this.authService.removeChart(rcData).subscribe( ack => {
      //console.log(ack);
      if (ack.success) {
        this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName);
        this.alertService.success("Successfully removed",true);
        this.isLoading=false;
      } else {
        this.alertService.error(ack.message);
        this.isLoading=false;
      }    
    });
  }

  private toggleEditMode(){
    this.editChartMode = this.editChartMode? false: true;
    this.editModeTitle = this.editChartMode ? "Click to disable Edit Mode" : "Click to enable Edit Mode";
  }


  async drawDashboard() {
    let sDBV = await this.setDashboardValues();
    let sCV = await this.setChartValues();
    let setVal = await this.setXYWH();
  }

  async setChartValues() {
    this.px = 0;
    this.py = 0;
    this.draggingCorner = false;
    this.draggingWindow = false;
    this.minArea = 30000;
    this.drawChartData = this.chartDetails;
    //this.drawChartData = _.sortBy(this.chartDetails,function(o){return o.chart_param.y})
    //console.log(this.drawChartData);
  }

  async setDashboardValues() {
    let xNxt = 30;
    let yCur = 100;
    let yNxt = 360;
    let xSt = 30;
    let widthDefault = 600;
    let htDefault = 250;
    await this.chartDetails.map((ele, idx) => {
      if (ele.chart_param != null) {
        //console.log(ele.chart_param);
        if (yCur <= ele.chart_param.y ){
          xNxt = xNxt > ele.chart_param.x ? xNxt : ele.chart_param.x + ele.chart_param.width + 10;
        }
        if (yNxt <= ele.chart_param.y) {
          //console.log("inside yNxt gt");
          xNxt = ele.chart_param.x + ele.chart_param.width+10 ;
          yNxt = ele.chart_param.y + ele.chart_param.height + 10;
          yCur = ele.chart_param.y;
        }
        //console.log("idx " + idx + " xNxt " + xNxt + " yNxt " + yNxt + " xSt " + xSt + " yCur " + yCur);
      }
    });
    await this.chartDetails.map((ele, idx) => {
      //console.log("after first execution");
      if(ele.chart_param == null) {
        //console.log("window.screen.width "+window.screen.width+" xNxt+widthDefault "+widthDefault+" "+xNxt)
        if (window.screen.width >= (xNxt + widthDefault)){
          //console.log("inside screen size");
          ele.chart_param = {x:xNxt, y:yCur, width:widthDefault, height:htDefault, mcId:ele.mc_id};
          xNxt = xNxt + widthDefault + 10;
        } else {
          xNxt = xSt + widthDefault + 10;
          ele.chart_param = {x:xSt, y:yNxt, width:widthDefault, height:htDefault, mcId:ele.mc_id};
          yCur = yNxt;
          yNxt = yNxt + htDefault + 10;
        }
        //console.log("idx "+idx+" xNxt "+xNxt+" yNxt "+yNxt+" xSt "+xSt+" yCur "+yCur);
        //console.log(ele.chart_param);
      }
    });
  }

  async setXYWH() {
    let chd = this.drawChartData;
    chd.map((ele, idx) => {
      //      console.log(ele);
      this.x[idx] = chd[idx].chart_param.x;
      this.y[idx] = chd[idx].chart_param.y;
      this.width[idx] = chd[idx].chart_param.width;
      this.height[idx] = chd[idx].chart_param.height;
      let widthInPercent = Math.ceil(this.width[idx] / window.screen.width * 100);
      this.d3width[idx] = this.width[idx];
      this.d3height[idx] = this.height[idx];
    })
  }

  private saveChartParam(){
    //console.log("inside save");
    this.isLoading=true;
    let chData =[];
    this.chartDetails.map((cd, idx) => {
      //console.log(cd.chart_param);
      chData.push(cd.chart_param);
    });
    this.authService.postChartParam(chData).subscribe( ack => {
      this.isLoading=false;
      if (ack.success) {
        this.alertService.success("Successfully updated",true);
        this.toggleEditMode();
      } else {
        //console.log("inside save failure cond");
        this.authService.invalidSession(ack);
        //this.alertService.error(ack.message);
      }
    }, error => {
      this.authService.invalidSession(error);
    });
  }

  // start time and end time are sent in utc epoch milli second.
  pvtGetCharts(myDashSelValue, stEUTCTime, endEUTCTime, dtFormat, qryInterval, qryType, aggQryTableName){
    this.isLoading=true;
    this.myChart =[];
    //startTime and endTime are converted to sec from milli second value.
    const myDash ={
      isFromMyChart: this.isFromMyChart,
      myDash: myDashSelValue,
      startTime: stEUTCTime/1000,
      endTime: endEUTCTime/1000,
      dtFormat: dtFormat,
      qryInterval: qryInterval,
      qryType: qryType,
      aggQryTableName: aggQryTableName,
      entId: JSON.parse(localStorage.getItem('entItem')).e_id
    };
    this.authService.getDashCharts(myDash).subscribe( dash => {
      //console.log('inside get My charts');
      this.isLoading=false;
      if (dash.success){
        this.chartDetails = dash.result;
        this.chartDetails.map((ele,idx) =>{
          this.myChart[idx] = false;
        });
        //console.log("after getting result");
        //console.log(this.chartDetails);
        this.drawDashboard();
      } else {
        this.chartDetails = [];
        this.drawChartData =[];
        this.authService.invalidSession(dash);
      }
    },
    error => {
      this.isLoading=false;
      console.log(error);
      this.authService.invalidSession(error);
    })
  }
  
  showDtPicker(){
    this.showSlider = this.showSlider == true ? false : true;
    if (this.showSlider) {
      this.endDt = new Date();
      this.startDt = new Date(this.endDt);
      this.startDt.setHours(this.endDt.getHours()-1);
      this.dtFormat = 'MINUTES';
      this.qryInterval = '1 MINUTE';
      this.qryType = 'query';
      this.aggQryTableName ='_';
      this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName );
    }
  }

  dtChanged(selVal){
    if (!this.isLoading){
      this.isLoading=true;
      if (this.prevCalSetValue[0] == selVal.value[0].getTime() && this.prevCalSetValue[1] == selVal.value[1].getTime()){
        //console.log("no Change perceived in date");
        this.isLoading=false;
        return;
      }
      //console.log("date changed after if");
      if (selVal.value[1].getTime() < (selVal.value[0].getTime()+60*60*1000)) {
        //console.log("inside data validation alert must be generated");
        this.alertService.error("End date & time must be greater than start date & time");
        this.startDt.setHours(selVal.value[1].getHours()-1);
        this.endDt = selVal.value[1];
      } else {
        this.startDt = selVal.value[0];
        this.endDt = selVal.value[1];
      } 
        this.prevCalSetValue = [this.SelectedDateTime.value[0].getTime(),this.SelectedDateTime.value[1].getTime()];   
        this.SelectedDateTime = new FormControl([this.startDt, this.endDt]);  
        this.pvtSetDTFormat(this.startDt, this.endDt);
        //console.log("getting chart details from dtChanged");
        this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType, this.aggQryTableName );
    } else {
      this.alertService.error("Loading not yet completed, please wait....");
    }
  }

  private pvtSetDTFormat(stDate: any, endDate: any) {
    let timeDiff = stDate - endDate;
    let dtFormat = 'MINUTES';
    if (timeDiff > 3 * 60 * 60 * 1000 && timeDiff <= 12 * 60 * 60 * 1000) {
      //bet 3hours and 12 hours
      this.qryInterval = '5 MINUTES';
      dtFormat = 'MINUTES';
      this.qryType = 'aggr_query';
      this.aggQryTableName ='_aggr_5min_';
    }
    else {
      if (timeDiff > 12 * 60 * 60 * 1000 && timeDiff <= 48 * 60 * 60 * 1000) {
        //between 12 hours and 48 hours
        this.qryInterval = '15 MINUTES';
        dtFormat  = 'MINUTES';
        this.qryType = 'aggr_query';
        this.aggQryTableName ='_aggr_15min_';
      }
      else {
        if (timeDiff > 48 * 60 * 60 * 1000 && timeDiff <= 96 * 60 * 60 * 1000) {
          //between 48 hours and 96 hours
          this.qryInterval = '30 MINUTES';
          dtFormat = 'MINUTES';
          this.qryType = 'aggr_query';
          this.aggQryTableName ='_aggr_30min_';
        }
        else {
          if (timeDiff > 96 * 60 * 60 * 1000) {
            //greater than 96 hours
            this.qryInterval= '1 HOUR';
            dtFormat  = 'HOUR';
            this.qryType = 'aggr_query';
            this.aggQryTableName ='_aggr_1hr_';
            }
        }
      }
    }
    this.dtFormat = dtFormat;
  }

  myDashChanged(selVal){
    if (!this.isLoading){
      this.dashSelVal = selVal;
      localStorage.setItem("dashSelVal",this.dashSelVal);
      this.isLoading=true;
      this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval, this.qryType,this.aggQryTableName );
    } else {
      this.alertService.error("Loading not yet completed, please wait....");
    }
  }

  onSliderFinish(arrVal){ 
    //onSlider Finish gets called when user releases the mouse. As user changes OnChange event gets called. We use OnFinish event in our code.
    if (!this.isLoading){
      this.isLoading=true;
      if (this.prevSliderFromValue == arrVal.from){
        //console.log("No Change "+this.prevSliderFromValue+' '+this.sliderFrom);
        this.isLoading=false;
        return;
      }
      switch (arrVal.from_value) {
        case '1 hr':
          this.startDt.setHours(this.endDt.getHours()-1);
          this.sliderFrom = 0;
          this.qryInterval= '1 MINUTE';
          this.dtFormat  = 'MINUTES';
          this.qryType = 'query';
          this.aggQryTableName ='_';
          break;
        case '3 hrs':
          this.startDt.setHours(this.endDt.getHours()-3);
          this.sliderFrom = 1;
          this.qryInterval = '1 MINUTE';
          this.dtFormat = 'MINUTES';
          this.qryType = 'query';
          this.aggQryTableName ='_';
          break;
        case '6 hrs':
          this.startDt.setHours(this.endDt.getHours()-6);
          this.sliderFrom = 2;
          this.qryInterval = '5 MINUTES';
          this.dtFormat = 'MINUTES';
          this.qryType = 'aggr_query';
          this.aggQryTableName ='_aggr_5min_';
          break;
        case '12 hrs':
          this.startDt.setHours(this.endDt.getHours()-12);
          this.sliderFrom = 3;
          this.qryInterval = '15 MINUTES';
          this.dtFormat = 'MINUTES';
          this.qryType = 'aggr_query';
          this.aggQryTableName ='_aggr_15min_';
          break;
        case '1 day':
          this.startDt.setDate(this.endDt.getDate()-1);
          this.sliderFrom = 4;
          this.qryInterval = '15 MINUTES';
          this.dtFormat  = 'MINUTES';
          this.qryType = 'aggr_query';
          this.aggQryTableName ='_aggr_15min_';
          break;
        case '7 days':
          this.startDt.setDate(this.endDt.getDate()-7);
          this.sliderFrom = 5;
          this.qryInterval = '1 HOUR';
          this.dtFormat = 'HOUR';
          this.qryType = 'aggr_query';
          this.aggQryTableName ='_aggr_1hr_';
          break;
        case '15 days':
          this.startDt.setDate(this.endDt.getDate()-15);
          this.sliderFrom = 6;
          this.qryInterval= '1 HOUR';
          this.dtFormat  = 'HOUR';
          this.qryType = 'aggr_query';
          this.aggQryTableName ='_aggr_1hr_';
          break;
        default :
          this.startDt.setHours(this.endDt.getHours()-1);
          this.sliderFrom = 0;
          this.qryInterval = '1 MINUTE';
          this.dtFormat = 'MINUTES';
          this.qryType = 'query';
          this.aggQryTableName ='_';
      }
      this.prevSliderFromValue = this.sliderFrom;

      //console.log("Change "+this.prevSliderFromValue+' '+this.sliderFrom);
      this.SelectedDateTime = new FormControl([this.startDt, this.endDt]);
      this.pvtGetCharts(this.dashSelVal, this.startDt.getTime(), this.endDt.getTime(), this.dtFormat, this.qryInterval,this.qryType,this.aggQryTableName  );
    } else {
      this.alertService.error("Loading not yet completed, please wait....");
    }
  }

  /* Dashboard drag drop move code starts here */
  area(idx) {
    return this.width[idx] * this.height[idx];
  }

  onWindowPress(event: MouseEvent, idx) {
    this.idx = idx;
    this.draggingWindow = true;
    this.px = event.clientX;
    this.py = event.clientY;
  }

  onWindowDrag(event: MouseEvent) {
     if (!this.draggingWindow) {
        return;
    }
    let idx = this.idx;
    //console.log("onwindowdrag");
    let offsetX = event.clientX - this.px;
    let offsetY = event.clientY - this.py;

    this.x[idx] += offsetX;
    this.y[idx] += offsetY;
    this.px = event.clientX;
    this.py = event.clientY;
  }

  topLeftResize(offsetX: number, offsetY: number) {
    let idx =this.idx;
    //    console.log("idx "+idx+" prev width "+this.width[idx]+" prev ht "+this.height[idx]);
    this.x[idx] += offsetX;
    this.y[idx] += offsetY;
    this.width[idx] -= offsetX;
    this.height[idx] -= offsetY;
    //console.log("idx "+idx+" new width "+this.width[idx]+" new ht "+this.height[idx]);
  }

  topRightResize(offsetX: number, offsetY: number) {
    let idx =this.idx;
    this.y[idx] += offsetY;
    this.width[idx] += offsetX;
    this.height[idx] -= offsetY;
  }
  bottomLeftResize(offsetX: number, offsetY: number) {
    let idx=this.idx;
    this.x[idx] += offsetX;
    this.width[idx] -= offsetX;
    this.height[idx] += offsetY;
  }

  bottomRightResize(offsetX: number, offsetY: number) {
    let idx=this.idx;
    this.width[idx] += offsetX;
    this.height[idx] += offsetY;
  }
  onCornerClick(event: MouseEvent, resizer?: Function) {
    let idx=this.idx;
    this.draggingCorner = true;
    this.px = event.clientX;
    this.py = event.clientY;
    this.resizer = resizer;
    event.preventDefault();
    event.stopPropagation();
  }
  //window: recognizes mouseup and mouse move even outside the div. 
  @HostListener('window:mouseup', ['$event'])
  onCornerRelease(event: MouseEvent) {
    if (this.idx != undefined){
      let idx = this.idx;
      this.draggingWindow = false;
      this.draggingCorner = false;
      this.d3width[this.idx] = this.width[this.idx];
      this.d3height[this.idx] = this.height[this.idx];
      // console.log("before mouse up");
      // console.log(this.chartDetails[this.idx].chart_param);
      this.chartDetails[this.idx].chart_param =  { x: this.x[idx], y: this.y[idx], width: this.width[idx], height: this.height[idx], mcId:this.chartDetails[idx].mc_id };
      // console.log("after mouse up");
      // console.log(this.chartDetails[this.idx].chart_param);
    }
  }
  @HostListener('window:mousemove', ['$event'])
  onCornerMove(event: MouseEvent) {
    if (!this.draggingCorner) {
        return;
    }
    //console.log("mouse move"+this.idx);
    let idx=this.idx;
    //console.log("inside mouse move "+idx);
    let offsetX = event.clientX - this.px;
    let offsetY = event.clientY - this.py;
    let lastX= []; let lastY=[]; let pWidth=[]; let pHeight=[];
    lastX[idx] = this.x[idx];
    lastY[idx] = this.y[idx];
    pWidth[idx] = this.width[idx];
    pHeight[idx] = this.height[idx];
    this.resizer(offsetX, offsetY);
    if (this.area(idx) < this.minArea) {
        this.x[idx] = lastX[idx];
        this.y[idx] = lastY[idx] ;
        this.width[idx] = pWidth[idx] ;
        this.height[idx] = pHeight[idx] ;
    }
    this.px = event.clientX;
    this.py = event.clientY;
//    this.onWindowDrag(event);
  }
  /* Chart drag drop move code ends here */
}
