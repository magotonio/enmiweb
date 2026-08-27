import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthUser, LoginCredentials, LoginResponse } from '../models/usuario.model';
import { environment } from '../../environments/environment';

const STORAGE_USER_KEY = 'enmi_auth_user';
const STORAGE_TOKEN_KEY = 'enmi_auth_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/login.php`;

  // Estado reactivo del usuario conectado
  readonly currentUser = signal<AuthUser | null>(this.getStoredUser());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /**
   * Inicia sesión enviando credenciales a la API PHP.
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, credentials).pipe(
      tap(response => {
        if (response.success && response.user) {
          this.setSession(response.user, response.token);
        }
      })
    );
  }

  /**
   * Cierra la sesión activa, elimina el almacenamiento local y redirige al inicio.
   */
  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  /**
   * Guarda el usuario y token en almacenamiento local y actualiza el Signal.
   */
  private setSession(user: AuthUser, token?: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      if (token) {
        localStorage.setItem(STORAGE_TOKEN_KEY, token);
      }
    }
    this.currentUser.set(user);
  }

  /**
   * Recupera el usuario almacenado en localStorage al iniciar la aplicación.
   */
  private getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  /**
   * Obtiene el token de autenticación almacenado.
   */
  getToken(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  }
}
