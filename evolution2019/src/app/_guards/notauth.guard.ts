import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';
import { AlertService, AuthenticationService } from '../_services/index';


@Injectable()
export class NotAuthGuard implements CanActivate {

    constructor(
        private router: Router,
        private authService: AuthenticationService
    ) { }

    canActivate() {
        if(this.authService.loggedIn()){
            this.router.navigate(['/login']);
            return false;
        } else {
            return true;
        }
        /* console.log("inside authGuard");
        console.log(state.url);

        if (localStorage.getItem('token')) {
            // logged in so return true
            return true;
        }

        // not logged in so redirect to login page with the return url
        this.router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
        return false; */
    }
}