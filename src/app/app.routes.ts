import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { RegistrationFormComponent } from './components/registration-form/registration-form.component';
import { LoginComponent } from './components/login/login.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { AdminInscripcionesComponent } from './components/admin-inscripciones/admin-inscripciones.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Inicio | ENMI 2027 Madrid'
  },
  {
    path: 'registro',
    component: RegistrationFormComponent,
    title: 'Inscripción | ENMI 2027 Madrid'
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Acceso | ENMI 2027 Madrid'
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [authGuard],
    title: 'Panel de Administración | ENMI 2027 Madrid'
  },
  {
    path: 'admin/inscritos',
    component: AdminInscripcionesComponent,
    canActivate: [authGuard],
    title: 'Inscritos | Panel de Administración ENMI 2027'
  },
  {
    path: 'inscritos',
    redirectTo: 'admin/inscritos',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
