import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InscripcionApiResponse, InscripcionFormData } from '../models/inscripcion.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InscripcionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/inscribir.php`;

  /**
   * Envía los datos del formulario a la API PHP para su registro en MariaDB.
   * 
   * @param data Datos del formulario (nombre, apellidos)
   * @returns Observable con la respuesta estandarizada de la API
   */
  inscribir(data: InscripcionFormData): Observable<InscripcionApiResponse> {
    return this.http.post<InscripcionApiResponse>(this.apiUrl, data);
  }
}
