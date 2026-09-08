import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  ModalidadPago,
  PagoAccionResponse,
  PagoConfigInfo,
  PagoManualRequest,
  PagoManualResponse,
  PagosInscripcionResponse,
  RedsysFormParams
} from '../models/inscripcion.model';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly pagoApiUrl = `${environment.apiUrl}/pago.php`;

  /**
   * Obtiene la configuración pública de pagos (importe, datos de Bizum, IBAN bancario, etc.)
   */
  getPagoConfig(): Observable<PagoConfigInfo> {
    return this.http.get<PagoConfigInfo>(`${this.pagoApiUrl}?accion=info`);
  }

  /**
   * Obtiene la lista completa de pagos registrados para una inscripción específica
   */
  getPagosByInscripcion(inscripcionId: number): Observable<PagosInscripcionResponse> {
    let params = new HttpParams()
      .set('accion', 'por_inscripcion')
      .set('inscripcion_id', inscripcionId.toString());

    const currentUser = this.authService.currentUser();
    if (currentUser) {
      if (currentUser.id) {
        params = params.set('user_id', currentUser.id.toString());
      }
      if (currentUser.login) {
        params = params.set('user_login', currentUser.login);
      }
      if (currentUser.email) {
        params = params.set('user_email', currentUser.email);
      }
    }

    return this.http.get<PagosInscripcionResponse>(this.pagoApiUrl, { params });
  }

  /**
   * Solicita al backend los parámetros y firma HMAC-SHA256 para iniciar el pago por Redsys
   */
  iniciarRedsys(inscripcionId: number): Observable<RedsysFormParams> {
    return this.http.post<RedsysFormParams>(this.pagoApiUrl, {
      accion: 'iniciar_redsys',
      inscripcion_id: inscripcionId
    });
  }

  /**
   * Registra la modalidad de pago elegida (bizum, transferencia, otras) y sitúa la inscripción en 'pendiente'
   */
  confirmarModalidad(inscripcionId: number, modalidad: ModalidadPago): Observable<PagoAccionResponse> {
    return this.http.post<PagoAccionResponse>(this.pagoApiUrl, {
      accion: 'confirmar_modalidad',
      inscripcion_id: inscripcionId,
      modalidad
    });
  }

  /**
   * Ejecuta el simulador de Redsys para pruebas en desarrollo/sandbox local
   * resultado: 'ok' -> pasa a 'pagada' | 'ko' -> pasa a 'pendiente'
   */
  simularRedsys(inscripcionId: number, resultado: 'ok' | 'ko'): Observable<PagoAccionResponse> {
    return this.http.post<PagoAccionResponse>(this.pagoApiUrl, {
      accion: 'simular_redsys',
      inscripcion_id: inscripcionId,
      resultado
    });
  }

  /**
   * Sincroniza el retorno de pasarela Redsys (ok / ko) para registrar el resultado en la tabla de compras/pagos
   */
  sincronizarRetornoRedsys(inscripcionId: number, pagoStatus: 'ok' | 'ko'): Observable<PagoAccionResponse> {
    return this.http.post<PagoAccionResponse>(this.pagoApiUrl, {
      accion: 'sincronizar_retorno_redsys',
      inscripcion_id: inscripcionId,
      pago_status: pagoStatus
    });
  }

  /**
   * Registra un pago manual autorizado por supervisor o superadministrador.
   * Crea un nuevo registro auditado en enmi_pagos y actualiza el estado a 'pagada'.
   */
  registrarPagoManual(request: PagoManualRequest): Observable<PagoManualResponse> {
    const currentUser = this.authService.currentUser();
    const payload = {
      accion: 'registrar_pago_manual',
      inscripcion_id: request.inscripcion_id,
      modalidad: request.modalidad,
      cantidad: request.cantidad,
      notas: request.notas || '',
      enviar_email: !!request.enviar_email,
      user_id: currentUser?.id,
      user_login: currentUser?.login,
      user_email: currentUser?.email
    };

    return this.http.post<PagoManualResponse>(this.pagoApiUrl, payload);
  }

  /**
   * Redirige formalmente a la pasarela Redsys mediante POST dinámico
   */
  submitToRedsysGateway(params: RedsysFormParams): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = params.tpv_url;
    form.target = '_self';

    const inputs: Record<string, string> = {
      Ds_SignatureVersion: params.Ds_SignatureVersion,
      Ds_MerchantParameters: params.Ds_MerchantParameters,
      Ds_Signature: params.Ds_Signature
    };

    for (const [key, value] of Object.entries(inputs)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }
}
