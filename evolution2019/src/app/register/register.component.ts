import { Component} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { AlertService, AuthenticationService } from '../_services/index';

@Component({
    moduleId: module.id.toString(),
	selector:'app-register',
    templateUrl: 'register.component.html'
})

export class RegisterComponent {
    loading = false;
	
	form: FormGroup;
	modPassword;
	createForm() {
		this.form = this.formBuilder.group({
			email:['',Validators.compose([
				Validators.required,
				Validators.minLength(5),
				Validators.maxLength(50),
				this.validateEmail
			])],
			name:['',Validators.compose([
				Validators.required,
				Validators.minLength(3),
				Validators.maxLength(30)
			])],
			password:['',Validators.compose([
				Validators.required,
				Validators.minLength(5),
				Validators.maxLength(20)
			])],
			confirm:['',Validators.required]
		},
			{validator: this.matchingPasswords('password', 'confirm')}
		);	
	}

    constructor(
        private router: Router,
        private alertService: AlertService,
		private authService: AuthenticationService,
		private formBuilder: FormBuilder) {
			this.createForm();
	}

	validateEmail(controls){
		const reqExp = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
		if (reqExp.test(controls.value)){
			return null;
		} else{
			return { 'validateEmail' : true};
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

    register() {
		
		this.loading = true;
		const user = {
			email:this.form.get('email').value,
			name: this.form.get('name').value,
			password: this.form.get('password').value
		};
		console.info(this.form.get('email'));
		this.authService.registerUser(user)
		.subscribe(
			data => {
				console.log("register data");
				console.log(data);
				if (data.success){
					this.alertService.success('Registration successful', true);
					this.router.navigate(['/login',{ skipLocationChange: true }]);
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
