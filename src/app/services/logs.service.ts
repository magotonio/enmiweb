import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LogsResponse } from '../models/usuario.model';
import { environment } from '../../environments/environment';

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
  private readonly apiUrl = `${environment.apiUrl}/logs.php`;

  /**
   * Obtiene los logs de auditoría y estadísticas del sistema.
   */
  getLogs(filters?: LogsFilterParams): Observable<LogsResponse> {
    let params = new HttpParams();

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
    return this.http.post<{ success: boolean; message: string }>(this.apiUrl, {
      action: 'clear_old'
    });
  }
}
