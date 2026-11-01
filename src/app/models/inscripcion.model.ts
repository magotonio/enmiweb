export type EstadoInscripcion = 'iniciada' | 'pendiente' | 'pagada' | 'cancelada' | 'activo' | string;
export type ModalidadPago = 'redsys' | 'bizum' | 'transferencia' | 'otras';

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
  estado?: EstadoInscripcion;
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
  duplicado?: boolean;
  id?: number;
  estado?: EstadoInscripcion;
  data?: {
    id?: number;
    nombre: string;
    apellidos: string;
    nombre_artistico?: string | null;
    email: string;
    estado?: EstadoInscripcion;
    quiero_participar: boolean;
  };
  errors?: Record<string, string>;
  notificacion?: {
    enviada: boolean;
    mensaje: string;
  };
  notificacion_admin?: {
    enviada: boolean;
    mensaje: string;
  };
  email_participante?: {
    enviado: boolean;
    destinatario?: string;
    mensaje: string;
  };
}

export interface InscripcionesStats {
  total: number;
  hoy: number;
  activos: number;
  pagadas?: number;
  pendientes?: number;
  iniciadas?: number;
  canceladas?: number;
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

export interface PagoConfigInfo {
  success: boolean;
  message?: string;
  importe: string;
  bizum: {
    telefono: string;
    beneficiario: string;
  };
  transferencia: {
    iban: string;
    titular: string;
    banco: string;
    concepto_template: string;
  };
  otras: {
    texto: string;
  };
  redsys: {
    activo: boolean;
    entorno: string;
    sandbox: boolean;
    tpv_url: string;
  };
  demo_pago?: boolean;
}

export interface RedsysFormParams {
  success: boolean;
  inscripcion_id: number;
  tpv_url: string;
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
  order: string;
  importe: string;
  sandbox: boolean;
  message?: string;
}

export interface DescuentoTokenInfo {
  valido: boolean;
  token_id: number;
  token: string;
  descuento: number;
  descuento_str: string;
  precio_original: number;
  nuevo_total: number;
  nuevo_total_str: string;
  usos_restantes: number;
  descripcion?: string;
  mensaje?: string;
}

export interface DescuentoValidarResponse {
  success: boolean;
  descuento?: DescuentoTokenInfo;
  message?: string;
}

export interface PagoAccionResponse {
  success: boolean;
  inscripcion_id?: number;
  estado?: EstadoInscripcion;
  modalidad?: ModalidadPago;
  resultado?: string;
  compra_id?: number;
  estado_compra?: string;
  importe?: string;
  descuento_aplicado?: any;
  message?: string;
}

export interface InscripcionSessionData {
  id: number;
  fullName: string;
  artistName?: string;
  apellidos: string;
  email: string;
  telefono: string;
  status: EstadoInscripcion;
  modalidad?: ModalidadPago | null;
  descuento?: DescuentoTokenInfo | null;
  registeredAt?: string;
}

export interface PagoRegistro {
  id: number;
  inscripcion_id: number;
  referencia: string;
  concepto?: string;
  cantidad_pagada: number;
  modalidad_pago: string;
  estado: string;
  tipo_registro: 'promesa' | 'manual_administracion' | 'redsys' | 'simulacion' | 'desconocido';
  pago_confirmado: boolean;
  fecha_compra?: string | null;
  notas?: string | null;
  datos_transaccion?: Record<string, any> | string | null;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
}

export interface PagoManualRequest {
  inscripcion_id: number;
  modalidad: string;
  cantidad: number;
  notas?: string;
  enviar_email?: boolean;
  marcar_como_pagado?: boolean;
}

export interface PagoManualResponse {
  success: boolean;
  message?: string;
  inscripcion_id: number;
  nuevo_estado: EstadoInscripcion;
  pago_id: number;
  pago: PagoRegistro;
  email_enviado?: boolean;
  email_mensaje?: string;
}

export interface PagosInscripcionResponse {
  success: boolean;
  inscripcion_id?: number;
  estado?: EstadoInscripcion;
  total?: number;
  pagos: PagoRegistro[];
  message?: string;
}

export interface ActualizarEstadoInscripcionResponse {
  success: boolean;
  message?: string;
  inscripcion_id?: number;
  nuevo_estado?: EstadoInscripcion;
  estado?: EstadoInscripcion;
}
