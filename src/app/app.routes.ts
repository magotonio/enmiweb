import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { RegistrationComponent } from './components/registration/registration.component';
import { PagoComponent } from './components/pago/pago.component';
import { LoginComponent } from './components/login/login.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { AdminInscripcionesComponent } from './components/admin-inscripciones/admin-inscripciones.component';
import { AdminUsuariosComponent } from './components/admin-usuarios/admin-usuarios.component';
import { AdminLogsComponent } from './components/admin-logs/admin-logs.component';
import { PanelAsistenteComponent } from './components/panel-asistente/panel-asistente.component';
import { AsistenteFichaComponent } from './components/asistente-ficha/asistente-ficha.component';
import { AccesoDenegadoComponent } from './components/acceso-denegado/acceso-denegado.component';
import { MantenimientoComponent } from './components/mantenimiento/mantenimiento.component';
import { roleGuard } from './guards/role.guard';
import { maintenanceGuard } from './guards/maintenance.guard';
import { pagoGuard } from './guards/pago.guard';

export const routes: Routes = [
  // Rutas Públicas (Nivel 0 - Abiertas con control de Modo Mantenimiento)
  {
    path: '',
    component: HomeComponent,
    canActivate: [maintenanceGuard],
    title: 'Inicio | ENMI 2027 Madrid'
  },
  {
    path: 'registro',
    component: RegistrationComponent,
    canActivate: [maintenanceGuard],
    title: 'Inscripción | ENMI 2027 Madrid'
  },
  {
    path: 'pago',
    component: PagoComponent,
    canActivate: [maintenanceGuard, pagoGuard],
    title: 'Modalidad de Pago | ENMI 2027 Madrid'
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [maintenanceGuard],
    title: 'Acceso Staff | ENMI 2027 Madrid'
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [maintenanceGuard],
    title: 'Restablecer Contraseña | ENMI 2027 Madrid'
  },
  {
    path: 'restablecer-password',
    redirectTo: 'reset-password',
    pathMatch: 'full'
  },
  {
    path: 'mantenimiento',
    component: MantenimientoComponent,
    canActivate: [maintenanceGuard],
    title: 'En Mantenimiento | ENMI 2027 Madrid'
  },
  {
    path: 'acceso-denegado',
    component: AccesoDenegadoComponent,
    canActivate: [maintenanceGuard],
    title: 'Acceso Restringido | ENMI 2027 Madrid'
  },

  // Espacio Personal del Asistente (Nivel 1+)
  {
    path: 'asistente',
    component: PanelAsistenteComponent,
    canActivate: [maintenanceGuard, roleGuard],
    data: {
      roles: ['asistente', 'supervisor', 'superadministrador']
    },
    title: 'Mi Espacio de Asistente | ENMI 2027 Madrid'
  },
  {
    path: 'asistente/ficha',
    component: AsistenteFichaComponent,
    canActivate: [maintenanceGuard, roleGuard],
    data: {
      roles: ['asistente', 'supervisor', 'superadministrador']
    },
    title: 'Mi Ficha Completa | ENMI 2027 Madrid'
  },

  // Rutas de Administración General (Nivel 2+ : Superadministrador y Supervisor)
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [maintenanceGuard, roleGuard],
    data: {
      roles: ['superadministrador', 'supervisor']
    },
    title: 'Panel de Administración | ENMI 2027 Madrid'
  },
  {
    path: 'admin/inscritos',
    component: AdminInscripcionesComponent,
    canActivate: [maintenanceGuard, roleGuard],
    data: {
      roles: ['superadministrador', 'supervisor']
    },
    title: 'Inscritos y Gestión General | ENMI 2027 Madrid'
  },
  {
    path: 'admin/usuarios',
    component: AdminUsuariosComponent,
    canActivate: [maintenanceGuard, roleGuard],
    data: {
      roles: ['superadministrador']
    },
    title: 'Gestión de Usuarios y Roles | ENMI 2027 Madrid'
  },
  {
    path: 'admin/logs',
    component: AdminLogsComponent,
    canActivate: [maintenanceGuard, roleGuard],
    data: {
      roles: ['superadministrador']
    },
    title: 'Auditoría y Logs del Sistema | ENMI 2027 Madrid'
  },

  // Alias y redirecciones amigables
  {
    path: 'en-mantenimiento',
    redirectTo: 'mantenimiento',
    pathMatch: 'full'
  },
  {
    path: 'mi-ficha',
    redirectTo: 'asistente/ficha',
    pathMatch: 'full'
  },
  {
    path: 'inscritos',
    redirectTo: 'admin/inscritos',
    pathMatch: 'full'
  },
  {
    path: 'usuarios',
    redirectTo: 'admin/usuarios',
    pathMatch: 'full'
  },
  {
    path: 'logs',
    redirectTo: 'admin/logs',
    pathMatch: 'full'
  },

  // Ruta comodín para cualquier URL no encontrada
  {
    path: '**',
    redirectTo: ''
  }
];
