export interface Usuario {
  id?: number;
  login: string;
  email: string;
  password_hash?: string;
  ultimo_login?: Date | string | null;
  bloqueado: boolean | number;
  intentos_fallidos?: number;
  fecha_creacion?: Date | string;
  fecha_actualizacion?: Date | string | null;
}

export interface UsuarioCreateDto {
  login: string;
  email: string;
  password: string; // Contraseña en texto plano para ser encriptada en backend
}

export interface UsuarioUpdateDto {
  login?: string;
  email?: string;
  password?: string;
  bloqueado?: boolean;
  intentos_fallidos?: number;
}

export interface RecuperacionPassword {
  id?: number;
  usuario_id: number;
  email: string;
  token_hash: string;
  expira_en: Date | string;
  utilizado: boolean | number;
  ip_solicitud?: string | null;
  fecha_creacion?: Date | string;
  fecha_utilizacion?: Date | string | null;
}

export interface SolicitudRecuperacionDto {
  email: string;
}

export interface RestablecerPasswordDto {
  token: string;
  password: string;
}

export interface AuthUser {
  id: number;
  login: string;
  email: string;
  bloqueado?: boolean | number;
  intentos_fallidos?: number;
}

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  bloqueado?: boolean | number;
  intentos_fallidos?: number;
  user?: AuthUser;
  token?: string;
  errors?: Record<string, string>;
}

