import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, UsuarioCreateDto, UserRole } from '../models/usuario.model';
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

  /**
   * Obtiene el listado completo de usuarios del sistema (exclusivo para superadministrador).
   */
  getUsuarios(): Observable<UsuariosListResponse> {
    return this.http.get<UsuariosListResponse>(this.apiUrl);
  }

  /**
   * Crea un nuevo usuario con el rol y credenciales asignadas.
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
   * Restablece la contraseña de un usuario a un nuevo valor.
   */
  resetPassword(id: number, newPassword: string): Observable<GenericUserActionResponse> {
    return this.http.post<GenericUserActionResponse>(this.apiUrl, {
      action: 'reset_password',
      id,
      new_password: newPassword
    });
  }
}
