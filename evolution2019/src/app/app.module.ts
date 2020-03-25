import { BrowserModule, Title } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { NgbModule,NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ReactiveFormsModule, FormsModule  } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppComponent } from './app.component';
import { routing }        from './app.routing';

import { AlertComponent } from './_directives/index';

import { AuthGuard } from './_guards/index';
import { NotAuthGuard } from './_guards/notauth.guard'

import { JwtInterceptor } from './_helpers/index';
import { AlertService, AuthenticationService } from './_services/index';
import { HomeComponent } from './home/index';
import { LoginComponent } from './login/index';
import { RegisterComponent } from './register/index';
import { LoginHeaderComponent } from './login-header/login-header.component';
import { ProfileComponent } from './profile/profile.component';
import { DashboardHeaderComponent } from './dashboard-header/dashboard-header.component'
import { IonRangeSliderModule } from "ng2-ion-range-slider";
// below modules are used by datetime picker
import { OwlDateTimeModule, OwlNativeDateTimeModule, OWL_DATE_TIME_FORMATS } from 'ng-pick-datetime';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import { D3chartsv3Directive } from './d3chartsv3.directive';
import { AllModuleCardComponent } from './all-module-card/all-module-card.component';
import { DbConnectorComponent } from './db-connector/db-connector.component';
import { ChartVisualComponent } from './chart-visual/chart-visual.component';

export const MY_NATIVE_FORMATS = {
    fullPickerInput: {year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'},
    datePickerInput: {year: 'numeric', month: 'numeric', day: 'numeric'},
    timePickerInput: {hour: 'numeric', minute: 'numeric'},
    monthYearLabel: {year: 'numeric', month: 'short'},
    dateA11yLabel: {year: 'numeric', month: 'long', day: 'numeric'},
    monthYearA11yLabel: {year: 'numeric', month: 'long'},
    hour12: false
};

@NgModule({
    imports: [
        NgbModule.forRoot(),
        BrowserModule,
        ReactiveFormsModule,
        FormsModule,
		HttpClientModule,
        routing,
        IonRangeSliderModule,
        OwlDateTimeModule,
        OwlNativeDateTimeModule,
        BrowserAnimationsModule,
    ],
    declarations: [
        AppComponent,
        AlertComponent,
        HomeComponent,
        LoginComponent,
		LoginHeaderComponent,
        RegisterComponent,
        ProfileComponent,
        DashboardHeaderComponent,
        D3chartsv3Directive,
        AllModuleCardComponent,
        DbConnectorComponent,
        ChartVisualComponent
    ],
    entryComponents: [
        DbConnectorComponent
    ],
    providers: [
        AuthGuard,
        NotAuthGuard,
        AlertService,
        AuthenticationService,
		Title,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: JwtInterceptor,
            multi: true
        },
        {provide: OWL_DATE_TIME_FORMATS, useValue: MY_NATIVE_FORMATS},
        // provider used to create fake backend
      //  fakeBackendProvider
    ],
    exports: [ DbConnectorComponent ],
    bootstrap: [AppComponent]
})

export class AppModule { }
