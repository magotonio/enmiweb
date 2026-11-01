import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/usuario.model';
import { map, catchError, of } from 'rxjs';

/**
 * Guard de control de acceso por roles y niveles de seguridad.
 * Valida:
 * 1. Autenticación y estado no bloqueado.
 * 2. Nivel de seguridad / roles permitidos en route.data['roles'] o route.data['minRole'].
 * 3. Si no tiene permisos, redirige a /acceso-denegado sin cerrar la sesión.
 * 4. Si no ha iniciado sesión, redirige a /login con returnUrl.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  const allowedRoles = route.data['roles'] as UserRole[] | undefined;
  const minRole = route.data['minRole'] as UserRole | undefined;

  // 1. Si el usuario está bloqueado en sesión local
  if (currentUser && authService.isBlocked(currentUser)) {
    authService.logout('blocked');
    return router.createUrlTree(['/login'], {
      queryParams: { blocked: '1' }
    });
  }

  // 2. Si no hay sesión iniciada
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  // 3. Comprobación rápida del rol en sesión local
  if (!authService.canAccess(allowedRoles, minRole)) {
    return router.createUrlTree(['/acceso-denegado'], {
      queryParams: {
        ruta: state.url,
        requerido: (allowedRoles ? allowedRoles.join(', ') : minRole) || 'nivel superior'
      }
    });
  }

  // 4. Verificación activa en segundo plano con la base de datos
  return authService.verifySession().pipe(
    map(response => {
      if (response.bloqueado) {
        authService.logout('blocked');
        return router.createUrlTree(['/login'], {
          queryParams: { blocked: '1' }
        });
      }

      if (!response.success && !authService.isLoggedIn()) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }

      if (!authService.canAccess(allowedRoles, minRole)) {
        return router.createUrlTree(['/acceso-denegado'], {
          queryParams: {
            ruta: state.url,
            requerido: (allowedRoles ? allowedRoles.join(', ') : minRole) || 'nivel superior'
          }
        });
      }

      return true;
    }),
    catchError(() => {
      authService.clearSession();
      return of(router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url }
      }));
    })
  );
};
