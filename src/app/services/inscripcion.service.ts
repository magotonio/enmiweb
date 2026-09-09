import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ActualizarEstadoInscripcionResponse,
  EstadoInscripcion,
  Inscripcion,
  InscripcionApiResponse,
  InscripcionFormData,
  InscripcionesFilterParams,
  InscripcionesListResponse
} from '../models/inscripcion.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InscripcionService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly inscribirApiUrl = `${environment.apiUrl}/inscribir.php`;
  private readonly inscripcionesApiUrl = `${environment.apiUrl}/inscripciones.php`;

  /**
   * Envía los datos del formulario a la API PHP para su registro en MariaDB.
   * Si el usuario actual está autenticado (personal de la organización), se adjuntan sus credenciales
   * de operador para permitir el registro incluso cuando la web se encuentre en Modo Mantenimiento.
   * 
   * @param data Datos del formulario de inscripción
   * @returns Observable con la respuesta estandarizada de la API
   */
  inscribir(data: InscripcionFormData): Observable<InscripcionApiResponse> {
    const currentUser = this.authService.currentUser();
    const payload: InscripcionFormData & { operator_id?: number; operator_login?: string; operator_email?: string } = {
      ...data
    };

    if (currentUser) {
      if (currentUser.id) {
        payload.operator_id = currentUser.id;
      }
      if (currentUser.login) {
        payload.operator_login = currentUser.login;
      }
      if (currentUser.email) {
        payload.operator_email = currentUser.email;
      }
    }

    return this.http.post<InscripcionApiResponse>(this.inscribirApiUrl, payload);
  }

  /**
   * Obtiene la lista de participantes inscritos con filtros y ordenación opcionales.
   * Si el usuario tiene rol 'asistente', el backend restringirá los datos automáticamente
   * a su propia inscripción personal.
   * 
   * @param filterParams Parámetros de búsqueda, filtro por estado y ordenación
   * @returns Observable con la lista de inscritos y métricas
   */
  getInscripciones(filterParams?: InscripcionesFilterParams): Observable<InscripcionesListResponse> {
    let params = new HttpParams();

    // Adjuntar identificación del usuario actual para el control de acceso y privacidad
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
   * Actualiza el estado de una inscripción (por ejemplo, a 'pagada').
   * Requiere rol de supervisor o superadministrador.
   * 
   * @param inscripcionId ID numérico de la inscripción
   * @param estado Nuevo estado ('iniciada', 'pendiente', 'pagada', 'cancelada', 'activo')
   * @returns Observable con la respuesta del servidor
   */
  actualizarEstado(
    inscripcionId: number,
    estado: EstadoInscripcion
  ): Observable<ActualizarEstadoInscripcionResponse> {
    const currentUser = this.authService.currentUser();
    const payload = {
      accion: 'actualizar_estado',
      id: inscripcionId,
      inscripcion_id: inscripcionId,
      estado,
      user_id: currentUser?.id,
      user_login: currentUser?.login,
      user_email: currentUser?.email
    };

    return this.http.post<ActualizarEstadoInscripcionResponse>(this.inscripcionesApiUrl, payload);
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

    const headers = [
      'ID',
      'Nombre',
      'Apellidos',
      'Nombre Artístico',
      'NIF / Pasaporte',
      'Correo Electrónico',
      'Teléfono Móvil',
      'Lugar de Residencia',
      'Asociación Mágica',
      'Quiero Participar',
      'Consentimiento Imagen',
      'Comentarios',
      'Estado',
      'IP Registro',
      'Fecha de Registro'
    ];

    const rows = inscripciones.map(item => [
      item.id.toString(),
      `"${(item.nombre || '').replace(/"/g, '""')}"`,
      `"${(item.apellidos || '').replace(/"/g, '""')}"`,
      `"${(item.nombre_artistico || '').replace(/"/g, '""')}"`,
      `"${(item.nif_pasaporte || '').replace(/"/g, '""')}"`,
      `"${(item.email || '').replace(/"/g, '""')}"`,
      `"${(item.telefono || '').replace(/"/g, '""')}"`,
      `"${(item.origen || '').replace(/"/g, '""')}"`,
      `"${(item.asociacion || '').replace(/"/g, '""')}"`,
      item.quiero_participar ? '"SÍ"' : '"NO"',
      item.consentimiento_imagen ? '"SÍ"' : '"NO"',
      `"${(item.comentarios || '').replace(/"/g, '""')}"`,
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
