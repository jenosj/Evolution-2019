import { Component, OnInit } from '@angular/core';

import { AlertService } from '../_services/index';
import {debounceTime} from 'rxjs/operator/debounceTime';

@Component({
    moduleId: module.id.toString(),
    selector: 'alert',
    templateUrl: 'alert.component.html'
})
export class AlertComponent implements OnInit {

    message: string;
    staticAlertClosed = false;
    
    
    constructor(private alertService: AlertService) { }

    ngOnInit(): void {
        this.alertService.getMessage().subscribe(message => {
            this.staticAlertClosed=false;  
            setTimeout(() => this.staticAlertClosed = true, 5000);
            this.message = message; 
        });
    }
    //closes the alert on click of the alert div
    close() {
        console.log ("inside close click");
        this.staticAlertClosed = true;
    }

}
