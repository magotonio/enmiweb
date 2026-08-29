/**
 * Definición de tipos y jerarquía de perfiles de usuario
 */
export type UserRole = 'superadministrador' | 'supervisor' | 'asistente';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadministrador: 3,
  supervisor: 2,
  asistente: 1
};

export const ROLE_LABELS: Record<UserRole, string> = {
  superadministrador: 'Superadministrador',
  supervisor: 'Supervisor',
  asistente: 'Asistente'
};

export const ROLE_BADGE_CLASSES: Record<UserRole, { badge: string; text: string; bg: string; border: string }> = {
  superadministrador: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-400/30'
  },
  supervisor: {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-400/30'
  },
  asistente: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-400/30'
  }
};

export interface Usuario {
  id?: number;
  login: string;
  email: string;
  rol: UserRole;
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
  rol: UserRole;
  password: string;
}

export interface UsuarioUpdateDto {
  login?: string;
  email?: string;
  rol?: UserRole;
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
  rol: UserRole;
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

export interface SystemLog {
  id: number;
  nivel: string;
  categoria: string;
  accion: string;
  mensaje: string;
  contexto?: Record<string, any> | null;
  usuario_id?: number | null;
  usuario_login?: string | null;
  usuario_rol?: UserRole | null;
  ip?: string | null;
  user_agent?: string | null;
  origen?: string | null;
  fecha_creacion: string;
}

export interface LogsResponse {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  stats: {
    total: number;
    errores: number;
    warnings: number;
    infos: number;
    auth_events: number;
  };
  data: SystemLog[];
}
