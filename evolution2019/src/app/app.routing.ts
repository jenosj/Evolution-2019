import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './home/index';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/index';
import { ProfileComponent } from './profile/profile.component';
import { DashboardHeaderComponent } from './dashboard-header/dashboard-header.component'
import { AllModuleCardComponent } from './all-module-card/all-module-card.component';
import { ChartVisualComponent } from './chart-visual/chart-visual.component';


import { AuthGuard } from './_guards/index';
import { NotAuthGuard } from './_guards/notauth.guard'

const appRoutes: Routes = [
    { path: '', component: LoginComponent, canActivate:[NotAuthGuard]},
    { path: 'login', component: LoginComponent},
    { path: 'home', component: HomeComponent, canActivate:[AuthGuard] },
    { path: 'register', component: RegisterComponent, canActivate:[NotAuthGuard] },
    { path: 'profile', component: ProfileComponent, canActivate:[AuthGuard] },
    { path: 'dashboard', component: DashboardHeaderComponent, canActivate:[AuthGuard] },
    { path: 'modulecard', component: AllModuleCardComponent, canActivate:[AuthGuard] },
    { path: 'chartvisual', component: ChartVisualComponent, canActivate:[AuthGuard] },
    // redirect to dashboard page for any other route
    { path: '**', redirectTo: 'login' }
];

export const routing = RouterModule.forRoot(appRoutes);