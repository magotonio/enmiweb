import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { AuthService } from '../services/auth.service';
import { map, of } from 'rxjs';

/**
 * Guard de control del Modo Mantenimiento.
 * 
 * Reglas de negocio:
 * 1. Si 'mantenimiento' == 1:
 *    - Cualquier página SOLO se puede ver si el usuario ha iniciado sesión (isLoggedIn).
 *    - Si NO ha iniciado sesión:
 *      - Las rutas /mantenimiento y /login están permitidas.
 *      - Cualquier otra página se redirecciona automáticamente a /mantenimiento.
 * 2. Si 'mantenimiento' == 0:
 *    - Si un usuario intenta acceder a /mantenimiento, se le redirecciona a la portada (/).
 *    - El resto de páginas funcionan con su comportamiento estándar.
 */
export const maintenanceGuard: CanActivateFn = (route, state) => {
  const configService = inject(ConfigService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const checkMode = (isMaintenance: boolean) => {
    const isLoggedIn = authService.isLoggedIn();
    const url = state.url.split('?')[0];
    const isMaintenanceRoute = url === '/mantenimiento' || url === '/en-mantenimiento';
    const isLoginRoute = url === '/login';

    if (isMaintenance) {
      // Modo mantenimiento ACTIVO
      if (isLoggedIn) {
        // Usuario autenticado: acceso concedido a cualquier página
        return true;
      }

      // Usuario NO autenticado
      if (isMaintenanceRoute || isLoginRoute) {
        return true;
      }

      // Redirigir a la página de mantenimiento
      return router.createUrlTree(['/mantenimiento']);
    } else {
      // Modo mantenimiento DESACTIVADO
      if (isMaintenanceRoute) {
        // Redirigir a la portada si no hay mantenimiento
        return router.createUrlTree(['/']);
      }

      return true;
    }
  };

  if (configService.isLoaded()) {
    return checkMode(configService.isMaintenanceMode());
  }

  return configService.checkMaintenance().pipe(
    map(isMaintenance => checkMode(isMaintenance))
  );
};
