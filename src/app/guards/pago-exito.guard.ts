import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { InscripcionSessionService } from '../services/inscripcion-session.service';

export const pagoExitoGuard: CanActivateFn = () => {
  const sessionService = inject(InscripcionSessionService);
  const router = inject(Router);
  if (!sessionService.hasSession()) {
    return router.createUrlTree(['/registro']);
  }
  const session = sessionService.getSession();
  return session?.status === 'pagada' || (session?.status === 'pendiente' && !!session.modalidad)
    ? true
    : router.createUrlTree(['/pago']);
};
