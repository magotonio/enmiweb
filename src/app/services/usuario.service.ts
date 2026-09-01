import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, UsuarioCreateDto, UserRole, VerificarTokenResponse, RestablecerPasswordDto } from '../models/usuario.model';
import { environment } from '../../environments/environment';

export interface UsuariosListResponse {
  success: boolean;
  count: number;
  data: Usuario[];
  message?: string;
}

export interface GenericUserActionResponse {
  success: boolean;
  message: string;
  user?: Usuario;
  bloqueado?: boolean;
  errors?: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/usuarios.php`;
  private readonly recuperacionUrl = `${environment.apiUrl}/recuperacion.php`;

  /**
   * Obtiene el listado completo de usuarios del sistema (exclusivo para superadministrador).
   */
  getUsuarios(): Observable<UsuariosListResponse> {
    return this.http.get<UsuariosListResponse>(this.apiUrl);
  }

  /**
   * Crea un nuevo usuario con el rol asignado y le emite un enlace de 24h para definir su contraseña.
   */
  createUsuario(dto: UsuarioCreateDto): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.apiUrl, {
      action: 'create',
      ...dto
    });
  }

  /**
   * Actualiza el rol de un usuario existente.
   */
  updateRol(id: number, rol: UserRole): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.apiUrl, {
      action: 'update_role',
      id,
      rol
    });
  }

  /**
   * Alterna el estado de bloqueo de un usuario y resetea los intentos fallidos al desbloquear.
   */
  toggleBlock(id: number, bloqueado: boolean): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.apiUrl, {
      action: 'toggle_block',
      id,
      bloqueado: bloqueado ? 1 : 0
    });
  }

  /**
   * El Superadministrador solicita el restablecimiento de contraseña de un usuario (envía token de 24h por email).
   */
  resetPassword(id: number): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.apiUrl, {
      action: 'reset_password',
      id
    });
  }

  /**
   * El usuario solicita enlace de recuperación desde el login indicando su email/usuario.
   */
  solicitarRecuperacion(email: string): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.recuperacionUrl, {
      action: 'solicitar',
      email: email.trim()
    });
  }

  /**
   * Comprueba si un token de restablecimiento es válido y no ha caducado (24h).
   */
  verificarToken(token: string): Observable<VerificarTokenResponse> {
    return this.http.post<VerificarTokenResponse>(this.recuperacionUrl, {
      action: 'verificar',
      token: token.trim()
    });
  }

  /**
   * Ejecuta el cambio de contraseña usando el token seguro de restablecimiento.
   */
  ejecutarResetPassword(dto: RestablecerPasswordDto): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.recuperacionUrl, {
      action: 'resetear',
      token: dto.token.trim(),
      password: dto.password
    });
  }
}
