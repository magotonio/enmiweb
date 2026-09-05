import { Injectable, signal } from '@angular/core';
import { EstadoInscripcion, InscripcionSessionData, ModalidadPago } from '../models/inscripcion.model';

const SESSION_KEY = 'enmi_inscripcion_session';

@Injectable({
  providedIn: 'root'
})
export class InscripcionSessionService {
  private readonly sessionSignal = signal<InscripcionSessionData | null>(this.readFromStorage());

  /**
   * Señal reactiva de sólo lectura con el estado de la inscripción actual en sesión
   */
  readonly currentSession = this.sessionSignal.asReadonly();

  /**
   * Guarda o reemplaza los datos de inscripción en sessionStorage
   */
  saveSession(data: InscripcionSessionData): void {
    try {
      const payload: InscripcionSessionData = {
        ...data,
        registeredAt: data.registeredAt || new Date().toISOString()
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      this.sessionSignal.set(payload);
    } catch (e) {
      console.error('[InscripcionSessionService] Error al guardar en sessionStorage', e);
      this.sessionSignal.set(data);
    }
  }

  /**
   * Obtiene los datos actuales de la inscripción desde sessionStorage o la señal reactiva
   */
  getSession(): InscripcionSessionData | null {
    return this.sessionSignal() || this.readFromStorage();
  }

  /**
   * Comprueba si existe una inscripción activa válida en la sesión
   */
  hasSession(): boolean {
    const session = this.getSession();
    return !!(session && session.id && session.id > 0);
  }

  /**
   * Actualiza el estado (ej. 'iniciada', 'pendiente', 'pagada') y opcionalmente la modalidad
   */
  updateStatus(status: EstadoInscripcion, modalidad?: ModalidadPago): void {
    const current = this.getSession();
    if (!current) return;

    const updated: InscripcionSessionData = {
      ...current,
      status,
      ...(modalidad ? { modalidad } : {})
    };
    this.saveSession(updated);
  }

  /**
   * Actualiza la modalidad seleccionada
   */
  updateModalidad(modalidad: ModalidadPago): void {
    const current = this.getSession();
    if (!current) return;

    const updated: InscripcionSessionData = {
      ...current,
      modalidad
    };
    this.saveSession(updated);
  }

  /**
   * Limpia la sesión de inscripción (por ejemplo al querer registrar otro participante)
   */
  clearSession(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error('[InscripcionSessionService] Error al limpiar sessionStorage', e);
    }
    this.sessionSignal.set(null);
  }

  private readFromStorage(): InscripcionSessionData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        return parsed as InscripcionSessionData;
      }
    } catch {
      // Ignorar errores de parseo
    }
    return null;
  }
}
