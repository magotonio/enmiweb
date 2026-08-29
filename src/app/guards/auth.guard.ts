import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Guard de protección de rutas para el panel de administración.
 * Permite el acceso únicamente a usuarios autenticados y NO bloqueados.
 * Si el usuario está bloqueado, cierra la sesión y redirige al login con aviso.
 * Si el usuario no ha iniciado sesión, redirige a login preservando la ruta previa.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  // 1. Comprobación rápida en sesión local: si está bloqueado, cerrar sesión
  if (currentUser && authService.isBlocked(currentUser)) {
    authService.logout('blocked');
    return router.createUrlTree(['/login'], {
      queryParams: { blocked: '1' }
    });
  }

  // 2. Si no hay usuario en sesión
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  // 3. Verificación activa en segundo plano con la base de datos
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
      return true;
    }),
    catchError(() => {
      // Si hay error de red puntual pero el usuario está autenticado localmente y no bloqueado
      return of(authService.isLoggedIn());
    })
  );
};

