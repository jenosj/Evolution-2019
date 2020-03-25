import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, Validators, FormControlName } from '@angular/forms';
import { AlertService, AuthenticationService } from '../_services/index';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})

export class ProfileComponent implements OnInit {
  loading = false;
  user_id;  first_name; last_name;  email_id;  mobile_no ='+91';
  licenseType;  dataSize; dataRetentionDays;

  form: FormGroup;

	createForm() {
		this.form = this.formBuilder.group({
 			first_name:[this.first_name, Validators.compose([
				Validators.required,
				Validators.minLength(3),
        Validators.maxLength(30),
        this.validateName
      ])],
      last_name:[this.last_name, Validators.compose([
				Validators.required,
				Validators.minLength(3),
        Validators.maxLength(30),
        this.validateName
      ])],
      mobile_no:[this.mobile_no,Validators.compose([
        Validators.minLength(10),
        Validators.maxLength(15),
        this.validateMobile
      ])]
 		}
		);	
  }

  constructor(
    private router: Router,
    private alertService: AlertService,
    private authService: AuthenticationService,
    private formBuilder: FormBuilder) {
      this.createForm();
    }


  ngOnInit() {
    localStorage.setItem("currentRoute","profile");
    this.authService.getProfile().subscribe(
      profile =>{
        console.log('profile init');
        console.log(profile);
        if (profile.success){
          this.form.setValue({
            first_name: profile.user.first_name,
            last_name: profile.user.last_name,
            mobile_no: profile.user.mobile_no !=null && profile.user.mobile_no !="" ? profile.user.mobile_no :"+91"
          });
          this.user_id = profile.user.user_id;
          this.email_id = profile.user.email_id;
/*           this.licenseType = profile.user.license.license_type;
          this.dataRetentionDays = profile.user.license.data_reten_days;
          this.dataSize = profile.user.license.data_size_mb;
 */        }
        else {
          this.authService.invalidSession(profile);
        }
      },
      error => {
        this.router.navigate(['/login']);
      }
    )
  }

  validateName(controls){
		const reqExp = new RegExp(/^[a-zA-Z]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateName' : true};
		}
	}

  validateMobile(controls){
		const reqExp = new RegExp(/^[+][0-9]*$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateMobile' : true};
		}
	}

  profileUpdate() {
		this.loading = true;
		const profile = {
      user_id: this.user_id,
			first_name: this.form.get('first_name').value,
			last_name: this.form.get('last_name').value,
			mobile_no: this.form.get('mobile_no').value
		};

    this.authService.profileUpdate(profile)
		.subscribe(
			data => {
				//console.log("Profile data");
				//console.log(data);
				if (data.success){
          //console.log("inside profile success");
					this.alertService.success('Profile updated successfully', true);
					this.router.navigate(['/dashboard']);
				}else {
					this.alertService.error(data.message);
					this.loading = false;
				}
			},
			error => {
				console.log(error);
				this.alertService.error(error);
				this.loading = false;
				this.router.navigate(['/register',{ skipLocationChange: true }]);
			}
		);

  }
}
