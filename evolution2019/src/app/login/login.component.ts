import { Component, OnInit, NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { environment } from '../../environments/environment';
import { Title }     from '@angular/platform-browser';
import { AuthGuard } from '../_guards/auth.guard';

import { AlertService, AuthenticationService } from '../_services/index';

@Component({
    moduleId: module.id.toString(),
    templateUrl: 'login.component.html'
})

@NgModule({
	imports:[NgbModule]
})

export class LoginComponent implements OnInit {
    isLoading = false;
    returnUrl: string;

	form: FormGroup;
	
	createForm() {
		this.form = this.formBuilder.group({
			email:'',
			password:'',
		});
	}

    constructor(
		private titleService: Title, 
        private route: ActivatedRoute,
		private router: Router,
		private authGuard: AuthGuard,
        private authenticationService: AuthenticationService,
        private alertService: AlertService,
		private formBuilder: FormBuilder
		){
			this.createForm();
		} 

    ngOnInit() {
		if (this.authGuard.redirectUrl){
			this.alertService.error("You must login to view this page.");
			this.returnUrl = this.authGuard.redirectUrl;
			this.authGuard.redirectUrl = undefined;
		} else {
			console.log("redirect else page");
			if(this.authenticationService.loggedIn()){
				this.navigation();
			}
		}
    }

	private navigation() {
		let lastVisitedURL = localStorage.getItem("currentRoute");
		switch (lastVisitedURL) {
			case "dashboard":
				this.router.navigate(['/dashboard']);
				break;
			case "modulecard":
				this.router.navigate(['/modulecard']);
				break;
			case "profile":
				this.router.navigate(['/profile']);
				break;
			default:
				console.log("inside default");
				this.router.navigate(['/home']);
		}
	}

	public setTitle( newTitle: any) {
		this.titleService.setTitle( newTitle );
	}

	appTitle:string = environment.customer.substr(0,1).toUpperCase()+environment.customer.substr(1);
/*	
	disableForm() {
		this.form.controls.['email'].disable(),
		this.form.controls.['password'].disable(),
		this.form.controls.['email'].disable()
	}
	enableForm() {
		this.form.controls.['email'].enable(),
		this.form.controls.['password'].enable(),
		this.form.controls.['email'].enable()
	}
*/	
    login() {
		//console.log("inside login function return url "+this.returnUrl);
		this.isLoading = true;
//		this.disableForm();
		const user ={
			email: this.form.get('email').value,
			password: this.form.get('password').value
		};
		this.authenticationService.login(user)
		.subscribe(
			data => {
				this.isLoading = false;
				//console.log("login return data");
				//console.log(data);
				if (data.success){
					this.authenticationService.storeSessionData(data.token, data.user);
					if (this.returnUrl){
						this.router.navigate([this.returnUrl]);
					} else {
						this.navigation();
					}
				} else {
					this.alertService.error(data.message);
				}
			},
			error => {
				console.log (error);
				this.alertService.error("Could not connect to the server, please check server connection");
				this.isLoading = false;
			}
		);
    }
}
