import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap, map, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ConfigItem, ConfigResponse, SetMaintenanceRequest } from '../models/configuracion.model';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/configuracion.php`;

  // Estado reactivo del modo mantenimiento
  readonly isMaintenanceMode = signal<boolean>(false);
  readonly isLoaded = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);

  /**
   * Consulta el estado del modo mantenimiento en el backend.
   * @param forceRefresh Si es true, ignora el valor precargado y realiza petición HTTP obligatoria.
   */
  checkMaintenance(forceRefresh = false): Observable<boolean> {
    if (!forceRefresh && this.isLoaded()) {
      return of(this.isMaintenanceMode());
    }

    this.isLoading.set(true);
    return this.http.get<ConfigResponse>(this.apiUrl).pipe(
      map(response => {
        const active = Boolean(
          response.mantenimiento ||
          response.mantenimiento_valor === '1' ||
          response.mantenimiento_valor === 'true'
        );
        this.isMaintenanceMode.set(active);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        return active;
      }),
      catchError(err => {
        console.warn('No se pudo verificar el modo mantenimiento en el backend:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        return of(this.isMaintenanceMode());
      })
    );
  }

  /**
   * Actualiza el parámetro de modo mantenimiento en la base de datos (Exclusivo Superadmin y Supervisor).
   * @param enabled True para activar mantenimiento ('1'), False para desactivarlo ('0').
   */
  setMaintenanceMode(enabled: boolean): Observable<ConfigResponse> {
    const user = this.authService.currentUser();
    const payload: SetMaintenanceRequest = {
      clave: 'mantenimiento',
      valor: enabled ? '1' : '0',
      operator_id: user?.id,
      operator_login: user?.login
    };

    return this.http.post<ConfigResponse>(this.apiUrl, payload).pipe(
      tap(response => {
        if (response.success) {
          this.isMaintenanceMode.set(enabled);
        }
      })
    );
  }

  /**
   * Obtiene el listado completo de configuraciones para el panel administrativo.
   */
  getFullConfig(): Observable<ConfigItem[]> {
    const user = this.authService.currentUser();
    let params = new HttpParams().set('include_all', '1');
    if (user?.id) {
      params = params.set('operator_id', user.id.toString());
    }
    if (user?.login) {
      params = params.set('operator_login', user.login);
    }

    return this.http.get<ConfigResponse>(this.apiUrl, { params }).pipe(
      map(res => res.configuracion || []),
      catchError(err => {
        console.error('Error al obtener la configuración completa:', err);
        return of([]);
      })
    );
  }
}
