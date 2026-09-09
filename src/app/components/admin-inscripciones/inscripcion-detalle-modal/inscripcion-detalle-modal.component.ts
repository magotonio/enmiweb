import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Inscripcion, PagoManualRequest, PagoRegistro } from '../../../models/inscripcion.model';
import { PagoService } from '../../../services/pago.service';
import { AuthService } from '../../../services/auth.service';
import { TARIFA_DEFECTO } from '../../../constants/app.constants';

@Component({
  selector: 'app-inscripcion-detalle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  templateUrl: './inscripcion-detalle-modal.component.html',
  styleUrl: './inscripcion-detalle-modal.component.css'
})
export class InscripcionDetalleModalComponent implements OnInit, OnChanges {
  @Input() inscripcion: Inscripcion | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() inscripcionActualizada = new EventEmitter<Inscripcion>();

  private readonly pagoService = inject(PagoService);
  readonly authService = inject(AuthService);

  readonly isSupervisor = this.authService.isSupervisor;

  readonly pagos = signal<PagoRegistro[]>([]);
  readonly cargandoPagos = signal<boolean>(false);
  readonly errorPagos = signal<string | null>(null);
  readonly detallePagoExpandido = signal<number | null>(null);

  // Tarifa oficial de inscripción obtenida de BD (fallback a constante 250)
  readonly tarifaInscripcion = signal<number>(TARIFA_DEFECTO);

  // Estados reactivos para el formulario de Registro Manual de Pago
  readonly mostrarFormPagoManual = signal<boolean>(false);
  readonly modalidadPagoManual = signal<string>('transferencia');
  readonly cantidadPagoManual = signal<number>(TARIFA_DEFECTO);
  readonly notasPagoManual = signal<string>('');
  readonly enviarEmailPagoManual = signal<boolean>(true);
  readonly marcarComoPagado = signal<boolean>(false);
  readonly guardandoPagoManual = signal<boolean>(false);
  readonly errorPagoManual = signal<string | null>(null);
  readonly mensajeExitoPagoManual = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarConfiguracionPago();
  }

  private cargarConfiguracionPago(): void {
    this.pagoService.getPagoConfig().subscribe({
      next: (config) => {
        if (config?.importe) {
          const imp = parseFloat(config.importe);
          if (!isNaN(imp) && imp > 0) {
            this.tarifaInscripcion.set(imp);
            if (this.cantidadPagoManual() === TARIFA_DEFECTO) {
              this.cantidadPagoManual.set(imp);
            }
          }
        }
      },
      error: () => {
        // Fallback a TARIFA_DEFECTO ya establecido en el signal
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inscripcion']) {
      this.mostrarFormPagoManual.set(false);
      this.errorPagoManual.set(null);
      this.mensajeExitoPagoManual.set(null);
      if (this.inscripcion?.id) {
        this.cargarPagos(this.inscripcion.id);
      } else {
        this.pagos.set([]);
        this.errorPagos.set(null);
        this.detallePagoExpandido.set(null);
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.inscripcion) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  getInitials(nombre?: string, apellidos?: string): string {
    const n = (nombre || '').trim().charAt(0);
    const a = (apellidos || '').trim().charAt(0);
    return `${n}${a}`.toUpperCase() || 'EN';
  }

  cargarPagos(inscripcionId: number): void {
    this.cargandoPagos.set(true);
    this.errorPagos.set(null);

    this.pagoService.getPagosByInscripcion(inscripcionId).subscribe({
      next: (res) => {
        this.cargandoPagos.set(false);
        if (res.success && Array.isArray(res.pagos)) {
          this.pagos.set(res.pagos);
        } else {
          this.pagos.set([]);
        }
      },
      error: (err) => {
        this.cargandoPagos.set(false);
        this.errorPagos.set(err?.error?.message || 'No se pudieron recuperar los pagos de la inscripción.');
      }
    });
  }

  toggleDetallePago(pagoId: number): void {
    if (this.detallePagoExpandido() === pagoId) {
      this.detallePagoExpandido.set(null);
    } else {
      this.detallePagoExpandido.set(pagoId);
    }
  }

  getTotalPagado(): number {
    return this.pagos()
      .filter((p) => p.estado === 'pagado' || p.estado === 'pagada')
      .reduce((sum, p) => sum + (Number(p.cantidad_pagada) || 0), 0);
  }

  hasDetallesTecnicos(pago: PagoRegistro): boolean {
    if (!pago.datos_transaccion) return false;
    if (typeof pago.datos_transaccion === 'object') {
      return Object.keys(pago.datos_transaccion).length > 0;
    }
    return String(pago.datos_transaccion).trim().length > 0;
  }

  formatJson(data: any): string {
    if (!data) return '';
    if (typeof data === 'string') {
      try {
        return JSON.stringify(JSON.parse(data), null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  }

  getBadgeModalidad(modalidad: string): { label: string; class: string } {
    const mod = (modalidad || '').toLowerCase().trim();
    switch (mod) {
      case 'redsys':
        return { label: 'Redsys / Tarjeta', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'bizum':
        return { label: 'Bizum', class: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'transferencia':
        return { label: 'Transferencia Bancaria', class: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'otras':
        return { label: 'Otras Modalidades', class: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: modalidad || 'No especificada', class: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  }

  getBadgeEstadoPago(estado: string): { label: string; class: string; dotClass: string } {
    const st = (estado || '').toLowerCase().trim();
    switch (st) {
      case 'pagado':
      case 'pagada':
        return { label: 'Pagado', class: 'bg-emerald-50 text-emerald-700 border-emerald-300', dotClass: 'bg-emerald-500' };
      case 'no-pagado':
        return { label: 'No pagado', class: 'bg-rose-50 text-rose-700 border-rose-300', dotClass: 'bg-rose-500' };
      case 'fallido':
        return { label: 'Fallido', class: 'bg-rose-50 text-rose-700 border-rose-300', dotClass: 'bg-rose-500' };
      case 'denegado':
        return { label: 'Denegado', class: 'bg-rose-50 text-rose-700 border-rose-300', dotClass: 'bg-rose-500' };
      case 'pendiente':
        return { label: 'Pendiente', class: 'bg-amber-50 text-amber-800 border-amber-300', dotClass: 'bg-amber-500' };
      case 'iniciada':
        return { label: 'Iniciada', class: 'bg-sky-50 text-sky-700 border-sky-300', dotClass: 'bg-sky-500' };
      case 'cancelada':
      case 'cancelado':
        return { label: 'Cancelado', class: 'bg-red-50 text-red-700 border-red-300', dotClass: 'bg-red-500' };
      default:
        return { label: estado || 'Desconocido', class: 'bg-slate-100 text-slate-700 border-slate-200', dotClass: 'bg-slate-400' };
    }
  }

  abrirFormPagoManual(): void {
    const totalAbonado = this.getTotalPagado();
    const tarifa = this.tarifaInscripcion();
    const saldoPendiente = Math.max(0, tarifa - totalAbonado);
    this.cantidadPagoManual.set(saldoPendiente > 0 ? saldoPendiente : tarifa);
    this.modalidadPagoManual.set('transferencia');
    this.notasPagoManual.set('');
    this.enviarEmailPagoManual.set(true);
    this.errorPagoManual.set(null);
    this.mensajeExitoPagoManual.set(null);
    this.mostrarFormPagoManual.set(true);
  }

  cancelarFormPagoManual(): void {
    this.mostrarFormPagoManual.set(false);
    this.errorPagoManual.set(null);
  }

  marcarInscripcionComoPagada(): void {

  }

  confirmarPagoManual(): void {
    if (!this.inscripcion?.id || this.guardandoPagoManual()) {
      return;
    }

    const cantidad = Number(this.cantidadPagoManual());
    if (isNaN(cantidad) || cantidad <= 0) {
      this.errorPagoManual.set('Por favor, indica un importe válido superior a 0 €.');
      return;
    }

    const modalidad = this.modalidadPagoManual();
    const notas = this.notasPagoManual().trim();
    const enviarEmail = this.enviarEmailPagoManual();

    this.guardandoPagoManual.set(true);
    this.errorPagoManual.set(null);
    this.mensajeExitoPagoManual.set(null);

    const request: PagoManualRequest = {
      inscripcion_id: this.inscripcion.id,
      modalidad,
      cantidad,
      notas,
      enviar_email: enviarEmail,
    };

    this.pagoService.registrarPagoManual(request).subscribe({
      next: (res) => {
        this.guardandoPagoManual.set(false);
        if (res.success) {
          // Actualizar el estado de la inscripción en el modal local si cambia
          if (this.inscripcion && res.nuevo_estado) {
            this.inscripcion = {
              ...this.inscripcion,
              estado: res.nuevo_estado
            };
            this.inscripcionActualizada.emit(this.inscripcion);
          }

          // Añadir el nuevo pago al principio de la lista de pagos reactiva
          if (res.pago) {
            this.pagos.update((prev) => [
              res.pago,
              ...prev.map((p) => (p.estado === 'pendiente' ? { ...p, estado: 'cancelado' } : p))
            ]);
          } else {
            this.cargarPagos(this.inscripcion!.id);
          }

          let msg = res.message || 'Pago registrado con éxito.';
          if (res.email_enviado) {
            msg += ' Correo oficial de confirmación enviado al participante.';
          }
          this.mensajeExitoPagoManual.set(msg);
          this.mostrarFormPagoManual.set(false);
        } else {
          this.errorPagoManual.set(res.message || 'No se pudo registrar el pago manual.');
        }
      },
      error: (err) => {
        this.guardandoPagoManual.set(false);
        this.errorPagoManual.set(err?.error?.message || 'Error en el servidor al registrar el pago manual.');
      }
    });
  }
}

