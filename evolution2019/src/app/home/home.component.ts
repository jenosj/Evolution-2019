import { Component, OnInit } from '@angular/core';
import { AlertService, AuthenticationService } from '../_services/index';
import { Router } from '@angular/router';

//import { User } from '../_models/index';
//import { UserService } from '../_services/index';

@Component({
    moduleId: module.id.toString(),
    templateUrl: 'home.component.html'
})

export class HomeComponent implements OnInit {
   userName;    email;    mobile_no;
    constructor(
        private router: Router,
        private authService: AuthenticationService
    ) {    }

    ngOnInit() {
        console.log("getting home profile information");
        this.authService.getProfile().subscribe(
            profile =>{
              console.log('profile init');
              console.log(profile);
              if (profile.success){
                this.userName = profile.user.first_name+' '+profile.user.last_name;
                this.email = profile.user.email_id;
                this.mobile_no = profile.user.mobile_no;

              } else {
                this.authService.logout();
                this.router.navigate(['/login']);
              }
            },
            error => {
              this.router.navigate(['/login']);
            }
        )
    }

}