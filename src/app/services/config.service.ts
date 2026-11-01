import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap, map, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfigItem, ConfigResponse, SetMaintenanceRequest } from '../models/configuracion.model';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/configuracion.php`;

  // Estado reactivo del modo mantenimiento y demo de pagos
  readonly isMaintenanceMode = signal<boolean>(false);
  readonly isDemoPago = signal<boolean>(true);
  readonly isLoaded = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);

  /**
   * Consulta el estado del modo mantenimiento y configuración en el backend.
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
        const demoActive = response.demo_pago !== undefined
          ? Boolean(response.demo_pago)
          : (response.demo_pago_valor !== '0' && response.demo_pago_valor !== 'false');

        this.isMaintenanceMode.set(active);
        this.isDemoPago.set(demoActive);
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
   * Actualiza el parámetro de modo mantenimiento en la base de datos (Exclusivo Superadministrador).
   * @param enabled True para activar mantenimiento ('1'), False para desactivarlo ('0').
   */
  setMaintenanceMode(enabled: boolean): Observable<ConfigResponse> {
    const payload: SetMaintenanceRequest = {
      clave: 'mantenimiento',
      valor: enabled ? '1' : '0'
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
   * Actualiza el parámetro de modo demo de pagos en la base de datos (Exclusivo Superadministrador).
   * @param enabled True para activar el simulador ('1'), False para ocultarlo ('0').
   */
  setDemoPagoMode(enabled: boolean): Observable<ConfigResponse> {
    const payload: SetMaintenanceRequest = {
      clave: 'pago_modo_demo',
      valor: enabled ? '1' : '0'
    };

    return this.http.post<ConfigResponse>(this.apiUrl, payload).pipe(
      tap(response => {
        if (response.success) {
          this.isDemoPago.set(enabled);
        }
      })
    );
  }

  /**
   * Obtiene el listado completo de configuraciones para el panel administrativo.
   */
  getFullConfig(): Observable<ConfigItem[]> {
    const params = new HttpParams().set('include_all', '1');

    return this.http.get<ConfigResponse>(this.apiUrl, { params }).pipe(
      map(res => res.configuracion || []),
      catchError(err => {
        console.error('Error al obtener la configuración completa:', err);
        return of([]);
      })
    );
  }
}
