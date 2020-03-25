import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AlertService, AuthenticationService } from '../_services/index';


@Injectable()
export class AuthGuard implements CanActivate {
    redirectUrl;
    constructor(
        private router: Router,
        private authService: AuthenticationService
    ) { }

    canActivate(router: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        console.log("canActivate "+this.authService.loggedIn());
        if(this.authService.loggedIn()){
            return true;
        } else {
            this.redirectUrl = state.url;
            console.log(this.redirectUrl);
            this.router.navigate(['/login']);
            return false;
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