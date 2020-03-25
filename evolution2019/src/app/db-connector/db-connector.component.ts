import { Component, OnInit, Input } from '@angular/core';
import { NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { AlertService, AuthenticationService } from '../_services/index';
import { FormBuilder, FormControl, FormGroup, Validators, FormControlName } from '@angular/forms';



@Component({
  selector: 'app-db-connector',
  templateUrl: './db-connector.component.html',
  styleUrls: ['./db-connector.component.css']
})
export class DbConnectorComponent implements OnInit {
  @Input() dbCon;
  dbConnectorDetails;
  engSelVal ="--select--";
  connectorName;  user; database; password; confirm; host; port;  max;
  pageTitle;
  isValidated = false; isEngValidated = false; validationText = "Validation Failed Or Yet to be Done";
  displayError; dispValidate = 'block';

  isLoading = false;

  form: FormGroup;

  createForm() {
		this.form = this.formBuilder.group({
 			ConnectorName:[this.connectorName, Validators.compose([
				Validators.required,
				Validators.minLength(3),
        Validators.maxLength(30),
        this.validateName
      ])],
      User:[this.user, Validators.compose([
				Validators.required,
        this.validateUsrName
      ])],
      Password:[this.password,Validators.compose([
				Validators.required,
      ])],
      Confirm:[this.confirm,Validators.compose([
        Validators.required
      ])],
      Database:[this.database,Validators.compose([
				Validators.required,
      ])],
      Host:[this.host,Validators.compose([
				Validators.required,
        this.validateHost
      ])],
      Port:[this.port,Validators.compose([
				Validators.required,
        this.validatePort
      ])]
     },
     {validator: this.matchingPasswords('Password', 'Confirm')}
		);	
  }
	
  constructor(
    public activeModal: NgbActiveModal,
    private alertService: AlertService,
    private authService: AuthenticationService,
    private formBuilder: FormBuilder) {
      this.createForm()
    }

  ngOnInit() {
    console.log("inside modal DB "+this.dbCon);
    if (this.dbCon != undefined){
      this.dbConnectorDetails = JSON.parse(this.dbCon);
      this.form.setValue({
        ConnectorName: this.dbConnectorDetails.connector_name,
        User: this.dbConnectorDetails.connection_details !=null ? this.dbConnectorDetails.connection_details.user:this.dbConnectorDetails.user_name,
        Password: this.dbConnectorDetails.connection_details !=null ? this.dbConnectorDetails.connection_details.password:this.dbConnectorDetails.password,
        Confirm: this.dbConnectorDetails.connection_details !=null ? this.dbConnectorDetails.connection_details.password:this.dbConnectorDetails.password,
        Database:this.dbConnectorDetails.connection_details !=null ? this.dbConnectorDetails.connection_details.database:"" ,
        Host: this.dbConnectorDetails.connection_details !=null ? this.dbConnectorDetails.connection_details.host:"" ,
        Port: this.dbConnectorDetails.connection_details !=null ? this.dbConnectorDetails.connection_details.port: 8080
      });
      this.engSelVal = this.dbConnectorDetails.engine_name;
      this.pageTitle = "Edit DB Connector (db_id: "+this.dbConnectorDetails.db_id +")";
    } else {
      this.pageTitle = "Add DB Connector" ;
    }
  }

  matchingPasswords(pass,conf){
		return (group: FormGroup) => {
			if(group.controls[pass].value === group.controls[conf].value){
				return null;
			} else{
				return {'matchingPasswords' : true};
			}
		}
  }
  
  onCloseHandled(){
    console.log("inside close");
    this.activeModal.close();
  }
  engChanged(selVal){
    //console.log("inside eng change")
    this.engSelVal = selVal;
    this.validateEngine(selVal);
    this.isValidated = false;
  }
  dbConnSubmit(){
    if (!this.isLoading && this.isValidated && this.form.valid){
      this.isLoading = true;
      let dbConnData = {
        db_id: this.dbConnectorDetails != undefined ? this.dbConnectorDetails.db_id : null ,
        connector_name: this.form.get('ConnectorName').value.trim(),
        engine_name: this.engSelVal.trim(),
        connection_details: {
          host: this.form.get('Host').value.trim(),
          port: this.form.get('Port').value.trim(),
          database: this.form.get('Database').value.trim(),
          user: this.form.get('User').value.trim(),
          password: this.form.get('Password').value.trim(),
          max: 10
        }
      }
      this.authService.dbConnectorUpdate(dbConnData).subscribe(ack => {
        if (ack.success) {
          this.isLoading = false;
          this.alertService.success(ack.message, true);
          this.activeModal.close();
        } else {
          this.isLoading = false;
          if (ack.invalidToken){
            this.activeModal.close();
          }
          this.authService.invalidSession(ack);
        }
      })
    }
  }

  validateName(controls){
		const reqExp = new RegExp(/^[a-zA-Z ]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateName' : true};
		}
  }
  
  validateHost(controls){
    //@"http[s]?://([\\w-]+\\.)+[\\w-]+(/[\\w- ./?%&=]*)?"
		let reqExp = new RegExp(/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
      reqExp = new RegExp(/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/);
      if (reqExp.test(controls.value)){
        return null;
      } else {
        return { 'validateHost' : true};
      }
		}
  }

  validateUsrName(controls){
		const reqExp = new RegExp(/^[a-zA-Z0-9_]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateUsrName' : true};
		}
  }

  validatePort(controls){
		const reqExp = new RegExp(/^[0-9]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else {
			return { 'validatePort' : true};
		}
  }
  validateEngine(selVal){
    if (this.engSelVal =="--select--") {
      this.isEngValidated = false;
    } else {
      this.isEngValidated = true;
    }
  }
  validateConn(){
    this.displayError = null;
    this.isLoading = true;
    this.dispValidate = 'none';
    if (this.isEngValidated && this.form.valid){
      let dbConnData = {
        engine_name:  this.engSelVal.trim().toLowerCase(),
        connection_details: {
          host: this.form.get('Host').value.trim(),
          port: this.form.get('Port').value.trim(),
          database: this.form.get('Database').value.trim(),
          user: this.form.get('User').value.trim(),
          password: this.form.get('Password').value.trim(),
          max: 10
        }
      }
      this.authService.validateConnection(dbConnData).subscribe( result =>{
        this.isLoading = false;
        if (result.success) {
          this.validationText = "Validation successful.";
          this.isValidated = true;
        }    
        else { 
          this.dispValidate = 'block';
          //this.authService.invalidSession(result);
          this.displayError = result.message;
        }
      });
    } else {
      this.alertService.error("All Fields are Mandatory, please fill to validate ");
    }
  }
}
