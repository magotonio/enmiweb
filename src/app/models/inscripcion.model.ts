export interface Inscripcion {
  id: number;
  nombre: string;
  apellidos: string;
  nombre_artistico?: string | null;
  nif_pasaporte: string;
  email: string;
  telefono: string;
  origen: string;
  asociacion?: string | null;
  quiero_participar: boolean;
  acepta_privacidad: boolean;
  consentimiento_imagen: boolean;
  comentarios?: string | null;
  estado?: string;
  ip_registro?: string | null;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
}

export interface InscripcionFormData {
  nombre: string;
  apellidos: string;
  nombre_artistico?: string | null;
  nif_pasaporte: string;
  email: string;
  telefono: string;
  origen: string;
  asociacion?: string | null;
  quiero_participar: boolean;
  acepta_privacidad: boolean;
  consentimiento_imagen: boolean;
  comentarios?: string | null;
}

export interface InscripcionApiResponse {
  success: boolean;
  message: string;
  id?: number;
  data?: {
    nombre: string;
    apellidos: string;
    nombre_artistico?: string | null;
    email: string;
    quiero_participar: boolean;
  };
  errors?: Record<string, string>;
  notificacion?: {
    enviada: boolean;
    mensaje: string;
  };
}

export interface InscripcionesStats {
  total: number;
  hoy: number;
  activos: number;
  quieren_participar?: number;
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
  sort?: 'id' | 'nombre' | 'apellidos' | 'nombre_artistico' | 'email' | 'nif_pasaporte' | 'origen' | 'quiero_participar' | 'fecha_creacion' | 'estado';
  order?: 'ASC' | 'DESC';
}
