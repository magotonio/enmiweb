import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { InscripcionSessionService } from '../services/inscripcion-session.service';

/**
 * Guard para la ruta de pago (/pago).
 * Garantiza que el usuario únicamente pueda acceder si:
 * 1. Ha completado previamente su formulario de inscripción y no está pagada.
 * 2. O bien vuelve redirigido desde la pasarela Redsys con los parámetros ?pago= e ?id=.
 * 
 * En cualquier otro caso, redirige a /registro.
 */
export const pagoGuard: CanActivateFn = (route) => {
  const sessionService = inject(InscripcionSessionService);
  const router = inject(Router);

  // 1. Verificar si hay datos de registro en sessionStorage
  if (sessionService.hasSession()) {
    if (sessionService.getSession()?.status === 'pagada') {
      return router.createUrlTree(['/registro/completado']);
    }
    return true;
  }

  // 2. Verificar si viene de retorno de pasarela Redsys con ID válido
  const pagoStatus = route.queryParams['pago'];
  const idParam = route.queryParams['id'];
  if (pagoStatus && idParam && !isNaN(Number(idParam))) {
    return true;
  }

  // 3. Si no hay registro previo ni retorno bancario, redirigir a /registro
  return router.createUrlTree(['/registro']);
};
