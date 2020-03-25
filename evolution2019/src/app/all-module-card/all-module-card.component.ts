import { Component, OnInit, ElementRef,OnDestroy } from '@angular/core';
import { AlertService, AuthenticationService } from '../_services/index';
import { NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {DbConnectorComponent} from '../db-connector/db-connector.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-all-module-card',
  templateUrl: './all-module-card.component.html',
  styleUrls: ['./all-module-card.component.css'],
  providers: [DbConnectorComponent,NgbActiveModal],
})

export class AllModuleCardComponent implements OnInit {
  isLoading = false;
  showHtml:String;
  showTitle = false;
  showBackBtn = false;
  showAddEdit:String;
  cardBody1;
  cardBody2;
  cardFooter1; cardFooter2; cardFooter2a; cardFooter3; cardTitle
  cardSubFooter3a; cardSubFooter3b; cardSubFooter3c;
  modCardData;
  dbConColl;
  cvColl; chartMappedCnt=[];

  //d3 chart variables
  canDrawChart=false; modalDisplay ="none"; d3ChartData; chartWidth; chartHt; d3RootChartType; chartTitle;

  //observable used for monitoring changes to the enterprise at login header
  obsEnt;
  mmStatCard; mmModTypeIcon; cardIdx; mmCardMetricStatus=[]; mmCardAvlConfig = []; cardCount; msProcessed = 0; avlProcessed = 0;
  cvSCIcon;
  showChart; chart; cvStatCard; cvSCStatCard; cvSCModType;

  //variable for adding to mychart
  myChart = false; myChartName; myChartSelVal; myChartColl;


  constructor(
    private alertService: AlertService,
    private authService: AuthenticationService,
    private modalService: NgbModal,
    private element: ElementRef,
    private route: Router,
  ) { }
  
  drawChart(uidData){
    localStorage.setItem("drawChartUid",JSON.stringify(uidData));
    this.route.navigate(['/dashboard']);
  }

  ngOnDestroy(){
    console.log("inside on destroy modulecard");
    this.obsEnt.unsubscribe();
  }
  
  ngOnInit() {
    //console.log("inside module card");
    localStorage.setItem("currentRoute","modulecard");
    this.obsEnt = this.authService.watchStorage().subscribe(data =>{
      if (data && JSON.parse(localStorage.getItem('entItem')) != null ){
        this.loadModuleCard();
      }
    });
    this.loadModuleCard();
  }
  cancelEditMyChart(){
    console.log("inside cancel");
    this.myChart = false;
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

  myChartChanged(selVal){
    if (!this.isLoading){
      this.myChartSelVal = selVal;
    } else {
      this.alertService.error("Loading not yet completed, please wait....");
    }
  }

  addToMyChart(){
    let chartData = this.d3ChartData ;
    console.log(chartData);
    let entItem = JSON.parse(localStorage.getItem('entItem'))
    let mcName = this.myChartSelVal == "--select--" && this.myChartName != undefined ? this.myChartName.trim() : this.myChartSelVal != "--select--" ? this.myChartSelVal : undefined;
    if (mcName == undefined || mcName == '' || !this.onEditMyChartName() ){
      return ;
    }
    this.isLoading = true;
    let myChartData = {
      mcName : mcName ,
      chartId : chartData.chart_id,
      refId : chartData.ref_id == null ? -1 : chartData.ref_id,
      moduleType : chartData.module_type,
      eId : entItem != undefined && entItem.e_id != undefined && entItem.e_id !=0 ? entItem.e_id : null,
      entOwnerId : entItem != undefined && entItem.owner_id != null && entItem.owner_id !=0 ? entItem.owner_id : null,
      modifiedOn : new Date(),
      isSystem : chartData.is_system ==null ? false : chartData.is_system
    }
    this.authService.addToMyChart(myChartData).subscribe( dash => {
      this.isLoading = false;
      if (dash.success){
        this.alertService.success(dash.message,true);
        this.cancelEditMyChart();
      } else {
        this.authService.invalidSession(dash);
      }
    },
    error => {
      this.isLoading = false;
      console.log (error);
      this.alertService.error("Connection Error");
    });
  }
  
  enableAddMychart(){
    this.myChartSelVal = undefined;
    this.authService.getDashboard().subscribe( dash => {
      if (dash.success){
        this.myChartColl = dash.result;
        if(this.myChartSelVal == undefined){
          this.myChartSelVal = "--select--";
        }
        this.myChart = true;
      } else {
        this.authService.invalidSession(dash);
      }
    },
    error => {
      console.log (error);
      this.alertService.error("Connection Error");
    });
  }


  addCustomChart(){
    //console.log("inside addcustomer chart");
    this.route.navigate(['chartvisual']);
  }

  openModal(type){
    if( type == 'open'){
      //console.log("inside open modal");
      this.chartWidth = Math.round(window.screen.width * 80/100);
      this.chartHt = 400;
    } else {
      this.chartHt = null;
      this.chartWidth = null;
      this.canDrawChart = false;
    }
    this.modalDisplay = this.modalDisplay =="block"? "none" : "block";
  }

  ViewChartVisual (cardElement){
    if (!this.isLoading){
      let chartId = cardElement.chart_id
      //console.log("inside viewChartVisual "+chartId);
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      if (!this.isLoading){
        this.isLoading = true;
        let chartData = {
          chartId: chartId,
          startTime: Date.now()/1000-60*60,
          endTime: Date.now()/1000,
          dtFormat: 'MINUTES',
          qryInterval: '1 MINUTE',
          qryType: 'query',
          aggQryTableName: '_',
          entId: entItem != undefined && entItem.e_id != undefined ? entItem.e_id == 0 ? null: entItem.e_id : null
        }
        this.authService.getChartDataByChartId(chartData).subscribe( cvData => {
          this.isLoading = false;
          //console.log(cvData);
          if (cvData.success){
            this.canDrawChart=true; 
            this.modalDisplay ="block"; 
            this.d3ChartData = cvData.result; 
            this.chartWidth = window.screen.width*80/100; 
            this.chartHt = 400; 
            this.d3RootChartType = cvData.result.root_chart_type;
            this.chartTitle = cardElement.chart_title + " "+ cardElement.category +"("+chartId+")";
          } else {
            this.authService.invalidSession(cvData);
          }
        },error => {
          this.isLoading = false;
          this.alertService.error(error.message);
        })
      }
    }
  }
  editChartVisual(chartId){
    if (!this.isLoading){
      localStorage.setItem("editCvId",chartId);
      this.route.navigate(['chartvisual']);
    } else {
      this.alertService.error("Another process is running, please wait");
    }
  }
  delChartVisual(chartId) {
    if (!this.isLoading) {
      this.isLoading = true;
      console.log("inside delchartvisual "+chartId)
      let chartData = {
        chartId: chartId
      }
      this.authService.delCVbyChartId(chartData).subscribe( result =>{
        console.log(result);
        if(result.success){
          this.alertService.success(result.message, true);
          this.loadModuleCard();
        } else {
          this.authService.invalidSession(result);
        }
      });
    }
  }

  private loadModuleCard() {
    //console.log("inside load module card");
    let allModCardVisitedModule = localStorage.getItem("allModCardVisitedModule");
    switch (allModCardVisitedModule) {
      case 'cv':
        let modType = localStorage.getItem("cvModType");
        //console.log("modType",modType);
        if (modType != undefined) {
          if (modType == 'custom' || modType == 'sum' || modType == 'avm' )
            this.getChartVisualCard(modType)
          else 
            this.getCVSubCategoryStat(modType);
        }
        else
          this.getChartVisualStat();
        break;
      case 'dbc':
        this.getDbConnectors();
        break;
      case 'mmserver':
        this.getMMStat('server','Operating System');
        break;
      case 'mmapplication':
        this.getMMStat('application','Application');
        break;
      case 'mmdatabase':
        this.getMMStat('database','Database');
        break;
    }
  }
  openDBAddConnModal(){
    let modalRef;
    modalRef = this.modalService.open(DbConnectorComponent as Component, {backdrop:'static'});
    modalRef.result.then((data) => {
      console.log("modal closed back to main component");
      this.loadModuleCard();
    });
  }
  //to Edit the DB connector 
  openDBConnModal(dbId){
    let modalRef;
    console.log("Inside OpenDBModal "+dbId);
    let dbData = {dbId:dbId};
    this.authService.getDBConnectorForDbId(dbData).subscribe(res => {
      console.log(res.result[0]);
      if (res.success) {
        modalRef = this.modalService.open(DbConnectorComponent as Component, {backdrop:'static', windowClass:'dbConnModal'});
        modalRef.componentInstance.dbCon = JSON.stringify(res.result[0]);
        modalRef.result.then((data) => {
        console.log("modal closed back to main component");
        this.loadModuleCard();
      }, (reason) => {
        console.log("modal dismissed back to main component");
        // on dismiss
      });
    } else {
      this.authService.invalidSession(res);
    }
    });
  }
  
  getCardIconColorIdx(idx){
    switch (idx) {
      case 0:
        return "clrwhite";
      case 1:
        return "clrwhite";
      case 2:
        return "clrwhite";
      case 3:
        return "clrwhite";
      case 4:
        return "clrwhite";
      case 5:
        return "clrwhite";
      case 6:
        return "clrwhite";
      case 7:
        return "clrwhite";
      case 8:
        return "clrwhite";
      case 9:
        return "clrwhite";
      case 10:
        return "clrwhite";
      case 11:
        return "clrwhite";
      default :
        return "clrwhite";
    }
  }

  getCardIconColor(mType){
    let mTypeLower = mType.toLowerCase();
    switch (mTypeLower) {
      case 'server':
        return "clrwhite";
      case 'database':
        return "clrwhite";
      case 'rum':
        return "clrwhite";
      case 'sum':
        return "clrwhite";
      case 'log':
        return "clrwhite";
      case 'netstack':
        return "clrwhite";
      case 'application':
        return "clrwhite";
      case 'nettrace':
        return "clrwhite";
      case 'avl':
        return "clrwhite";
      case 'custom':
        return "clrwhite";
      case 'alert':
        return "clrwhite";
      default :
        return "clrwhite";
    }
  }
  
  getBgColor (mType){
    let mTypeLower = mType.toLowerCase();
    switch (mTypeLower) {
      case 'server':
        return "bg-primary";
      case 'database':
        return "bg-darkgreen";
      case 'rum':
        return "bg-darkgoldenrod";
      case 'sum':
        return "bg-chocolate";
      case 'log':
        return "bg-brown";
      case 'netstack':
        return "bg-maroon";
      case 'application':
        return "bg-darkolivegreen";
      case 'nettrace':
        return "bg-maroon";
      case 'avl':
        return "bg-teal";
      case 'custom':
        return "bg-cadetblue";
      case 'alert':
        return "bg-danger";
      case 'dbconnector':
        return "bg-darkgreen";
      default :
        return "bg-1b639e";
    }
  }

  getBgColorIdx (idx){
    switch (idx%11) {
      case 0:
        return "bg-primary";
      case 1:
        return "bg-darkgreen";
      case 2:
        return "bg-darkgoldenrod";
      case 3:
        return "bg-chocolate";
      case 4:
        return "bg-brown";
      case 5:
        return "bg-maroon";
      case 6:
        return "bg-darkolivegreen";
      case 7:
        return "bg-maroon";
      case 8:
        return "bg-teal";
      case 9:
        return "bg-cadetblue";
      case 10:
        return "bg-danger";
      case 11:
        return "bg-darkgreen";
      default :
        return "bg-1b639e";
    }
  }

  getFontAwsomeIcons (mType){
    let mTypeLower = mType.toLowerCase();
    switch (mTypeLower) {
      case 'server':
        return "fas fa-hockey-puck clrprimary";
      case 'database':
        return "fas fa-database clrdarkgreen";
      case 'rum':
        return "fas fa-users clrdarkgoldenrod";
      case 'sum':
        return "fab fa-android clrchocolate";
      case 'log':
        return "fas fa-indent clrbrown";
      case 'netstack':
        return "fas fa-code clrmaroon";
      case 'application':
        return "far fa-file-code clrdarkolivegreen";
      case 'nettrace':
        return "fas fa-code clrmaroon";
      case 'avl':
        return "fas fa-unlink clrteal";
      case 'custom':
        return "fas fa-chart-pie clrcadetblue";
      case 'alert':
        return "far fa-bell clrdanger";
      case 'dbconnector':
        return "far fa-database clrdarkgreen";
      default :
        return "fas fa-server clr1b639e";
    }
  }
  
  onBackFromCard(){
    this.loadModuleCard();
    this.showBackBtn = false;
  }

  getAllUidFromMMCard(mmCardDetails){
    this.msProcessed = 0;
    mmCardDetails.map((mmCard, idx) => {
      //console.log(mmCard,idx,mmCard.active);
      if (mmCard.active) {
        this.getMetricStatusForUid(mmCard.uid,idx); 
      }
      else {
        this.msProcessed++;
        this.mmCardMetricStatus[idx] = {uid:mmCard.uid,critical:'na',warning:'na',healthy:'na'};
      }
      this.getAvlConfigCntForUid(mmCard.uid,idx);
    });
  }

  getMetricStatusForUid(uid,idx){
    let msData = {uid: uid};
    this.authService.getMetricStatusForUid(msData).subscribe(res => {
      this.msProcessed++;
      //console.log("msProcessed",this.msProcessed);
      if (res.success) {
        this.mmCardMetricStatus[idx] = {uid:uid,critical:res.result.critical,warning:res.result.warning}
        if (this.avlProcessed == this.cardCount && this.msProcessed == this.cardCount){
          //console.log("process health cnt called from getMetricStatusForUid");
          this.processHealthCnt();
        }
      } else if (!res.invalidSession) {
        this.mmCardMetricStatus[idx] =  {uid:uid,critical:0,warning:0};
      } else {
        this.authService.invalidSession(res);
      }
    });
  }

  processHealthCnt(){
    //console.log("inside processHealthCnt");
    this.modCardData.map((mmCard, idx) => {
      if (mmCard.active){
        this.mmCardMetricStatus[idx]['healthy'] = Number(this.mmCardAvlConfig[idx].configured) - Number(this.mmCardMetricStatus[idx].critical)- Number(this.mmCardMetricStatus[idx].warning);
      }
    });
  }

  getAvlConfigCntForUid(uid,idx){
    let msData = {uid: uid};
    //console.log(uid,idx);
    this.avlProcessed = 0;
    this.authService.getAvlConfigCntForUid(msData).subscribe(res => {
      this.avlProcessed++;
      //console.log("avlProcessed ",this.avlProcessed,uid,idx);
      if (res.success) {
        //console.log(res.result);
        let data = res.result[0];
        this.mmCardAvlConfig[idx] = {uid: uid, available:data.available, configured:data.configured};
        if (this.avlProcessed == this.cardCount && this.msProcessed == this.cardCount){
          //console.log("process health cnt called from getAvlConfigCntForUid");
          this.processHealthCnt();
        }
      } else if (!res.invalidSession) {
        this.mmCardAvlConfig[idx] = {uid: uid, available:0, configured:0}
      } else {
        this.authService.invalidSession(res);
      }
    });
  }

  getMMCard(modType, idx){
    localStorage.setItem("mmModType",modType);
    this.cardIdx = idx;
    this.modCardData = []; this.cardTitle = '';
    if (!this.isLoading){
      this.isLoading = true;
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      let mmData ={
        entUserId: entItem == undefined || entItem.owner_id == undefined ? null : entItem.owner_id , 
        entId: entItem == undefined || entItem.owner_id == undefined ? 0 : entItem.e_id,
        modType:modType};
      this.authService.getMMCard(mmData).subscribe( coll => {
        //console.log(coll);
        if (coll.success) {
          //console.log(coll.result);
          this.modCardData = coll.result;
          this.cardCount = this.modCardData.length;
          //console.log("CardCount",this.cardCount);
          this.getAllUidFromMMCard(this.modCardData); //To collect metric status for each uid
          
          this.cardBody2 = "Last Received On:";
          this.cardFooter1 ="Uid ";
          this.cardFooter2 ="Available ";
          this.cardFooter2a ="Configured ";
          this.cardFooter3 ="Metric Status ";
          //this.cardSubFooter3a = "";
          this.cardTitle = 'Module Type '+modType+' details';
          this.isLoading = false;
          this.showHtml = "mmCardHtml";
          this.showBackBtn = true;
          this.showTitle = true;
        } else {
          console.log("inside getChartVisualCard no rows cond");
          this.isLoading = false;
          this.authService.invalidSession(coll);
          //this.alertService.error(coll.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });
    }
  }
  
  getMMStat(modName, cardOrgin){
    this.cardTitle = ''; this.mmStatCard=[];
    localStorage.removeItem("mmModType");
    this.mmModTypeIcon = modName;
    if(!this.isLoading){
      this.isLoading = true;
      localStorage.setItem("allModCardVisitedModule","mm"+modName);
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      let mmData ={
        entUserId: entItem == undefined || entItem.owner_id == undefined ? null : entItem.owner_id , 
        entId: entItem == undefined || entItem.owner_id == undefined ? 0 : entItem.e_id,
        moduleName: modName
      };

      this.authService.getModuleMasterStat(mmData).subscribe( mmStat =>{
        //console.log(mmStat);
        if(mmStat.success){
          this.mmStatCard = mmStat.result;
          this.cardTitle = cardOrgin+" :: Distribution of "+modName;
          this.showBackBtn = true;
          this.showTitle = true;
          this.isLoading=false;
          this.showHtml ='mmStatHtml';
        } else {
          console.log("inside getChartVisualCard no rows cond");
          this.isLoading = false;
          this.authService.invalidSession(mmStat);
          this.alertService.error(mmStat.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });
    }
  }
  //on click of menu->chartVisualization
  getChartVisualStat(){
    localStorage.removeItem("cvModType");
    this.modCardData = []; this.cardTitle = ''; this.cvStatCard = [];
    //console.log("isLoading: "+this.isLoading);
    if (!this.isLoading){
      this.isLoading = true;
      //console.log("inside getChartVisualStat ");
      localStorage.setItem("allModCardVisitedModule","cv");
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      let cvData ={
        entUserId: entItem == undefined || entItem.owner_id == undefined ? null : entItem.owner_id , 
        entId: entItem == undefined || entItem.owner_id == undefined ? 0 : entItem.e_id};

      this.authService.getChartVisualStat(cvData).subscribe( cvStat =>{
        if (cvStat.success){
          //        console.log(cvStat);
          this.cvStatCard = cvStat.result;
          this.cardTitle = 'Distribution of Chart Visualization Card - Module Type wise';
          this.showTitle = true;
          this.showBackBtn = true;
          //console.log(this.cvStatCard)
          this.isLoading=false;
          this.showHtml ='cvStatHtml';
        } else {
          console.log("inside getChartVisualCard no rows cond");
          this.isLoading = false;
          this.authService.invalidSession(cvStat);
          this.alertService.error(cvStat.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });
    }
  }

  checkSubCategory(modType){
    if(modType.toLowerCase()=='custom'||modType.toLowerCase()=='sum'||modType.toLowerCase()=='avm' ) this.getChartVisualCard(modType)
    else this.getCVSubCategoryStat(modType);
  }

  getCVSubCategoryStat(modType){
    if(!this.isLoading) {
      this.cvSCModType = modType;
      localStorage.removeItem("cvModType");
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      this.cvSCIcon = modType;
      let cvSCData = {
        entUserId: entItem == undefined || entItem.owner_id == undefined ? null : entItem.owner_id , 
        entId: entItem == undefined || entItem.owner_id == undefined ? 0 : entItem.e_id,
        moduleType: modType !=''? modType.toLowerCase():modType
      };
      this.authService.getCVSubCategoryStat(cvSCData).subscribe(res => {
        if(res.success){
          this.cvSCStatCard = res.result;
          this.cardTitle = "Distribution of Chart Visualization Card Module :: "+modType;
          this.showBackBtn = true;
          this.showTitle = true;
          this.isLoading=false;
          this.showHtml ='cvSCStatHtml';
        } else {
          console.log("inside getChartVisualCard no rows cond");
          this.isLoading = false;
          this.authService.invalidSession(res);
          //this.alertService.error(res.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });

    }
  }

  getCVCardByRefId(refId,moduleName){
    localStorage.setItem("cvModType",this.cvSCModType);
    this.modCardData = []; this.cardTitle = '';
    if (!this.isLoading){
      this.isLoading = true;
      console.log("inside getChartVisualCard");
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      let cvData ={entUserId: entItem.owner_id, entId: entItem.e_id, refId:refId};
      this.authService.getCVCardByRefId(cvData).subscribe( coll => {
        if (coll.success) {
          //console.log(coll.result);
          this.modCardData = coll.result;
          this.cardBody2 = "Drill Down:";
          this.cardFooter1 ="Chart Id ";
          this.cardFooter2 ="Module Type ";
          this.cardFooter3 ="Has Aggr Query ";
          this.cardSubFooter3a = "DB Connector ";
          this.cardTitle = 'Chart Visualization :: Module '+moduleName+' details';
          this.isLoading = false;
          this.showHtml = "chartVisualHtml";
          this.showBackBtn = true;
          this.showTitle = true;
        } else {
          console.log("inside getChartVisualCard no rows cond");
          this.isLoading = false;
          this.authService.invalidSession(coll);
          //this.alertService.error(coll.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });
    }
  }

  getChartVisualCard(modType){
    //localStorage.setItem("cvModType",modType);
    this.modCardData = []; this.cardTitle = '';
    if (!this.isLoading){
      this.isLoading = true;
      //console.log("inside getChartVisualCard");
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      let userData ={entUserId: entItem.owner_id, entId: entItem.e_id, modType:modType};
      this.authService.getChartVisualCard(userData).subscribe( coll => {
        if (coll.success) {
          //console.log(coll.result);
          this.modCardData = coll.result;
          this.cardBody2 = "Drill Down:";
          this.cardFooter1 ="Chart Id ";
          this.cardFooter2 ="Module Type ";
          this.cardFooter3 ="Has Aggr Query ";
          this.cardSubFooter3a = "DB Connector ";
          this.cardTitle = 'Module Type '+modType+' details';
          this.isLoading = false;
          this.showHtml = "chartVisualHtml";
          this.showBackBtn = true;
          this.showTitle = true;
        } else {
          console.log("inside getChartVisualCard no rows cond");
          this.isLoading = false;
          this.authService.invalidSession(coll);
          //this.alertService.error(coll.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });
    }
  }

  getAllDbIdChartMappedCnt(dbConColl){
    dbConColl.map((dbCon, idx, dbConColl) => {
      //console.log(idx);
      this.getChartMappedCnt(dbCon.db_id,idx);
    })
  }
  
  getChartMappedCnt(dbId,idx){
    //console.log("inside chart mapped");
    let dbData = {dbId: dbId};
    this.authService.getChartMappedCnt(dbData).subscribe(chartMapped => {
      //console.log(chartMapped);
      if(chartMapped.success){
        this.chartMappedCnt[idx] = chartMapped.result[0].count;
        //console.log(this.chartMappedCnt);
      } else {
        this.chartMappedCnt[idx] = 0;
      }
    })
  }

  getDbConnectors(){
    this.modCardData = []; this.cardTitle = '';
    if(!this.isLoading){
      console.log("inside getDbConnectors");
      localStorage.setItem("allModCardVisitedModule","dbc");
      this.isLoading = true;
      this.authService.getDbConnector().subscribe( coll => {
        if (coll.success) {
          //onsole.log(coll);
          this.modCardData = coll.result;
          this.cardBody2 = "Last Validated On:";
          this.cardFooter1 ="Chart Mapped";
          this.cardFooter2 ="Db Id";
          this.isLoading = false; 
          this.cardTitle = "DB Connectors Details";
          this.showBackBtn = true;
          this.showTitle = true;
          this.showHtml = "dbconnectorHtml";
          this.getAllDbIdChartMappedCnt(this.modCardData);
        } else {
          console.log("inside getDbConn no rows cond");
          this.isLoading=false;
          this.authService.invalidSession(coll);
          this.alertService.error(coll.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
      });
    }
  }
}
