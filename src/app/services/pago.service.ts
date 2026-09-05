import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ModalidadPago,
  PagoAccionResponse,
  PagoConfigInfo,
  RedsysFormParams
} from '../models/inscripcion.model';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly pagoApiUrl = `${environment.apiUrl}/pago.php`;

  /**
   * Obtiene la configuración pública de pagos (importe, datos de Bizum, IBAN bancario, etc.)
   */
  getPagoConfig(): Observable<PagoConfigInfo> {
    return this.http.get<PagoConfigInfo>(`${this.pagoApiUrl}?accion=info`);
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
