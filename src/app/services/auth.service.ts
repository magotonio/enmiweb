import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap, catchError, switchMap } from 'rxjs';
import { AuthUser, LoginCredentials, LoginResponse, UserRole, ROLE_HIERARCHY, ROLE_LABELS, ROLE_BADGE_CLASSES } from '../models/usuario.model';
import { environment } from '../../environments/environment';
import { CsrfTokenService } from './csrf-token.service';

const STORAGE_USER_KEY = 'enmi_auth_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly csrfTokenService = inject(CsrfTokenService);
  private readonly apiUrl = `${environment.apiUrl}/login.php`;
  private readonly checkSessionUrl = `${environment.apiUrl}/check_session.php`;
  private readonly logoutUrl = `${environment.apiUrl}/logout.php`;

  // Estado reactivo del usuario conectado
  readonly currentUser = signal<AuthUser | null>(this.getStoredUser());

  readonly isLoggedIn = computed(() => {
    const user = this.currentUser();
    return user !== null && !this.isBlocked(user);
  });

  // Perfil / Rol actual del usuario
  readonly userRole = computed<UserRole | null>(() => {
    const user = this.currentUser();
    return user ? user.rol : null;
  });

  readonly userRoleLabel = computed<string>(() => {
    const role = this.userRole();
    return role ? ROLE_LABELS[role] : '';
  });

  readonly userRoleBadge = computed(() => {
    const role = this.userRole();
    return role ? ROLE_BADGE_CLASSES[role] : null;
  });

  // Evaluaciones directas de privilegios
  readonly isSuperAdmin = computed(() => this.userRole() === 'superadministrador');
  readonly isSupervisor = computed(() => this.userRole() === 'supervisor' || this.userRole() === 'superadministrador');
  readonly isAsistente = computed(() => !!this.userRole());

  /**
   * Comprueba si el usuario conectado posee uno de los roles especificados.
   */
  hasRole(roles: UserRole | UserRole[]): boolean {
    const current = this.userRole();
    if (!current) return false;
    const targetRoles = Array.isArray(roles) ? roles : [roles];
    return targetRoles.includes(current);
  }

  /**
   * Comprueba si el usuario conectado tiene un nivel jerárquico igual o superior al rol mínimo requerido.
   */
  hasMinRole(minRole: UserRole): boolean {
    const current = this.userRole();
    if (!current) return false;
    const currentLevel = ROLE_HIERARCHY[current] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
    return currentLevel >= requiredLevel;
  }

  /**
   * Evalúa si el usuario conectado puede acceder a un recurso basándose en roles o rol mínimo.
   */
  canAccess(allowedRoles?: UserRole[], minRole?: UserRole): boolean {
    if (!this.isLoggedIn()) return false;
    if (minRole && !this.hasMinRole(minRole)) return false;
    if (allowedRoles && allowedRoles.length > 0 && !this.hasRole(allowedRoles)) return false;
    return true;
  }

  /**
   * Comprueba si un usuario tiene la condición de bloqueado (bloqueado == 1 o true).
   */
  isBlocked(user?: AuthUser | null): boolean {
    if (!user) return false;
    return Number(user.bloqueado) === 1 || user.bloqueado === true;
  }

  /**
   * Inicia sesión enviando credenciales a la API PHP.
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.get<SessionResponse>(this.checkSessionUrl).pipe(
      tap(response => this.csrfTokenService.setToken(response.csrf_token || null)),
      switchMap(() => this.http.post<LoginResponse>(this.apiUrl, credentials)),
      tap(response => {
        if (response.success && response.user) {
          if (this.isBlocked(response.user) || response.bloqueado) {
            this.logout('blocked');
            throw new Error('Su usuario está bloqueado. Contacte con el administrador.');
          }
          this.csrfTokenService.setToken(response.csrf_token || null);
          this.setSession(response.user);
        }
      })
    );
  }

  /**
   * Valida en tiempo real contra el backend si la sesión sigue activa y si el usuario está bloqueado o cambió de rol.
   * Si el usuario se encuentra bloqueado, cierra la sesión inmediatamente.
   */
  verifySession(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(this.checkSessionUrl).pipe(
      tap(response => {
        this.csrfTokenService.setToken(response.csrf_token || null);
        if (response.bloqueado || (response.user && this.isBlocked(response.user))) {
          this.logout('blocked');
        } else if (response.success && response.user) {
          this.setSession(response.user);
        } else {
          this.clearSession();
          this.csrfTokenService.setToken(response.csrf_token || null);
        }
      }),
      catchError(err => {
        if (err.status === 403 || err.error?.bloqueado) {
          this.logout('blocked');
          return of({ success: false, bloqueado: true, message: 'Su usuario está bloqueado. Por favor, contacte con el administrador.' });
        }
        this.clearSession();
        return of({ success: false, message: err.error?.message || 'Error al validar la sesión.' });
      })
    );
  }

  /**
   * Cierra la sesión activa, elimina el almacenamiento local y redirige según la causa.
   * @param reason Causa del cierre ('blocked' redirige a /login con aviso, 'manual' redirige al inicio, 'silent' no redirige).
   */
  logout(reason: 'blocked' | 'manual' | 'silent' = 'manual'): void {
    this.http.post(this.logoutUrl, {}).subscribe({ error: () => undefined });
    this.clearSession();

    if (reason === 'blocked') {
      void this.router.navigate(['/login'], { queryParams: { blocked: '1' } });
    } else if (reason === 'manual') {
      void this.router.navigate(['/']);
    }
  }

  /**
   * Limpia los datos de sesión en memoria y en almacenamiento local sin redirigir.
   */
  clearSession(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
    this.csrfTokenService.setToken(null);
    this.currentUser.set(null);
  }

  /**
   * Guarda el usuario y token en almacenamiento local y actualiza el Signal.
   */
  private setSession(user: AuthUser): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    }
    this.currentUser.set(user);
  }

  /**
   * Recupera el usuario almacenado en localStorage al iniciar la aplicación.
   * Si detecta que está bloqueado, purga la sesión inmediatamente.
   */
  private getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (!stored) return null;

      const user = JSON.parse(stored) as AuthUser;
      if (this.isBlocked(user)) {
        localStorage.removeItem(STORAGE_USER_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

}

interface SessionResponse {
  success: boolean;
  bloqueado?: boolean;
  user?: AuthUser;
  csrf_token?: string;
  message?: string;
}
