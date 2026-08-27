import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { RegistrationFormComponent } from './components/registration-form/registration-form.component';
import { LoginComponent } from './components/login/login.component';

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
    path: '**',
    redirectTo: ''
  }
];
