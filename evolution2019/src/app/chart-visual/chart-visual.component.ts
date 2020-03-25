import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, Validators, FormControlName } from '@angular/forms';
import { AlertService, AuthenticationService } from '../_services/index';

import * as _ from 'lodash';


@Component({
  selector: 'app-chart-visual',
  templateUrl: './chart-visual.component.html',
  styleUrls: ['./chart-visual.component.css'],
})
export class ChartVisualComponent implements OnInit {
  //@ViewChild("idStdQry") idStdQry: ElementRef;

  objectKeys = Object.keys; //used in display of table content json objec to html table
  objectValues = Object.values; //used in display of table content json objec to html table
  chartId;
  isLoading = false;
  form: FormGroup;

  //chart Visual components
  pageTitle;
  chartTitle; chartDesc; category; globalChartType; selDBConnector; stdQry; aggrQry; qryType="stdqry"; dbQryConnectorName; dbAggrConnectorName
  dbQryConnectorId;dbAggrConnectorId; counterId; ddChartId;
  arrCol=[]; arrUnit=[]; arrChartType=[]; colCritical; colWarning; dbConnColl; qryEngineName; aggrEngineName;
  selType=[]; selUnit=[]; selColCritical; selColWarning; selRootChart = "table"; disp; modalDisplay;
  
  hDisplay; enableYaxis; chartTypeJson={}; colUnitJson={}; xaxisTimeScale;  
  chartVisualDetails; connectionString;
  isStdQryValidated = false;  isAggrQryValidated = false; customQryRes; inQryTextArea=false;

  chartWidth; chartHt; d3ChartData; d3RootChartType; canDrawChart; isTable=false; isChartAccepted = false; 

  rootChartColl = ['table','hbar','pie','donut', 'pie3d','donut3d','others'];
  chartType = ['line', 'area', 'vbar'];
  unitColl = ['text','numbers','unit','rows','%','datetime','sec','ms','min','hour','bps','KBps','MBps','GBps','bytes','KB','MB','GB','TB','Rs','$'];

  //variable for adding to mychart
  myChart = false; myChartName; myChartSelVal; myChartColl;
  //parameters for drill down
  ddParam = []; enableParam = false; paramArr =[] ;

  constructor(
    private route: Router,
    private activeRoute: ActivatedRoute,
    private alertService: AlertService,
    private authService: AuthenticationService,
    private formBuilder: FormBuilder,
  ) { 
    // this.activeRoute.params.subscribe( params => {
    //   console.log("inside active Route")
    //   if (params['chartId']){
    //     console.log("inside chartd "+ params['chartId'] );
    //     this.editChartVisual(params['chartId']);
    //   } else {
    //     this.addCustomChart('add');
    //   }
    // });

   this.createForm()

  }
  ngAfterViewInit(){
      //not working code.
      //const element = this.renderer.selectRootElement("#idStdQry");
      //setTimeout(() => element.focus(), 0 );
  }
  ngOnDestroy(){
    console.log("ngOndestroy chartvisual");
  }

  ngOnInit() {
    console.log("inside chart visual component");
    this.authService.getDbConnector().subscribe(dbCon => {
      if (dbCon.success){
        //console.log(dbCon);
        this.dbConnColl = dbCon.result;
        //console.log(this.dbConnColl);
        this.chartId = localStorage.getItem('editCvId');
        if(this.chartId != undefined){
          this.editChartVisual(this.chartId);
        } else {
          this.dbQryConnectorName = '--select--';
        }
      } else {
        console.log("inside getChartVisualCard no rows cond");
        this.isLoading = false;
        this.authService.invalidSession(dbCon);
        this.alertService.error(dbCon.message);
      }
    }, error => {
      this.isLoading = false;
      this.authService.invalidSession(error);
    });
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
    let chartData = this.chartVisualDetails;
    console.log(chartData);
    let entItem = JSON.parse(localStorage.getItem('entItem'))
    let mcName = this.myChartSelVal=="--select--" && this.myChartName != undefined ? this.myChartName.trim() : this.myChartSelVal != "--select--" ? this.myChartSelVal : undefined;
    if (mcName == undefined || mcName == '' || !this.onEditMyChartName() ){
      return ;
    }
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
      if (dash.success){
        this.alertService.success(dash.message,true);
        this.cancelEditMyChart();
      } else {
        this.authService.invalidSession(dash);
      }
    },
    error => {
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

  drawChart(){
    let cData = this.customQryRes;
    this.d3ChartData; this.chartTypeJson={}; this.colUnitJson={};
    //console.log("drawchart "+ this.form.valid);
    if (this.selRootChart == 'table') {
      this.isTable = true;
      //console.log(this.customQryRes);
    }
    else {
      this.isTable = false;
    }
    //preparing data for update/add & chart
    this.arrCol.map((item,idx) => {
      if (idx != 0) {
        this.chartTypeJson[item] = this.selType[idx];
        this.colUnitJson[item] = this.selUnit[idx];
      } else {
        this.xaxisTimeScale = this.selUnit[idx].toLowerCase() == 'datetime' ? true : false;
        this.enableYaxis = this.enableYaxis == undefined ? true : this.enableYaxis;
        this.hDisplay = this.hDisplay == undefined ? false : this.hDisplay;
      }
    });
    //console.log(this.customQryRes);
    this.d3ChartData = {
      h_display:this.hDisplay,
      enable_yaxis: true, //this.enableYaxis,
      xaxis_time_scale: this.xaxisTimeScale,
      chart_types_json: this.chartTypeJson,
      col_units_json: this.colUnitJson,
      data: cData,
      col_critical: this.colCritical,
      col_warning: this.colWarning,
      root_chart_type: this.selRootChart
    };
    
    //console.log("inside blur");
    //console.log(this.d3ChartData);
    this.d3RootChartType = this.selRootChart;
    this.canDrawChart = true;
    this.openModal('open');
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
    //console.log("from open modal width "+this.chartWidth+ " ht "+this.chartHt);
  }

  onColCritical(selVal){
    this.selColCritical = selVal;
  }

  onColWarning(selVal){
    this.selColWarning = selVal;
  }

  onRootChange(type){
    this.isChartAccepted = false;
    this.selRootChart = type;
    if (type != "others") {
      this.disp = 'none';
      this.arrCol.map((item,idx) => {
        if (idx != 0)
          this.selType[idx] = type;
      });
    } else {
      this.disp = 'block';
      this.arrCol.map((item,idx) => {
        if (idx !=0 )
          this.selType[idx] = 'line';
      });
    }

  }
  onChangeChartType(type,idx){
    this.isChartAccepted = false;
    if(idx==0) this.selType[idx] = 'axisLabel';
    if(idx !=0){
        this.selType[idx] = type;
    }
  }

  onChangeChartUnit(unit,idx){
    this.arrUnit[idx] = unit;
    this.selUnit[idx] = unit;
  }

  acceptCV(){
    this.isChartAccepted = true;
    this.openModal('close');
    console.log("Chart Title "+this.form.controls.ChartTitle.status);
    console.log("Chart Desc "+this.form.controls.ChartDesc.status);
    console.log("Chart Category "+this.form.controls.Category.status);
    console.log("StandardQry "+this.form.controls.StdQry.status);
    // console.log("Aggr Qry "+this.form.controls.AggrQry.status);
    // console.log("Aggr Qry "+this.form.controls.AggrQry.status);
    console.log("GlobalChartType "+this.form.controls.GlobalChartType.status);
    console.log("form Valid "+this.form.valid);
  }


  fnInQryTextArea(){
    this.inQryTextArea = true;
    this.isStdQryValidated = false;
    this.ddParam = []; this.paramArr =[];
    this.enableParam = false;
  }

  onBlurStdQry(){
    this.isChartAccepted = false;     this.inQryTextArea = false;
    this.customQryRes = [];
    this.d3ChartData ={};
    //console.log(this.customQryRes);
    //console.log(this.d3ChartData);
    //console.log("onBlurStdQry - qry Status "+this.form.controls.StdQry.status+ " loading "+this.isLoading);
    if (this.form.controls.StdQry.status != "VALID") this.isStdQryValidated = false;
    if (!this.isLoading && this.form.controls.StdQry.status == "VALID" && this.qryEngineName != undefined){
      let qry = this.form.get('StdQry').value;
      let paramCnt = qry.split('@@param@@').length - 1;
      console.log(paramCnt, this.ddParam.length);
      if (paramCnt > 0 && this.ddParam.length == 0 ) {
        this.enableParam = true;
        let cnt = 1;
        this.paramArr.length = paramCnt;
        return;
      } else {
        this.enableParam = false;
        let cnt = 1;
        while (cnt<=paramCnt) {
          qry = qry.replace('@@param@@', this.ddParam[cnt-1]);
          cnt++;
        }
        console.log(qry);
      }

/*       let paramString=qry.indexOf('@@param@@') != -1 ? qry.substring(qry.indexOf("@")+2,qry.indexOf("m@@")+1) : '';
      console.log(paramString);
      if (paramString == "param") {
        if (this.ddParam[0] == undefined) {
          this.enableParam = true;
          return;
        } else {
          this.enableParam = false;
          qry = qry.replace('@@param@@', this.ddParam[0]);
          console.log(qry);
        }
      }
 */      //console.log("inside BlurStdQry qryEngineName "+this.qryEngineName+" aggrEngineName "+this.aggrEngineName);
      //qry = qry.replace(/@startDate@/gi,Date.now()/1000-60*60).replace(/@endDate@/gi,Date.now()/1000);
      this.isLoading = true;
      let qryData = {
        engineName: this.qryEngineName.toLowerCase(),
        connectionString: this.connectionString,
        query: qry,
        startTime: Date.now()/1000-60*60,
        endTime: Date.now()/1000,
        dtFormat: 'MINUTES',
        qryInterval: '1 MINUTE',
        qryType: 'query',
        aggQryTableName: '_',
        entId: JSON.parse(localStorage.getItem('entItem')).e_id,
        counterId: this.counterId
      }
      try {
        //console.log(qryData);
        this.authService.customQuery(qryData).subscribe(qryResult => {
          this.isLoading = false;
          //console.log(qryResult);
          if (qryResult.success){
            this.customQryRes = qryResult.result;
            let cntColumn = Object.keys(this.customQryRes[0]).length;
            //console.log(this.customQryRes);
            //console.log(Object.keys(this.customQryRes[0]).length);
            if (cntColumn > 2){
              let index = this.rootChartColl.indexOf('pie3d')
              if (index >-1) {
                this.rootChartColl.splice(index,1);
                this.selRootChart = this.selRootChart=='pie' || this.selRootChart=='donut' ||this.selRootChart=='pie3d' || this.selRootChart=='donut3d'? 'table' : this.selRootChart;
                this.alertService.error("pie, donut charts are not available for more than 2 columns.")
              }
              index = this.rootChartColl.indexOf('pie')
              if (index >-1) {
                this.rootChartColl.splice(index,1);
              }
              index = this.rootChartColl.indexOf('donut3d')
              if (index > -1)
                this.rootChartColl.splice(index,1);
              index = this.rootChartColl.indexOf('donut')
              if (index > -1)
                this.rootChartColl.splice(index,1);
              } else {
              //console.log(this.rootChartColl.indexOf('pie'));
              if(this.rootChartColl.indexOf('pie') == -1){
                this.rootChartColl.push('pie');
                this.rootChartColl.push('donut');
                this.rootChartColl.push('pie3d');
                this.rootChartColl.push('donut3d');
              }
            }
            //getting the column name
            this.isStdQryValidated = this.processColumn(this.customQryRes);
          } else {
            if (("result" in qryResult && "error" in qryResult.result)) {
              this.isStdQryValidated = false;
              let pos = qryResult.result.error.indexOf(' at ');
              this.alertService.error(qryResult.result.error.substring(6,pos));
              //this.ngAfterViewInit();
            } else {
              console.log("inside else of error");
              this.alertService.error(qryResult.message+" Query is Valid, need dataset to proceed further.");
              this.isStdQryValidated = false;
              //this.ngAfterViewInit();
            }
          }
        }, error => {
          this.isLoading = false;
          console.log(error);
          this.alertService.error(error.message);
        });
      } catch (e) {
        console.log(e);
        this.alertService.error(e.message);
        this.isLoading = false;
      }
    } else {
      this.alertService.error("Check DB connector is selected and query is valid");
    }
  }

  processColumn(result){
      this.arrCol = _.keys(result[0]);
      if (this.arrCol.length > 5) { 
        this.alertService.error("Qry result must not exceed 5 columns, restriction is for better qry performance");
        return false; 
      }
      let cvDetails = this.chartVisualDetails;
      this.arrCol.map((col,idx)=>{
        if (idx==0) {
          this.selType[idx] = "axisLabel";
          this.selUnit[idx] = cvDetails == undefined || cvDetails.chart_types_json[col] == undefined ? "text" : cvDetails.chart_types_json[col];
        } else {
          this.selType[idx] = cvDetails == undefined || cvDetails.chart_types_json[col] == undefined ? "line" : cvDetails.chart_types_json[col];
          this.selUnit[idx] = cvDetails == undefined || cvDetails.col_units_json[col] == undefined ? "count" : cvDetails.chart_types_json[col];
        }
      })
      this.onRootChange(this.selRootChart);
      return true;
  }

  // onDbAggrConChange(dbCon){
  //   //console.log(dbCon);
  //   this.dbAggrConnectorName = dbCon.connector_name
  //   this.aggrEngineName = dbCon.engine_name;
  //   this.connectionString = dbCon.connection_details;
  //   this.dbAggrConnectorId = dbCon.db_id;
  //   this.isStdQryValidated = false;
  //   let qry = this.form.get('AggrQry').value;
  //   if (qry != null && qry.length>0)
  //     this.onBlurStdQry();
  // }

  onDbStdConChange(dbCon){
    //console.log(dbCon);
    this.dbQryConnectorName = dbCon.connector_name
    this.qryEngineName = dbCon.engine_name;
    this.connectionString = dbCon.connection_details;
    this.dbQryConnectorId = dbCon.db_id;
    this.isStdQryValidated = false;
    let qry = this.form.get('StdQry').value;
    if (qry != null && qry.length>0)
      this.onBlurStdQry();
  }

  qryTypeSel(selVal){
    this.qryType = selVal;
  }

  createForm() {
		this.form = this.formBuilder.group({
 			ChartTitle:[this.chartTitle, Validators.compose([
				Validators.required,
				Validators.minLength(3),
        Validators.maxLength(30),
        this.validateName
      ])],
      ChartDesc:[this.chartDesc, Validators.compose([
				Validators.required,
        Validators.maxLength(100),
      ])],
      Category:[this.category, Validators.compose([
				Validators.required,
        Validators.maxLength(10),
        this.validateCategory
      ])],
      GlobalChartType:[this.selRootChart, Validators.compose([
				Validators.required,
        Validators.maxLength(10),
      ])],
      StdQry:[this.stdQry, Validators.compose([
        Validators.required,
        this.validateStdQry
      ])],
      DDChartId:[this.ddChartId, Validators.compose([
         this.validateDDChartId
      ])]
 		}
		);	
  }

  validateDDChartId(controls){
    
/*     console.log(this.chartId);
    if (this.chartId != undefined) {
      if (this.chartId == controls.value) {
        return { 'validateDDChartId' : true};
      }
    } */
    const reqExp = new RegExp(/^[0-9]*$/);
    if (!reqExp.test(controls.value)){
      return { 'validateDDChartId' : true};
    }
  }
  // validateAggrQry(controls){
  //   if(controls.value != null){
  //     if(controls.value==""){return null;}
  //     let cntValue = (controls.value).toLowerCase();
  //     //console.log("cntValue "+cntValue);
  //     if(!cntValue.startsWith("select"))
  //       return { 'validateQry' : true};
  //     else if (controls.value.includes(';'))
  //       return { 'validateQry' : true};
  //   } else {
  //     return null; 
  //   }
  // }

  validateStdQry(controls){
    if(controls.value != null){
      let cntValue = (controls.value).toLowerCase();
      //console.log("cntValue "+cntValue);
      if(!cntValue.startsWith("select"))
        return { 'validateStdQry' : true};
      else if (controls.value.includes(';'))
        return { 'validateStdQry' : true};
    } else {
        return null; 
    }
  }

  validateName(controls){
		const reqExp = new RegExp(/^[a-zA-Z0-9 _-]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateName' : true};
		}
  }

  validateCategory(controls){
		const reqExp = new RegExp(/^[a-zA-Z0-9]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateCategory' : true};
		}
  }

  addCustomChart(mode){
    this.chartId = mode;
    this.pageTitle = "Add Custom Chart";
  }

  onBackFromCard(){
    this.pageTitle = null; this.chartTitle = null; this.chartDesc=null; this.category=null; this.globalChartType=null; 
    this.selDBConnector =null; this.stdQry=null; this.aggrQry=null; this.qryType=null; this.dbQryConnectorName=null; 
    this.dbAggrConnectorName=null;  this.arrCol=[]; this.arrUnit=[]; this.arrChartType=[]; this.colCritical=null; 
    this.colWarning=null; this.dbConnColl=null; this.qryEngineName=null; this.aggrEngineName=null;
    localStorage.removeItem("editCvId");
    this.route.navigate(['modulecard']);
  }

  checkDDChartId(){
    this.ddChartId = this.form.get("DDChartId").value
    if ( this.ddChartId != undefined) {
      if (this.chartId == this.ddChartId){
        this.alertService.error("Drilldown chart id must not be same as parent chart id");
        return;
      }
      let entItem = JSON.parse(localStorage.getItem('entItem'));
      let chkData = {
        ddChartId : this.ddChartId,
        chartId : this.chartId,
        entUserId: entItem != undefined && entItem.owner_id != null && entItem.owner_id !=0 ? entItem.owner_id : null,
      }
      this.authService.chkDDChartId(chkData).subscribe(result => {
        if (!result.success) {
          this.authService.invalidSession(result);
          return;
        } else {
          this.saveChartVisual();
        }
      });
    } else {
      this.saveChartVisual();
    }
  }
  saveChartVisual(){
    if (this.form.valid && this.isChartAccepted){
      this.isLoading = true;
      let updateData =  {
        h_display:this.hDisplay,
        enable_yaxis: this.enableYaxis,
        xaxis_time_scale: this.xaxisTimeScale,
        chart_types_json: this.chartTypeJson,
        col_units_json: this.colUnitJson,
        root_chart_type: this.selRootChart,
        chart_title: this.form.get("ChartTitle").value,
        chart_desc : this.form.get("ChartDesc").value,
        category : this.form.get("Category").value,
        chart_id : this.chartId,
        dd_chart_id: this.ddChartId,
        query : this.form.get('StdQry').value,
        aggr_query : null, // this.form.get('AggrQry').value,
        db_connector_id_query : this.dbQryConnectorId,
        db_connector_id_aggr_query : null, //this.dbAggrConnectorId,
        col_critical : this.selColCritical == "--select--" || this.selColCritical == undefined ? null : this.selColCritical,
        col_warning : this.selColWarning == "--select--" || this.selColWarning == undefined ? null : this.selColWarning,
        is_system : false,
        last_active_time : Date.now(),
        is_drilldown : this.ddChartId != undefined ? true : false,
        e_id : localStorage.getItem("entItem") == undefined || localStorage.getItem("entItem")['e_id'] == 0 ? null : localStorage.getItem("entItem")['e_id']
      }
      if (this.chartId != undefined) {
        // in update mode
        this.authService.updateCVbyChartId(updateData).subscribe( result =>{
          this.isLoading = false;
          console.log(result);
          if (result.success){
            this.alertService.success(result.message,true);
            localStorage.removeItem("editCvId");
            this.route.navigate(['/modulecard']);
          } else {
            this.authService.invalidSession(result);          
          }
        })
        //console.log(updateData);
      } else {
        this.authService.addChartVisual(updateData).subscribe( result =>{
          this.isLoading=false;
          if (result.success){
            this.alertService.success(result.message,true);
            this.route.navigate(['/modulecard']);
          } else {
            this.authService.invalidSession(result);          
          }
        })
      }
    } else {
      this.alertService.error("Form is not valid OR Chart is not verified");
    }
  }

  editChartVisual(chartId){
    this.isLoading = true;
    //console.log("inside edit "+chartId);
    this.chartId = chartId;
    this.pageTitle = "Edit Mode :: Editing Chart Id "+this.chartId;
    let chartData = {
      chartId: chartId
    }
    this.authService.getChartVisualForChartId(chartData).subscribe( cvData => {
      this.isLoading = false;
      //console.log(cvData);
      if (cvData.success){
        let cvIdDetails = this.chartVisualDetails = cvData.result[0];
        this.form.setValue({
          ChartTitle: cvIdDetails.chart_title,
          ChartDesc: cvIdDetails.chart_desc,
          Category: cvIdDetails.category,
          GlobalChartType: cvIdDetails.root_chart_type,
          StdQry: cvIdDetails.query.replace(/;/gi," ").trim(),
          DDChartId: cvIdDetails.dd_chart_id
          //AggrQry: cvIdDetails.aggr_query
        });
        this.dbQryConnectorName = cvIdDetails.query_connector_name == null ? "--select--":cvIdDetails.query_connector_name;
        this.dbQryConnectorId = cvIdDetails.db_connector_id_query == null ? null : cvIdDetails.db_connector_id_query;
        //this.dbAggrConnectorName = cvIdDetails.aggr_connector_name == null ? "--select--":cvIdDetails.aggr_connector_name ;
        this.qryEngineName = cvIdDetails.qry_engine_name;
        //this.aggrEngineName = cvIdDetails.aggr_engine_name;
        this.connectionString = cvIdDetails.qry_connection_details;
        this.hDisplay = cvIdDetails.h_display;
        this.enableYaxis = cvIdDetails.enable_yaxis;
        this.xaxisTimeScale = cvIdDetails.xaxis_time_scale;
        this.counterId = cvIdDetails.counter_id;
        this.selRootChart = cvIdDetails.root_chart_type == null || cvIdDetails.root_chart_type =='' ? "table" : cvIdDetails.root_chart_type;
        // if (cvIdDetails.query.length > 0){
        //   //console.log("qryEngineName "+this.qryEngineName);
        //   //console.log(cvIdDetails);
        //   this.onBlurStdQry();
        // }
      } else {
        console.log("inside getChartVisualCard no rows cond");
        this.isLoading = false;
        this.authService.invalidSession(cvData);
        this.alertService.error(cvData.message);
        }
      }, error => {
        this.isLoading = false;
        this.authService.invalidSession(error);
    });
  }
}
