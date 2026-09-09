import { Injectable, signal } from '@angular/core';

export type ConfirmDialogType = 'warning' | 'danger' | 'info' | 'success';

export interface ConfirmOptions {
  titulo?: string;
  mensaje?: string;
  cuerpo?: string;
  textoAceptar?: string;
  textoCancelar?: string;
  tipo?: ConfirmDialogType;
}

export interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private readonly _state = signal<ConfirmDialogState>({
    isOpen: false
  });

  readonly state = this._state.asReadonly();

  /**
   * Abre un modal de confirmación con título, cuerpo y botones Aceptar / Cancelar.
   * Retorna una Promesa que resuelve a `true` si el usuario acepta o `false` si cancela.
   */
  confirm(options: string | ConfirmOptions): Promise<boolean> {
    const opts: ConfirmOptions = typeof options === 'string'
      ? { mensaje: options }
      : options;

    return new Promise<boolean>((resolve) => {
      this._state.set({
        isOpen: true,
        titulo: opts.titulo || 'Confirmación',
        mensaje: opts.mensaje || opts.cuerpo || '¿Estás seguro de que deseas continuar?',
        textoAceptar: opts.textoAceptar || 'Aceptar',
        textoCancelar: opts.textoCancelar || 'Cancelar',
        tipo: opts.tipo || 'warning',
        resolve
      });
    });
  }

  aceptar(): void {
    const current = this._state();
    if (current.resolve) {
      current.resolve(true);
    }
    this._state.set({ isOpen: false });
  }

  cancelar(): void {
    const current = this._state();
    if (current.resolve) {
      current.resolve(false);
    }
    this._state.set({ isOpen: false });
  }
}
