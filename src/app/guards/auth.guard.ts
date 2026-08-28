import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de protección de rutas para el panel de administración.
 * Permite el acceso únicamente a usuarios autenticados.
 * Si el usuario no ha iniciado sesión, redirige a la pantalla de login
 * preservando la URL solicitada para retornar a ella tras iniciar sesión.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Redirigir al login guardando la ruta a la que intentaba acceder
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
