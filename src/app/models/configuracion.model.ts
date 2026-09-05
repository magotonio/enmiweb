/**
 * Modelo y tipos para la configuración dinámica del sistema
 */

export interface ConfigItem {
  id?: number;
  clave: string;
  valor: string | null;
  descripcion?: string | null;
  fecha_actualizacion?: string | null;
}

export interface ConfigResponse {
  success: boolean;
  mantenimiento: boolean;
  mantenimiento_valor?: string;
  demo_pago?: boolean;
  demo_pago_valor?: string;
  configuracion?: ConfigItem[];
  message?: string;
  clave?: string;
  valor?: string;
}

export interface SetConfigRequest {
  mantenimiento?: string | boolean;
  demo_pago?: string | boolean;
  clave?: string;
  valor?: string;
  operator_id?: number;
  operator_login?: string;
}

export type SetMaintenanceRequest = SetConfigRequest;
