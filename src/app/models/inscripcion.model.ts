export interface Inscripcion {
  id?: number;
  nombre: string;
  apellidos: string;
  estado?: string;
  ip_registro?: string;
  fecha_creacion?: Date | string;
  fecha_actualizacion?: Date | string;
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

