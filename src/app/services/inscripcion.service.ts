import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Inscripcion,
  InscripcionApiResponse,
  InscripcionFormData,
  InscripcionesFilterParams,
  InscripcionesListResponse
} from '../models/inscripcion.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InscripcionService {
  private readonly http = inject(HttpClient);
  private readonly inscribirApiUrl = `${environment.apiUrl}/inscribir.php`;
  private readonly inscripcionesApiUrl = `${environment.apiUrl}/inscripciones.php`;

  /**
   * Envía los datos del formulario a la API PHP para su registro en MariaDB.
   * 
   * @param data Datos del formulario (nombre, apellidos)
   * @returns Observable con la respuesta estandarizada de la API
   */
  inscribir(data: InscripcionFormData): Observable<InscripcionApiResponse> {
    return this.http.post<InscripcionApiResponse>(this.inscribirApiUrl, data);
  }

  /**
   * Obtiene la lista de participantes inscritos con filtros y ordenación opcionales.
   * 
   * @param filterParams Parámetros de búsqueda, filtro por estado y ordenación
   * @returns Observable con la lista de inscritos y métricas
   */
  getInscripciones(filterParams?: InscripcionesFilterParams): Observable<InscripcionesListResponse> {
    let params = new HttpParams();

    if (filterParams) {
      if (filterParams.q) {
        params = params.set('q', filterParams.q);
      }
      if (filterParams.estado) {
        params = params.set('estado', filterParams.estado);
      }
      if (filterParams.sort) {
        params = params.set('sort', filterParams.sort);
      }
      if (filterParams.order) {
        params = params.set('order', filterParams.order);
      }
    }

    return this.http.get<InscripcionesListResponse>(this.inscripcionesApiUrl, { params });
  }

  /**
   * Genera y descarga un archivo CSV con el listado de participantes proporcionado.
   * Incluye la marca BOM (\uFEFF) para compatibilidad nativa con Microsoft Excel en caracteres en español.
   * 
   * @param inscripciones Array de inscripciones a exportar
   * @param filename Nombre del archivo a descargar (por defecto 'inscritos_enmi_2027_YYYY-MM-DD.csv')
   */
  exportToCsv(inscripciones: Inscripcion[], filename?: string): void {
    if (!inscripciones || inscripciones.length === 0) {
      return;
    }

    const headers = ['ID', 'Nombre', 'Apellidos', 'Estado', 'IP Registro', 'Fecha de Registro'];
    const rows = inscripciones.map(item => [
      item.id.toString(),
      `"${(item.nombre || '').replace(/"/g, '""')}"`,
      `"${(item.apellidos || '').replace(/"/g, '""')}"`,
      `"${(item.estado || 'activo').replace(/"/g, '""')}"`,
      `"${(item.ip_registro || '').replace(/"/g, '""')}"`,
      `"${(item.fecha_creacion || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const defaultFilename = `inscritos_enmi_2027_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename || defaultFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
