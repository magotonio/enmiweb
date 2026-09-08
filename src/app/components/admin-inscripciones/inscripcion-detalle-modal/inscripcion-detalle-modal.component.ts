import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Inscripcion, PagoRegistro } from '../../../models/inscripcion.model';
import { PagoService } from '../../../services/pago.service';

@Component({
  selector: 'app-inscripcion-detalle-modal',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  templateUrl: './inscripcion-detalle-modal.component.html',
  styleUrl: './inscripcion-detalle-modal.component.css'
})
export class InscripcionDetalleModalComponent implements OnChanges {
  @Input() inscripcion: Inscripcion | null = null;
  @Output() close = new EventEmitter<void>();

  private readonly pagoService = inject(PagoService);

  readonly pagos = signal<PagoRegistro[]>([]);
  readonly cargandoPagos = signal<boolean>(false);
  readonly errorPagos = signal<string | null>(null);
  readonly detallePagoExpandido = signal<number | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inscripcion']) {
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
      case 'fallido':
      case 'denegado':
        return { label: 'No pagado / Denegado', class: 'bg-rose-50 text-rose-700 border-rose-300', dotClass: 'bg-rose-500' };
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
}

