export interface Inscripcion {
  id: number;
  nombre: string;
  apellidos: string;
  estado?: string;
  ip_registro?: string | null;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
}

export interface InscripcionFormData {
  nombre: string;
  apellidos: string;
}

export interface InscripcionApiResponse {
  success: boolean;
  message: string;
  id?: number;
  data?: {
    nombre: string;
    apellidos: string;
  };
  errors?: Record<string, string>;
}

export interface InscripcionesStats {
  total: number;
  hoy: number;
  activos: number;
}

export interface InscripcionesListResponse {
  success: boolean;
  count: number;
  stats?: InscripcionesStats;
  data: Inscripcion[];
  message?: string;
}

export interface InscripcionesFilterParams {
  q?: string;
  estado?: string;
  sort?: 'id' | 'nombre' | 'apellidos' | 'fecha_creacion' | 'estado';
  order?: 'ASC' | 'DESC';
}
