import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LogsResponse } from '../models/usuario.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface LogsFilterParams {
  q?: string;
  nivel?: string;
  categoria?: string;
  limit?: number;
  offset?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/logs.php`;

  /**
   * Obtiene los logs de auditoría y estadísticas del sistema (Exclusivo Superadministrador).
   */
  getLogs(filters?: LogsFilterParams): Observable<LogsResponse> {
    let params = new HttpParams();
    const user = this.authService.currentUser();
    if (user?.id) {
      params = params.set('operator_id', user.id.toString());
    }
    if (user?.login) {
      params = params.set('operator_login', user.login);
    }

    if (filters) {
      if (filters.q) params = params.set('q', filters.q);
      if (filters.nivel && filters.nivel !== 'TODOS') params = params.set('nivel', filters.nivel);
      if (filters.categoria && filters.categoria !== 'todas') params = params.set('categoria', filters.categoria);
      if (filters.limit) params = params.set('limit', filters.limit.toString());
      if (filters.offset) params = params.set('offset', filters.offset.toString());
    }

    return this.http.get<LogsResponse>(this.apiUrl, { params });
  }

  /**
   * Limpia logs antiguos (más de 60 días) - Exclusivo para Superadministrador.
   */
  clearOldLogs(): Observable<{ success: boolean; message: string }> {
    const user = this.authService.currentUser();
    return this.http.post<{ success: boolean; message: string }>(this.apiUrl, {
      action: 'clear_old',
      operator_id: user?.id,
      operator_login: user?.login
    });
  }
}
