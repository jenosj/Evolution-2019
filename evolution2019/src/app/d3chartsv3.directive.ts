import { Directive, ElementRef, Input, OnChanges, HostListener, OnDestroy, Output, EventEmitter } from '@angular/core';
import * as d3 from 'd3';
import * as _ from 'lodash';
import { AuthenticationService } from './_services/index';

//import * as Donut3D from '../../d3jsfiles/Donut3D.js';
//import constants from '../../../config/apd_constants';

@Directive({
  selector: '[appD3chartsv3]',
  outputs: ['onChartOutput']
})
export class D3chartsv3Directive {
  @Input('chartdata') chartData:any;
  @Input('width') parentWidth:number;
  @Input('height') parentHt:number;
  @Input('id') idx:number;
  @Input('chartType') rootChartType:String;
  
  onChartOutput = new EventEmitter();

  constants = {Currency: 'rs', NumberFormat: 'crore'}; //supported values are Crore, Million, thosands if not given will take thousands as default
  
  aryColors = [
    {"dark":"#9b61a7", "light":"#e2aded"}, {"dark":"#98cb65", "light":"#b8e888"},
    {"dark":"#f06c53", "light":"#ed9989"}, {"dark":"#f0ca4d", "light":"#f2d77d"}, 
    {"dark":"#00b9d9", "light":"#65e1f7"}, {"dark":"#a57d43", "light":"#dda85d"},
    {"dark": "#bca731", "light":"#f4d942"},{"dark":"#e88422", "light":"#f7bb80"},
    {"dark": "#bcb309", "light":"#e8de22"},{"dark":"#789932", "light":"#b4e549"},
    {"dark":"#d6b300", "light":"#ffd500"}, {"dark":"#cc0000", "light":"#ff0000"}
  ];

  // aryColors = [
  //   {"dark":"#0CF232", "light":"#e2aded"}, {"dark":"#0505FF", "light":"#b8e888"},
  //   {"dark":"#B7FFFD", "light":"#ed9989"}, {"dark":"#FF4C00", "light":"#f2d77d"}, 
  //   {"dark":"#0087FF", "light":"#65e1f7"}, {"dark":"#05FFFA", "light":"#dda85d"},
  //   {"dark": "#FFA114", "light":"#f4d942"},{"dark":"#A0F848", "light":"#f7bb80"},
  //   {"dark": "#192AE5", "light":"#e8de22"},{"dark":"#00FFFF", "light":"#b4e549"},
  //   {"dark":"#d6b300", "light":"#ffd500"}, {"dark":"#cc0000", "light":"#ff0000"}
  // ];
  margin; width:number; height:number;
  //Data related settings parentWidth:number; parentHt:number;
  totalRows; data=[]; allColCollection; chartTypeCollection; chartUnitJson; chartTypeKeys; colCollection = [];
  chartColCollection;
  //chart variables & for legend placement calculation
  conValue=1; outUnit; dispUnit ; chartUnit; dataMinMax=[]; 
  charPixWidthConValue=6; //for font 10
  charPixHtConValue=10; //for font 10
  legendWidthTotal = 5; lineWidth = 5; legendLine =1; nameMaxLength; valMaxLength; hDisplayLabel;
  //Axis and time scale settings
  timeFormat; tickFormat; axisLabel; xAxisScale; yAxisScale; xAxisRotate=0; axisLabelxPos; enableYaxis
  xAxisLabel; yAxisLabel; xaxisLabelWidth; x; y; xAxis; yAxis;  
  
  svg; svg1;
 
  constructor(
    private element: ElementRef,
    private authService: AuthenticationService
  ){
  } 
  ngOnInit(){

  }
  ngOnDestroy(){
    //console.log("inside ngOnDestroy in d3charts");
    this.chartData=null; this.parentWidth = null; this.parentHt = null; this.idx = null; this.rootChartType = null;
    this.totalRows=null; this.data=null; this.allColCollection=null; this.chartTypeCollection=null; 
    this.chartUnitJson=null; this.chartTypeKeys=null; this.colCollection=null; this.chartColCollection =null;
    this.timeFormat =null; this.tickFormat=null; this.axisLabel=null; this.xAxisScale=null; this.yAxisScale=null; 
    this.xAxisRotate=null; this.axisLabelxPos=null; this.enableYaxis=null;this.xAxisLabel=null; this.yAxisLabel=null; 
    this.xaxisLabelWidth=null; this.x=null; this.y=null; this.xAxis=null; this.yAxis=null; 
  }

  ngOnChanges(){
    //console.log(this.parentWidth +" "+ this.parentHt);
    if(this.parentWidth == 9999 ){
      console.log("inside parent width==9999");
      this.parentWidth = this.element.nativeElement.offsetWidth ;
      this.parentHt = 500;
      
      this.drawCharts(); 
    } else {
      this.drawCharts(); 
    }
    //console.log('inside ngonchanges parent ' +this.parentWidth+' '+this.parentHt);
    //console.log('inside ngonchnges ' +this.width+' '+this.height);

    //    console.log("this.element.nativeElement");
    d3.select(this.element.nativeElement).select('svg').remove();
//    console.log("Width: "+this.width+' Height: '+this.height);
  }

  async drawCharts(){
    //console.log("chartData.data.length", this.chartData.data);
    this.chartColCollection =[]; 
    //console.log('inside drawcharts ' +this.parentWidth+' '+this.parentHt);
    //console.log("inside drawCharts");
    if ("error" in this.chartData){
      console.log("error found in data retrieval, please check the server log");
      return false;
    }
    
    if (this.chartData.data.length == 0) {
      console.log("chartData.data.length", this.chartData.length);
      let txt = "No Data to display this Chart";
      this.svg1 = d3.select(this.element.nativeElement).append("svg")
      .attr("width", this.width )
      .attr("height", this.height)
      .append("text")
      .attr("font-size","16px")
      .style("text-transform", "capitalize")
      .style("fill","var(--orange)")
      .attr("y", this.height/2)
      .attr("x", this.width/2-txt.length*7/2)
      .attr("opacity",1)
      .text(txt);
      return false;
    }

    let varSetting = await this.varSetting();
    //Data preparation which converts the value to human readable. adding legend and its position.
    let dataPreparation = await this.dataPreparation();
    //Getting the first column label name and making it as axis label.
    //setting datetime format if x axis is time scale. 
    let settingDateFormat = await this.settingDateFormat();
    //console.log(this.chartData);
    if (this.rootChartType != 'pie' &&  this.rootChartType !='donut' && this.rootChartType != 'pie3d' && this.rootChartType != 'donut3d'){
      //setting ordinal or linear scale for x and y axis according to chart type
      let initializeAxis = await this.initializeAxis();
      let plotChart = await this.plotChart(this.x, this.y);  
    } else {
      //console.log(this.chartColCollection[0]);
      if (this.rootChartType == 'pie' ||  this.rootChartType =='donut')
        this.pie(this.data, this.chartColCollection[0]);
      else
        this.pie3d(this.data, this.chartColCollection[0]);
    }
  }

  async plotChart(xScale,yScale) {
    //console.log("inside plotchart");
    //console.log(this.chartColCollection);
    this.chartColCollection.map((colElement, i) => {
    //      console.log(this.chartData);
      let Data = this.chartData;
      let chartType = Data.chart_types_json[colElement];
      //console.log("chartType "+chartType);
      let legendText = Data[colElement + "_legend_text"];
      let legendLineData = Data[colElement + "_legend_line"];
      let legendX = Data[colElement + "_legend_start_pos_x"];
      let cnt = i.toString();
      let circleRadius = Data.data.length > 5 ? 1 : 3;
      let dataMaximum = 1;
      if (chartType != 'pie' && chartType != 'donut' && chartType != 'pie3d' && chartType !='donut3d')
        dataMaximum = this.dataMinMax[1];
      if (Data.data.length > 0 && dataMaximum > 0) {
        if (chartType == 'area') {
            let iid = +this.idx+i;
            let randNum = iid%(this.aryColors.length-2);
            this.area(Data.data, colElement + "_hunit", randNum, chartType, cnt, circleRadius,xScale,yScale);
            this.line(Data.data, colElement + "_hunit", randNum,0,50,50,false,chartType,cnt,circleRadius,xScale,yScale);
            this.callLegend(randNum,cnt,legendLineData,legendX,legendText);
        }
        else if (chartType == 'line'){
          if (colElement == Data["col_critical"]){
            this.line(Data.data, colElement + "_hunit", 2, 3, 100, 50, true, chartType, cnt, circleRadius,xScale,yScale);
            this.callLegend(11,cnt,legendLineData,legendX,legendText);
          } else if (colElement == Data["col_warning"]){
            this.line(Data.data, colElement + "_hunit", 3, 3, 100, 25, true, chartType, cnt, circleRadius,xScale,yScale);
            this.callLegend(10,cnt,legendLineData,legendX,legendText);
          } else {
            this.line(Data.data,colElement+"_hunit",i,0,50,50,true,chartType, cnt, circleRadius,xScale,yScale); 
          }
        } else if (chartType =='vbar'){
          this.vbar(Data.data,cnt,colElement+"_hunit", xScale,yScale);
          this.callLegend(10,cnt,legendLineData,legendX,legendText);
        } else if (chartType =='hbar') {
          //console.log("inside drawing hbar");
          this.hbar(Data.data,cnt,colElement+"_hunit", chartType, xScale,yScale);
          if (!this.hDisplayLabel){
            this.callLegend(10,cnt,legendLineData,legendX,legendText);            
          }
        }
        // else if (chartType == 'pie' || chartType =='donut'){pie(data,colElement+"_hunit", chartType,i); }
      }
      else {
        if (!this.hDisplayLabel) {
          //          noChartText();
        }
      }
      if (this.rootChartType != 'pie' && this.rootChartType != 'donut' && this.rootChartType != 'pie3d' && this.rootChartType !='donut3d'){
        this.tooltip(this.chartData.data, chartType, xScale,yScale)
      }
    });
  }
  private noChartText(){
    this.svg1
      .append("text")
      .attr("class", "text")
      .attr("font-size","16px")
      .attr("fill","hsl(" + Math.random() * 360 + ",50%,50%)")
      .style("text-transform", "capitalize")
      .attr("y", this.height/2)
      .attr("x", this.width*0.4)
      .attr("opacity",1)
      .text("No Data to display this Chart");
  }
  async varSetting() {
    this.data = []; this.allColCollection =[];this.chartUnitJson=[];this.chartTypeCollection=[];this.chartTypeKeys=[];
    // this.parentWidth = this.width;
    // this.parentHt = this.height;
    this.margin = { top: 10, right: 35, bottom: 15, left: 35 };
    this.width = this.parentWidth - this.margin.left - this.margin.right;
    this.height = this.parentHt - this.margin.top - this.margin.bottom;
    //console.log("pw " + this.parentWidth + " ph " + this.parentHt + " wi " + this.width + " ht " + this.height);
    //for legend and graph axis adjustment based on width of the data- Settings
    this.legendWidthTotal = 15;
    this.lineWidth = 15;
    this.legendLine = 1;
    this.nameMaxLength = 0, this.valMaxLength = 0;
    //Data Massage
    this.data = this.chartData.data;
    this.totalRows = this.data.length;
    this.hDisplayLabel = this.chartData.h_display; //This is used to display the label and height of the chart. height is based on total rows. label is display just above the chart
    this.enableYaxis = this.chartData.enable_yaxis;
    //arranging data chart type wise. 
    this.allColCollection = _.keys(this.chartData.chart_types_json);
    //console.log("this.allColCollection");     console.log(this.allColCollection);
    this.chartUnitJson = this.chartData.col_units_json;
    //invertBy will transform values to keys and group keys into set of array for each of the chart type (chart type are values in original array
    this.chartTypeCollection = _.invertBy(this.chartData.chart_types_json);
    //console.log("this.chartTypeCollection");console.log(this.chartTypeCollection);
    this.chartTypeKeys = _.keys(this.chartTypeCollection);
    //console.log("this.chartTypeKeys "+this.chartTypeKeys.length);console.log(this.chartTypeKeys);
    // getting all the coloumn for which chart has to be drawn
    this.colCollection=[];
    for (let k = 0; k < this.chartTypeKeys.length; k++) {
      if (this.chartTypeKeys[k].toLowerCase() != "tooltip")
        this.colCollection.push(this.chartTypeCollection[this.chartTypeKeys[k]]);
    }
    // _.flatten will bring one simple array list from multiple array in collection
    this.chartColCollection = _.flatten(this.colCollection);
    //console.log("this.chartColCollection"); console.log(this.chartColCollection);
    return true;
  }

  async settingDateFormat() {
    let al = d3.keys(this.data[0])[0];
    this.axisLabel = al.replace('_', ' ').replace('-', ' ');
    if (this.chartData.xaxis_time_scale) {
      let timeMinMax = d3.extent(this.data, function (d, i) { return Number(d[al]); });
      let stDate = (new Date(new Date().toDateString())).getTime();
      this.timeFormat = timeMinMax[0] > stDate ? "%H:%M" : "%d-%b %H:%M";
      this.tickFormat = d3.timeFormat(this.timeFormat);
      this.data.map((dataElm, idx) => {
        dataElm.label = this.tickFormat(new Date(Number(dataElm[al])));
        this.nameMaxLength = this.nameMaxLength < dataElm.label.length ? dataElm.label.length : this.nameMaxLength;
      });
    } else {
      //Keeping the width of the value less than 15 characters for non date value column.
      this.data.map((dataElm, idx) => {
        //console.log(dataElm);
        let type = typeof(dataElm[al]);
        let leng = type === 'number' ? dataElm[al].toString().length : dataElm[al].length;
        //console.log(type);
        //console.log (leng);
        if ( leng > 15 ) {
          dataElm.label = (dataElm[al].substring(1, 10) + '..' + idx.toString()).toLowerCase();
          this.nameMaxLength = this.nameMaxLength < dataElm.label.length ? dataElm.label.length : this.nameMaxLength;
        }
        else if (leng != 0) {
          //console.log(dataElm[al]);
          //console.log(typeof(dataElm[al]));
          dataElm.label = type === 'number' ? dataElm[al] : (dataElm[al]).toLowerCase();
          this.nameMaxLength = this.nameMaxLength < dataElm.label.length ? dataElm.label.length : this.nameMaxLength;
        }
      });
    }
    return true;
  }

  private initializeAxis() {
    if (this.rootChartType.toLowerCase() == 'hbar') {
      this.yAxisScale = 'ordinal';
      this.xAxisScale = 'linear';
    } else {
      this.yAxisScale = 'linear';
      this.xAxisScale = 'ordinal';
    }
    if (this.rootChartType.toLowerCase() != 'hbar') {
      let totalWidth = this.totalRows > 15 ? this.nameMaxLength * 15 * this.charPixWidthConValue : this.nameMaxLength * this.totalRows * this.charPixWidthConValue;
      //when the legend width is more than size of the width then legends are rotated by 30 degree. and realigned the margin 
      if (totalWidth > this.width) {
        this.xAxisRotate = -30;
        this.margin.left = this.margin.left + 15 + Math.ceil(this.nameMaxLength * 0.25);
      }
    }
    //setting revised height, width and margins based on the formated data.
    if (this.xAxisScale == 'linear') {
      this.xAxisLabel = ' '; //old outUnit
      this.xaxisLabelWidth = this.xAxisLabel.length;
      if (Math.abs(this.xAxisRotate) > 0) {
        //this.height = this.height + Math.ceil(this.valMaxLength / 2);
        this.margin.bottom = this.margin.bottom + 15 + this.charPixWidthConValue * Math.ceil(this.valMaxLength / 2);
      }
    }
    else {
      this.xAxisLabel = this.axisLabel;
      this.xaxisLabelWidth = this.xAxisLabel.length;
      if (Math.abs(this.xAxisRotate) > 0) {
        //this.height = this.height + Math.ceil(this.nameMaxLength / 2);
        this.margin.bottom = this.margin.bottom + 15 + Math.ceil(this.nameMaxLength * 0.5);
        //this.height= this.height-this.margin.bottom;
        //console.log("inside xaxis rotate "+this.height);
      }
    }
    if (this.yAxisScale == 'linear') {
      this.yAxisLabel = " "; //old value hardcoded
      this.axisLabelxPos = 5;
      this.margin.left = this.enableYaxis ? this.margin.left > this.charPixWidthConValue * this.valMaxLength + 15 ? this.margin.left : this.charPixWidthConValue * this.valMaxLength + 15 : this.margin.left;
      this.width = this.parentWidth - this.margin.right - this.margin.left;
    }
    else {
      this.yAxisLabel = this.axisLabel;
      this.axisLabelxPos = this.yAxisLabel.length * 4;
      this.margin.left = this.enableYaxis ? this.margin.left > this.charPixWidthConValue * this.nameMaxLength + 15 ? this.margin.left : this.charPixWidthConValue * this.nameMaxLength + 15 : this.margin.left;
      //console.log("margin-left ")
      //console.log(this.margin);
      //console.log(this.parentWidth,this.width,this.parentHt, this.height);
      this.width = this.parentWidth - this.margin.right - this.margin.left;
      //console.log(this.parentWidth,this.width,this.parentHt, this.height);
    }
    //implemented to increase the height for legends
    //this.height = this.height + this.legendLine * this.charPixHtConValue;
    this.margin.bottom = this.margin.bottom + (this.legendLine) * this.charPixHtConValue+15;
    this.height= this.height-this.margin.bottom;

    //setting domain, ticks for axis
    if (this.xAxisScale == 'ordinal') {
           // console.log("inside xaxis domain "+this.width);
      this.x = d3.scaleBand().range([0, this.width]);
      this.x.domain(this.data.map(d => d["label"]));
      //      this.x.rangeRound([0,this.width]).padding(0);
    }
    else {
      //console.log(this.dataMinMax); console.log("inside xaxis domain "+this.width);
      this.x = d3.scaleLinear().range([0, this.width]);
      this.x.domain([this.dataMinMax[0], this.dataMinMax[1]]);
    }
    if (this.yAxisScale == 'linear') {
      this.y = d3.scaleLinear().range([this.height, 0]);
      this.y.domain([Number(this.dataMinMax[0]), Number(this.dataMinMax[1])]);
    }
    else {
      this.y = d3.scaleBand().rangeRound([0,this.height]);
      this.y.domain(this.data.map(d => d["label"]));
    }
    if (this.xAxisScale == 'ordinal') {
      let trows = this.totalRows;
      this.xAxis = d3.axisBottom(this.x)
        .tickValues(this.x.domain().filter(function (d, i) { return !(i % (Math.ceil(trows / 15))); }));
    }
    else {
      this.xAxis = d3.axisBottom(this.x);
    }
    this.yAxis = d3.axisLeft(this.y).ticks(5);
    //setting base svg common for all graphs
    this.svg1 = d3.select(this.element.nativeElement).append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom);
    this.svg = this.svg1
      .append("g")
      .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
      //creating xaxis and y axis
    this.svg.append("g")
      .attr("class", "x axis")
      .attr("id", "xaxis")
      .attr("transform", "translate(0," + this.height + ")")
      .call(this.xAxis)

    if (this.xAxisRotate == -30) {
      this.svg.select("g").selectAll("text")
        .attr("transform", "rotate(" + this.xAxisRotate + ")")
        .attr("y", "0")
        .attr("x", "-5")
        .attr("dy", ".55em")
        .attr("class","capitalize")
        .style("text-anchor", "end");
    }
    this.svg.selectAll("#xaxis").append("text")
      .attr("transform", "rotate(0)")
      .attr("x", this.parentWidth - this.margin.right - this.xaxisLabelWidth * this.charPixWidthConValue / 2)
      .attr("y", 30)
      .style("text-transform", "capitalize")
      .style("text-anchor", "end")
      .style("opacity", "1")
      .text(this.xAxisLabel);

    if (this.enableYaxis) {
      this.svg.append("g")
        .attr("class", "y axis capitalize")
        .attr("id", "yaxis")
        .call(this.yAxis);
      this.svg.selectAll("#yaxis").append("text")
        .attr("transform", "rotate(0)")
        .attr("y", -10)
        .attr("x", this.axisLabelxPos)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(this.yAxisLabel);
    }
    else {
      this.svg.append("g")
        .attr("class", "y axis")
        .append("text")
        .attr("transform", "rotate(0)")
        .attr("y", -10)
        .attr("x", this.axisLabelxPos)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(this.yAxisLabel);
    }
    return true;
  }

  async dataPreparation() {
    this.allColCollection.map((dispEle, Idx) => {
      let dataMinMaxSel = d3.extent(this.data, function (d) { return Number(d[dispEle]); });
      let chartUnit = this.chartUnitJson[dispEle] == undefined ? "number" : this.chartUnitJson[dispEle].toLowerCase();
      let valToConvert;
      if (chartUnit == "bytes" || chartUnit == "bps" || chartUnit == "kbps" || chartUnit == "mbps" || chartUnit == "gbps" || chartUnit == "kb" || chartUnit == "mb" || chartUnit == "gb") {
        if (dataMinMaxSel[0] > 0) {
          valToConvert = dataMinMaxSel[0];
        }
        else {
          valToConvert = dataMinMaxSel[1];
        }
        this.sizeConv(chartUnit, valToConvert).then(result => {
          this.chartData[dispEle + "_out_unit"] = result.outUnit;
          this.chartData[dispEle + "_legend_text"] = dispEle+ "("+result.outUnit+")";
          this.chartData[dispEle + "_conv_value"] = result.conValue;
          //Setting the min and max value for Axis calculation.
          this.setMinMaxVal(dispEle, this.chartColCollection, dataMinMaxSel).then(result =>{
            this.dataHumanReadable(dispEle);
          });
        });
      }
      else if (chartUnit == "ms" || chartUnit == "sec" || chartUnit == "min" || chartUnit == "hour") {
        if (dataMinMaxSel[0] > 0) {
          valToConvert = dataMinMaxSel[0];
        }
        else {
          valToConvert = dataMinMaxSel[1];
        }
        this.timeConv(chartUnit, valToConvert).then(result => {
          this.chartData[dispEle + "_out_unit"] = result.outUnit;
          this.chartData[dispEle + "_legend_text"] = dispEle+ "("+result.outUnit+")";
          this.chartData[dispEle + "_conv_value"] = result.conValue;
          //Setting the min and max value for Axis calculation.
          this.setMinMaxVal(dispEle, this.chartColCollection, dataMinMaxSel).then(result =>{
            this.dataHumanReadable(dispEle);
          });
        });
      }
      else if (chartUnit == "count" || chartUnit == "number" || chartUnit == "rs" || chartUnit == "lakh" || chartUnit == "crore" || chartUnit == "" || chartUnit == 'million' || chartUnit == 'billion') {
        if (dataMinMaxSel[0] > 0) {
          valToConvert = dataMinMaxSel[0];
        }
        else {
          valToConvert = dataMinMaxSel[1];
        }
        if (chartUnit == "") {
          chartUnit = 'count';
        }
        ;
        this.numberConv(chartUnit, valToConvert).then(result => {
          this.chartData[dispEle + "_out_unit"] = result.outUnit;
          this.chartData[dispEle + "_legend_text"] = dispEle+ "("+result.outUnit+")";
          this.chartData[dispEle + "_conv_value"] = result.conValue;
          //Setting the min and max value for Axis calculation.
          this.setMinMaxVal(dispEle, this.chartColCollection, dataMinMaxSel).then(result =>{
            this.dataHumanReadable(dispEle);
          });
        });
      }
      else {
        this.chartData[dispEle + "_out_unit"] = chartUnit;
        this.chartData[dispEle + "_legend_text"] = dispEle+ "("+chartUnit+")";
        this.chartData[dispEle + "_conv_value"] = 1;
        //Setting the min and max value for Axis calculation.
        this.setMinMaxVal(dispEle, this.chartColCollection, dataMinMaxSel).then(result =>{
          this.dataHumanReadable(dispEle);
        });
      }
    });
    return true;
  }

  private dataHumanReadable(dispEle: any) {
    /* Based on width of legend text, line number is assigned to the legend */
    /* calculation for legend space and width */
    //1px spacing is given for each letter and hence added that for the width calculation
    /* tooltip column type are not considered for legend width calculation */
    //console.log("dispEle "+dispEle+" chartType "+this.chartData.chart_types_json[dispEle]);
    if (this.chartData.chart_types_json[dispEle].toLowerCase() != "tooltip")
    {
      if ((this.chartData[dispEle+"_legend_text"].length * this.charPixWidthConValue + this.chartData[dispEle+"_legend_text"].length  + 5 + this.lineWidth) > this.parentWidth) {
      this.lineWidth = 15;
      this.legendLine++;
      this.chartData[dispEle + "_legend_start_pos_x"] = this.lineWidth;
      this.chartData[dispEle + "_legend_line"] = this.legendLine;
      this.lineWidth += this.chartData[dispEle+"_legend_text"].length * this.charPixWidthConValue + this.chartData[dispEle+"_legend_text"].length  + 20;
      }
      else {
        this.chartData[dispEle + "_legend_start_pos_x"] = this.lineWidth;
        this.lineWidth += this.chartData[dispEle+"_legend_text"].length * this.charPixWidthConValue + this.chartData[dispEle+"_legend_text"].length + 20;
        this.chartData[dispEle + "_legend_line"] = this.legendLine;
      }
    }
    //converting all the value into human readable unit only for elements that are mapped in unit_cols and getting max length of the value 
    this.data.map((dataElm, idx) => {
      dataElm[dispEle + '_hunit'] = parseFloat((+dataElm[dispEle] * this.chartData[dispEle + "_conv_value"]).toFixed(2));
      this.valMaxLength = this.valMaxLength < Math.round(dataElm[dispEle + '_hunit']).toString().length ? Math.round(dataElm[dispEle + '_hunit']).toString().length : this.valMaxLength;
    });
  }
  private pie(data,chCol){
    let arrClr = this.aryColors;
    this.svg = d3.select(this.element.nativeElement).append("svg")
                .attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom);
    let radius = Math.min(this.width,this.height)/2;
    
    let g = this.svg.append("g").attr("transform", "translate(" + (+radius+10) + "," + this.height / 2 + ")");
    let innerRadius;
    // Generate the pie
    let pie = d3.pie().value(function(d){return d[chCol]});
    if (this.rootChartType=='pie') innerRadius = 0;
    else innerRadius = radius-30;

    // Generate the arcs/path
    let path = d3.arc()
                 .innerRadius(innerRadius)
                 .outerRadius(radius-5);

    //Generate groups
    let arc = g.selectAll("arc")
               .data(pie(data))
               .enter()
               .append("g")
               .attr("class", "arc");

    //Draw arc paths
    arc.append("path")
        .attr("fill", function(d, i) {
            return arrClr[i% (arrClr.length-2)].dark;
        })
        .attr("d", path);

    /* legend printing */
    let svgLegend = this.svg.append("g").attr("class", "legend");
    let legendRectSize = 10;
    let legendSpacing = 10;
    svgLegend.attr("transform","translate(" + (+radius*2+20) + "," + (+this.margin.top+20)+ ")");
    
    let legend = svgLegend.selectAll('.legend')
			                    .data(data)
			                    .enter()
			                    .append('g')
                          .attr('class', 'legend');
    
    legend.append('rect')
          .attr('width', legendRectSize)
          .attr('height', legendRectSize)
          .attr('x', '0')
          .attr('y', function(d,i){var j=i%10;return (j*15-legendRectSize);})
          .style('fill', function(d,i){return arrClr[i%(arrClr.length-2)].dark;})
          .style('stroke', function(d,i){return arrClr[i%(arrClr.length-2)].dark;});

    legend.append('text')
          .attr('x', (+legendRectSize+legendSpacing))
          .attr('y',function(d,i){var j =i%10; return j*15;} )
          .attr('class','capitalize font_12')
          .text(function(d){return d.label+' ('+d[chCol]+')'} )
          .style('fill', '#fff');
  }

  private pie3d(data,chCol){
    let arrClr = this.aryColors;
    this.svg = d3.select(this.element.nativeElement).append("svg")
                .attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom);

    let radius = Math.min(this.width,this.height)/2;
    let x = +radius+10;
    let y = this.height/2;
    let innerRadius;
    if (this.rootChartType=='pie3d') innerRadius = 0;
    else innerRadius = 0.4;
    //Donut3D.draw()
    //console.log(Donut3D);
    this.draw3dPie("pie3d",data,x,y,x-20,y-20,30,innerRadius, this.svg,arrClr,chCol);
    /* legend printing */
    let svgLegend = this.svg.append("g").attr("class", "legend");
    let legendRectSize = 10;
    let legendSpacing = 10;
    svgLegend.attr("transform","translate(" + (+radius*2+20) + "," + (+this.margin.top+20)+ ")");
    
    let legend = svgLegend.selectAll('.legend')
			                    .data(data)
			                    .enter()
			                    .append('g')
                          .attr('class', 'legend');
    
    legend.append('rect')
          .attr('width', legendRectSize)
          .attr('height', legendRectSize)
          .attr('x', '0')
          .attr('y', function(d,i){var j=i%10;return (j*15-legendRectSize);})
          .style('fill', function(d,i){return arrClr[i%(arrClr.length-2)].dark;})
          .style('stroke', function(d,i){return arrClr[i%(arrClr.length-2)].dark;});

    legend.append('text')
          .attr('x', (+legendRectSize+legendSpacing))
          .attr('y',function(d,i){var j =i%10; return j*15;} )
          .attr('class','capitalize font_12')
          .text(function(d){return d.label+' ('+d[chCol]+')'} )
          .style('fill', '#fff');

  }

  private hbar(data,cnt,chCol,chartType, xScale,yScale){
    //console.log("inside hbar");
    //console.log(data);
    //console.log("chCol "+ chCol)
    let arrClr = this.aryColors;
    this.svg.selectAll(".hbar")
      .data(data)
      .enter().append("rect")
      .attr("transform", function(d) { return "translate( 0," + (yScale.bandwidth()/4) + ")"; })
      .attr("id",this.idx)
      .attr("width",function(d) { return  Math.abs(xScale(d[chCol]) ); }) 
      .attr("x", 0 )
      .attr("y", function(d) { return ( yScale(d.label)); }) 
      .attr("height", yScale.bandwidth()*0.5 )
      .style("fill", function(d,i){ return arrClr[i % (arrClr.length-2)].light});

      //placing legend for each bar above bar itself 
      if (this.hDisplayLabel){
        this.svg.selectAll(".bartext")
          .data(data)
          .enter()
          .append("text")
          .attr("id",chartType+"hbar"+cnt)
          .attr("class", "bartext")
          .attr("font-size","12px")
          .attr("y", function(d){return yScale(d.label)+yScale.bandwidth()*0.2;})
          .attr("x", 5)
          .text(function(d){return d.legendText;});
      }

  }
  
  private vbar(data,cnt,chCol, xScale,yScale){
    let ht = this.height;
    let arrClr = this.aryColors;
    this.svg.selectAll(".vbar")
      .data(data)
      .enter().append("rect")
      .attr("transform", function(d) { return "translate(" + (xScale.bandwidth()/4) + ",0)"; })
      .attr("id",this.idx)
      .attr("width",xScale.bandwidth()*0.5) 
      .attr("x", function(d) { return xScale(d.label); })
      .attr("y", function(d) {return Math.abs(yScale(d[chCol]));}) 
      .attr("height", function(d) { return ht - yScale(d[chCol]); })
      .style("fill", function(d,i){ return arrClr[i % (arrClr.length-2)].light});
  }
  
  private area(data,legend,randNum,chartType,cnt,circleRadius,xScale,yScale){
    let chartColor = this.aryColors[randNum];
    let svgArea = d3.area().x(function(d){return xScale(d.label)+xScale.bandwidth()/2;}).y0(this.height-1).y1(function (d){return yScale(d[legend]);});
    this.svg.append("path")
      .attr("class", "area")
      .attr("id",this.idx+""+cnt)
      .style("fill",chartColor.light)
      .attr("d", svgArea(data))
      .attr("opacity","1");
  }

  private line(data, legend, randNum,dash,saturation,lightness,writeLegend,chartType,cnt,circleRadius,xScale,yScale){
    var drawLegend = writeLegend;
    if (legend!=this.chartData["col_critical"]+"_hunit" && legend != this.chartData["col_warning"]+"_hunit") randNum = randNum%(this.aryColors.length-2);
    else if (legend==this.chartData["col_critical"]+"_hunit")  randNum = 11;
    else if (legend==this.chartData["col_warning"]+"_hunit") randNum = 10;
    var chartColor = this.aryColors[randNum];

    let svgline = d3.line()
      .x(function(d) { return xScale(d.label)+xScale.bandwidth()/2;})
      .y(function(d){ return yScale(d[legend]);});
    
    this.svg.append("path")
      .attr("class", "line")
      .attr("id",this.idx+""+cnt)
      .attr("stroke", chartColor.dark)
      .style("stroke-dasharray", "5,"+dash)
      .attr("fill","none")
      .attr("d", svgline(data));
    
    //    for non critical and warning line draw the dots
    if (dash==0){
      this.svg.selectAll("dot")	
        .data(data)			
        .enter().append("circle")								
        .attr("r", circleRadius)		
        .attr("id",this.idx+""+cnt)
        .style("fill", chartColor.dark)
        .attr("cx", function(d) { return xScale(d.label)+xScale.bandwidth()/2; })		 
        .attr("cy", function(d) { return yScale(d[legend]); })
        .attr("opacity","1");
    }
  }
  
  //Legend Call
  private callLegend(randNum,cnt,legendLineData,legendX,legendText){
    let chartColor = this.aryColors[randNum];
    this.svg1.append("rect")
    .attr("x", legendX-12)
    .attr("y", (this.legendLine >1 ? this.height+this.margin.bottom/2+legendLineData*15+5 : this.height+this.margin.bottom+5)-10)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", chartColor.light)
    .attr("border","1px solid "+chartColor.dark);

    this.svg1
      .append("text")
      .attr("class", "text")
      .attr("id","legendText"+this.idx+cnt)
      .attr("font-size","12px")
      .attr("font-family","Helvetica Neue")
      .style("text-transform", "capitalize")
      .style("letter-spacing","1px")
      .attr("y", this.legendLine >1 ? this.height+this.margin.bottom/2+legendLineData*15+5 : this.height+this.margin.bottom+5)
      .attr("x", legendX)
      .attr("opacity",1)
      .text(legendText);
  }

  
          
  async setMinMaxVal(dispEle: any, chartColCollection: any, dataMinMaxSel: any) {
    if (_.indexOf(chartColCollection, dispEle) != -1) {
      if (this.dataMinMax.length == 0) {
        this.dataMinMax[0] = dataMinMaxSel[0] * this.chartData[dispEle + "_conv_value"];
        this.dataMinMax[1] = dataMinMaxSel[1] * this.chartData[dispEle + "_conv_value"];
      }
      else {
        if (this.dataMinMax[0] > dataMinMaxSel[0] * this.chartData[dispEle + "_conv_value"])
          this.dataMinMax[0] = dataMinMaxSel[0] * this.chartData[dispEle + "_conv_value"];
        if (this.dataMinMax[1] < dataMinMaxSel[1] * this.chartData[dispEle + "_conv_value"])
          this.dataMinMax[1] = dataMinMaxSel[1] * this.chartData[dispEle + "_conv_value"];
      }
    }
  }

  async precisionRound(number, precision) {
    var factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
  }
  
  //Size conversion function					
  async sizeConv(inUnit,inVal){
    let inUn = inUnit.toLowerCase();
    let unit = inUn.substring(0,1);
    let outSize={outUnit:"",dispUnit:"",conValue:1};
    if (inUn=="bytes" || inUn=="bps" || inUn=="kbps" || inUn=="mbps" || inUn=="gbps"||inUn=="kb"|| inUn=="mb"||inUn=="gb"){
      //converting to base unit before conversion
      if (unit=="b"){inVal=inVal;}
      else if (unit=="k" ){inVal=inVal*1024;}
      else if (unit=="m"){inVal=inVal*1024*1024;}
      else {inVal=inVal*1024*1024*1024;}
        
      if (inVal<1024){
        outSize.outUnit= "Bytes" ; outSize.dispUnit="Bytes";
        outSize.conValue = unit=="b"? 1 : unit=="k" ? 1024 : unit=="m" ? 1024*1024 : 1024*1024*1024 ;
      }
      else if (inVal>=1024 && inVal<1048576){
        outSize.outUnit="KB" ; outSize.dispUnit="KB";
        outSize.conValue= unit=="b"? 1/1024 : unit=="k" ? 1 : unit=="m" ? 1024 : 1024*1024 ;
      }
      else if (inVal>=1048576 && inVal<1073741824){
        outSize.outUnit="MB" ; outSize.dispUnit="MB"
        outSize.conValue= unit=="b"? 1/(1024*1024) : unit=="k" ? 1/1024 : unit=="m" ? 1 : 1024 ;
      }
      else if (inVal>=1073741824){
        outSize.outUnit="GB" ; outSize.dispUnit="GB";
        outSize.conValue= unit=="b"? 1/(1024*1024*1024) : unit=="k" ? 1/(1024*1024) : unit=="m" ? 1/1024 : 1 ;
      }
    }
    return outSize;
  }
            
  //Time conversion					
  async timeConv(inUnit,inVal){
    let inUn = inUnit.toLowerCase();
    let outTime={outUnit:"",dispUnit:"",conValue:1};
    if(inUn=='ms'||inUn=='milliseconds'||inUn=='millisec') inUn='ms';
    if(inUn=='sec'||inUn=='seconds'||inUn=='s') inUn='sec';
    if(inUn=='hours'||inUn=='hr'||inUn=='h') inUn='hour';
    if (inUn=="ms" || inUn=="sec" || inUn=="min" || inUn=="hour"){
      //convert to base unit
      if (inUn=='ms'){inVal=inVal;}
      else if (inUn=='sec'){inVal=inVal*1000;}
      else if (inUn=='min'){inVal=inVal*60*1000;}
      else if (inUn=='hour'){inVal=inVal*60*60*1000;}
      else {inVal=inVal*24*60*60*1000;}

      if (inVal<1000){
        outTime.outUnit ='ms'; outTime.dispUnit="ms";
        outTime.conValue = inUn=='ms'?1 : inUn=='sec' ? 1000 : inUn=='min' ? 1000*60 : inUn=='hour'? 1000*60*60 : 1000*60*60*24;
      }
      else if (inVal>=1000 && inVal<60000){
        outTime.outUnit ='Seconds'; outTime.dispUnit="sec";
        outTime.conValue = inUn=='ms'?1/1000 : inUn=='sec' ? 1 : inUn=='min' ? 60 : inUn=='hour'? 60*60 : 60*60*24;
      }
      else if (inVal>=60000 && inVal<3600000){
        outTime.outUnit ='Minutes'; outTime.dispUnit="min";
        outTime.conValue = inUn=='ms'?1/(60*1000) : inUn=='sec' ? 1/60 : inUn=='min' ? 1 : inUn=='hour'? 60 : 60*24;
      }
      else if (inVal>=3600000 && inVal<216000000){
        outTime.outUnit ='Hours'; outTime.dispUnit="hrs";
        outTime.conValue = inUn=='ms'?1/(60*60*1000) : inUn=='sec' ? 1/(60*60) : inUn=='min' ? 1/60 : inUn=='hour'? 1 : 24;
      }
      else if (inVal>=216000000){
        outTime.outUnit ='Days'; outTime.dispUnit="days";
        outTime.conValue = inUn=='ms'?1/(24*60*60*1000) : inUn=='sec' ? 1/(24*60*60) : inUn=='min' ? 1/(24*60) : inUn=='hour'? 1/24 : 1;
      }
    }
    return outTime;
  }
          
  async numberConv(inUnit,inVal){
    let inUn = inUnit==undefined? "count" : inUnit.toLowerCase();

    let outNumCov={outUnit:"",dispUnit:"",conValue:1};
    let numberFormat = this.constants.NumberFormat.toLowerCase();
    if (numberFormat.length==0) numberFormat = "thousand";

    if(inUn=="count" || inUn == "counts") inUn='count';
    if(inUn=="number" || inUn == "numbers" || inUn == "") inUn='number';
    if(inUn=="rs"|| inUn=="rupees") inUn="rs";
    if(inUn=="lakhs"|| inUn=="lakh"||inUn=="lac") inUn="lakh";	
    if(inUn=="crores"|| inUn=="crore"||inUn=="cr") inUn="crore";
    if(inUn=="million"|| inUn=="millions"||inUn=="m") inUn="million";	
    if(inUn=="billion"|| inUn=="billions"||inUn=="b") inUn="billion";	
    
      //convert to base unit
      if (inUn=='count' || inUn=='number'||inUn=='rs'){inVal=inVal;}
      else if (inUn == 'lakh'){inVal=inVal*100000;}
      else if(inUn == 'crore') {inVal=inVal*10000000;}
      else if (inUn == 'million'){inVal=inVal*1000000;}
      else {inVal=inVal*100000000;}

    if (inVal < 1000){
      outNumCov.outUnit = inUn; 
      outNumCov.dispUnit = inUn;
      outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1 : inUn=='lakh' ? 100000 : inUn=='million'? 1000000: inUn=='crore'?10000000 : 100000000;
    }
    else if (inVal>=1000 && inVal<100000 ){
      if (numberFormat == "crore"){
        outNumCov.outUnit = 'x000'; outNumCov.dispUnit = 'x000';
        outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/1000 : inUn=='lakh' ? 100 : 10000 ;
      }
      else {
        outNumCov.outUnit = 'x000'; outNumCov.dispUnit = 'x000';
        outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/1000 : inUn=='million' ? 1000 : 100000 ;
      }
    }
    //lakh & crore conversion
    else if (inVal>=100000 && inVal < 10000000 && numberFormat =='crore'){
      outNumCov.outUnit = "lakhs"; outNumCov.dispUnit = "lakhs";
      outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/100000 : inUn=='lakh' ? 1 : 100;
    }
    else if (inVal >= 10000000 && numberFormat =='crore'){
      outNumCov.outUnit = "crores"; outNumCov.dispUnit = "crores";
      outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/10000000 : inUn=='lakh' ? 1/100 : 1;
    }
    //million conversion
    else if (inVal>=100000 && inVal<1000000 && numberFormat == 'million' ){
      outNumCov.outUnit = 'x000s'; outNumCov.dispUnit = 'x000s';
      outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/1000 : inUn=='million' ? 1000 : 100000 ;
      }
    else if (inVal>=1000000 && inVal < 1000000000 && numberFormat =='million'){
      outNumCov.outUnit = "Million"; outNumCov.dispUnit = "Million";
      outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/1000000 : inUn=='million' ? 1 : 1000;
    }
    else if (inVal >= 1000000000 && numberFormat =='million'){
      outNumCov.outUnit = "Billion"; outNumCov.dispUnit = "Billion";
      outNumCov.conValue = inUn=='count' || inUn == 'number'||inUn=='rs' ? 1/1000000000 : inUn=='million' ? 1/1000 : 1;
    }
    return outNumCov;
  }
  
  draw3dPie (id, data, x /*center x*/, y/*center y*/, 
    rx/*radius x*/, ry/*radius y*/, h/*height*/, ir/*inner radius*/,svg,arrClr, chCol){
      //console.log(data,rx,ry,h,ir);
    var _data = d3.pie().sort(null).value(function(d) {return d[chCol];})(data);
    //console.log(_data);
    var slices = svg.append("g").attr("transform", "translate(" + x + "," + y + ")")
    .attr("class", "slices");

    slices.selectAll(".innerSlice").data(_data).enter().append("path").attr("class", "innerSlice")
      .style("fill", function(d,i) { return d3.hsl(arrClr[i%(arrClr.length-2)].dark).darker(0.5); })
      .attr("d", function pieInner(d ){
        //console.log(d,rx,ry,h,ir);
        var startAngle = (d.startAngle < Math.PI ? Math.PI : d.startAngle);
        var endAngle = (d.endAngle < Math.PI ? Math.PI : d.endAngle);
        //console.log(startAngle, endAngle);
        let sx = ir*rx*Math.cos(startAngle);
        let sy = ir*ry*Math.sin(startAngle);
        let ex = ir*rx*Math.cos(endAngle);
        let ey = ir*ry*Math.sin(endAngle);
        //console.log(sx,sy,ex,ey);
    
        var ret =[];
        ret.push("M",sx, sy,"A",ir*rx,ir*ry,"0 0 1",ex,ey, "L",ex,h+ey,"A",ir*rx, ir*ry,"0 0 0",sx,h+sy,"z");
        //console.log(ret);
        return ret.join(" ");
      })
      .each(function(d){this._current=d;});
    
    slices.selectAll(".topSlice").data(_data).enter().append("path").attr("class", "topSlice")
      .style("fill", function(d,i) { return arrClr[i%(arrClr.length-2)].dark })
      .style("stroke", function(d,i) { return arrClr[i%(arrClr.length-2)].dark })
      .attr("d", function pieTop(d){
        if(d.endAngle - d.startAngle == 0 ) return "M 0 0";
        let sx = rx*Math.cos(d.startAngle);
        let  sy = ry*Math.sin(d.startAngle);
        let  ex = rx*Math.cos(d.endAngle);
        let  ey = ry*Math.sin(d.endAngle);
          
        var ret =[];
        ret.push("M",sx,sy,"A",rx,ry,"0",(d.endAngle-d.startAngle > Math.PI? 1: 0),"1",ex,ey,"L",ir*ex,ir*ey);
        ret.push("A",ir*rx,ir*ry,"0",(d.endAngle-d.startAngle > Math.PI? 1: 0), "0",ir*sx,ir*sy,"z");
        //console.log(ret);
        return ret.join(" ");
      })
      .each(function(d){this._current=d;});
    
    slices.selectAll(".outerSlice").data(_data).enter().append("path").attr("class", "outerSlice")
      .style("fill", function(d,i) { return d3.hsl(arrClr[i%(arrClr.length-2)].dark).darker(0.5); })
      .attr("d", function pieOuter(d){
        var startAngle = (d.startAngle > Math.PI ? Math.PI : d.startAngle);
        var endAngle = (d.endAngle > Math.PI ? Math.PI : d.endAngle);
        
        var sx = rx*Math.cos(startAngle);
        let sy = ry*Math.sin(startAngle);
        let ex = rx*Math.cos(endAngle);
        let ey = ry*Math.sin(endAngle);
          
        var ret =[];
        ret.push("M",sx,h+sy,"A",rx,ry,"0 0 1",ex,h+ey,"L",ex,ey,"A",rx,ry,"0 0 0",sx,sy,"z");
        return ret.join(" ");
      })
      .each(function(d){this._current=d;});

    slices.selectAll(".percent").data(_data).enter().append("text").attr("class", "percent")
      .attr("x",function(d){ return 0.6*rx*Math.cos(0.5*(d.startAngle+d.endAngle));})
      .attr("y",function(d){ return 0.6*ry*Math.sin(0.5*(d.startAngle+d.endAngle));})
      .text(function getPercent(d){
        return (d.endAngle-d.startAngle > 0.2 ? 
            Math.round(1000*(d.endAngle-d.startAngle)/(Math.PI*2))/10+'%' : '');
      }	).each(function(d){this._current=d;});				
  }

  //Tool tip function					
  tooltip(data, ct, xScale,yScale) {
    //console.log("allColCollection", this.allColCollection);
    let natEle = this.element.nativeElement;
    let wid = this.width;
    let ht = this.height;
    let pvtChartColCollection = this.chartColCollection ;//this.allColCollection;
    let pvtAllColCollection = this.allColCollection;
    let chData = this.chartData;
    let dMM = this.dataMinMax[0];
    let toolTipData =[];
    let focus = this.svg.append('g').style('display', 'none');
    let idx = this.idx;
    let clickOutput = this.onChartOutput;
    let selData;
    focus.append('line')
      .attr('id', 'focusLineX')
      .attr('class', 'focusLine');
    focus.append('line')
      .attr('id', 'focusLineY')
      .attr('class', 'focusLine');
    focus.append('circle')
      .attr('id', 'focusCircle')
      .attr('r', 5)
      .attr('class', 'circle focusCircle')
      .attr('opacity',"0.9");
    let tooltipHtml=[]; 
    tooltipHtml[idx] = d3.select("body")
            .append("div")
            .attr("class", "apd-chart-tooltip capitalize")
            .attr("id", "tooltip"+idx)
            .style("opacity", "0")
            .style("display","none");
    
  //				            console.info("tooltip Width "+ width + " height "+height);
    this.svg.append('rect')
    .attr('class', 'overlay')
    .attr('width', wid)
    .attr('height', ht)
    .on('mouseover',function() { focus.style('display', null); tooltipHtml[idx].style("display",null);})
    .on('mouseout', function() { focus.style('display', 'none');tooltipHtml[idx].style("display","none");  })
    .on('mousemove',function() {
      var xyCord = ct!="hbar" ? 0 : 1; // to get the x or y movement 0 -x-movement, 1- y movement from mouse
      var mouse = d3.mouse(this)[xyCord];
      let leftEdges = [];
      data.map((ele,i) =>{
        if (ct != 'hbar')
          leftEdges[i] = xScale(ele.label);
        else
          leftEdges[i] = yScale(ele.label);
      });
      //console.log("leftEdges",leftEdges);
      //var leftEdges = ct != "hbar"? xScale.range() : yScale.scaleBand();
      var width1 = ct!= "hbar" ? xScale.bandwidth() : yScale.bandwidth();
      //console.log("leftEdges", leftEdges,"width1",width1);
      var xPosition = d3.mouse(this)[0];
      var yPosition = d3.mouse(this)[1];

      //console.log("xPosition",xPosition,"yPosition", yPosition);
      var j;
      for(j=0; mouse > (leftEdges[j] + width1); j++) {}; //replaces the bisect command
        //do nothing, just increment j until case fails
      var ttd = toolTipData = data[j]; //tooltip data
      let vcol;
      if (ttd !=undefined){
        //console.log(ttd);
        var x3,y3, x1a,x2a;
        var aggCnt, tooltip = "", disTip="", vunit="";

        let dispCol1Tip = pvtChartColCollection;
        //console.log("allColCollection",dispCol1Tip); #91700e
        tooltip = "<span style ='color:darkblue'><strong>"+ttd.label+"</strong> | </span>"
        
        if(pvtAllColCollection.length>0){
          pvtAllColCollection.forEach(function(dispEle, i){
            vcol = dispEle == chData["col_critical"] ? "red" : dispEle==chData["col_warning"] ? "#B5A642":"green";
            disTip += "<span class='clrprimary'><em>"+dispEle+" : </em></span><span style='color:"+vcol+"'>&nbsp"+ttd[dispEle+"_hunit"]+"&nbsp"+chData[dispEle+"_out_unit"]+" | </span>";
            if (i%3 == 1) disTip +="<br/>";
          });
        }
        tooltip += disTip ;
        //if (ct != "hbar"){
          var maxVal=0;
          var keyName = '';
          if(ct != "hbar") x3= xScale(ttd.label)+width1/2;
          else y3 = yScale(ttd.label)+width1/2
          // if (ct!="vbar"){
          d3.keys(ttd).forEach(function(key){
            dispCol1Tip.forEach(function(dispEle, i){
              //console.log("dispEle : "+dispEle+" "+key);
              if (key == dispEle) {
                if (ttd[key] > maxVal){
                  maxVal = ttd[key];
                  keyName = key ;
                }
              }
            })
          })
          if (ct!='hbar') {y3 = yScale(ttd[keyName+"_hunit"]);  x1a=yScale(dMM); x2a=0;  }
          else {x3 = xScale(ttd[keyName+"_hunit"]); x1a=0; x2a=ht; }

          if (isNaN(y3)) y3=ht;
          focus.select('#focusCircle')
            .attr('cx', x3)
            .attr('cy', y3);
          focus.select('#focusLineX')
            .attr('x1', x3).attr('y1', x1a)
            .attr('x2', x3).attr('y2', x2a);
          focus.select('#focusLineY')
            .attr('x1', 0).attr('y1', y3) 
            .attr('x2', wid).attr('y2', y3);
      
          tooltipHtml[idx].html( tooltip )
                .style("top", (d3.event.pageY-window.pageYOffset+10)+"px")
                .style("left", (d3.event.pageX+10)+"px")
                .style("z-index",1999)
                .transition()
                .duration(200)
                .style("opacity", 0.9);
          //let _let = this;
          d3.select(this).on("click",() => {
            console.log("inside the click event");
            let colOne = _.toPairs(toolTipData)[0];
            let arr ={};
            arr[colOne[0]] = colOne[1];
            arr['pChartId'] = chData.chart_id;
            arr['pChartTitle'] = chData.chart_title;
            arr['pchartCategory'] = chData.category;
            arr['ddMetricId'] = chData.dd_chart_id;
            arr['idx'] = idx;
            arr['moduleType'] = chData.module_type;
            arr['xAxisTimeScale'] = chData.xaxis_time_scale;
            clickOutput.emit(arr);
          });
      }
    });
  }	
}


