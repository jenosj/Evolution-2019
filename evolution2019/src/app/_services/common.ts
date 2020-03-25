import { Injectable } from '@angular/core';
import {Subject} from 'rxjs/Subject'; 

@Injectable()
export class CommonService {
  invokeEvent: Subject<any> = new Subject(); 

  callHeader() { 
      console.log("callHeader called");
    this.invokeEvent.next('header') ;     
  }
}