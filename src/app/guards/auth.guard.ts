import { CanActivateFn } from '@angular/router';
import { roleGuard } from './role.guard';

/**
 * Re-exportación de authGuard para compatibilidad con código previo.
 * Utiliza roleGuard internamente para verificación unificada de sesión y roles.
 */
export const authGuard: CanActivateFn = roleGuard;
export { roleGuard };
