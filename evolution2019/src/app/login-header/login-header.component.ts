import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { AlertService, AuthenticationService } from '../_services/index';

@Component({
  selector: 'app-login-header',
  templateUrl: './login-header.component.html',
  styleUrls: ['./login-header.component.css']
})

export class LoginHeaderComponent {
  showHeader = true;
  showProfile = false;
  userName:String ;
  cusName:string = environment.customer;
  cusLogo:string = environment.customer_logo;
  entSelVal:String;
  entCollection=[];

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private alertService:AlertService
  ) {
    this.header();
   }

  ngOnInit(){

  }

  onEntChange(entItem){
    if (entItem) {
      this.entSelVal = entItem.e_name;
      this.authService.setItem('entItem', JSON.stringify(entItem));
    }
    //localStorage.setItem('entItem', JSON.stringify(entItem));
  }

  header() {
    if (this.authService.loggedIn()){
      this.showProfile=true;
      this.userName = localStorage.getItem('apdUser');
      this.entCollection = JSON.parse(localStorage.getItem('entCollection'));
      if (this.entCollection) {
        console.log("getting ent from local");
        this.entSelVal = JSON.parse(localStorage.getItem('entItem')).e_name;
      } else {
        console.log("getting ent from db");
        this.authService.getEnterprise().subscribe( entColl => {
          if (entColl.success){
            this.entCollection = entColl.result;
            this.entCollection.push({e_id:0, e_name: "Select Enterprise", owner_id:null});
            this.entSelVal = "Select Enterprise";
            this.authService.setItem('entItem', JSON.stringify({e_id:0, e_name: "Select Enterprise", owner_id:null}));
            this.authService.setItem('entCollection', JSON.stringify(this.entCollection));
            //            localStorage.setItem('entItem', JSON.stringify({e_id:0, e_name: "Select Enterprise", owner_id:null}));
            //localStorage.setItem('entCollection', JSON.stringify(this.entCollection));
            console.log(this.router.url);
          } else {
            this.authService.invalidSession(entColl);
          }
        },
        error => {
          console.log (error);
          this.authService.invalidSession(error);
        });
      }
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  hideHeader() {
  //    console.log("showHeader: "+this.showHeader);
    this.showHeader = this.showHeader ? false : true ;
  }

}
