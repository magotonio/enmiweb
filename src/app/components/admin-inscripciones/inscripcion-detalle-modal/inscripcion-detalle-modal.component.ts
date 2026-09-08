import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Inscripcion } from '../../../models/inscripcion.model';

@Component({
  selector: 'app-inscripcion-detalle-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './inscripcion-detalle-modal.component.html',
  styleUrl: './inscripcion-detalle-modal.component.css'
})
export class InscripcionDetalleModalComponent {
  @Input() inscripcion: Inscripcion | null = null;
  @Output() close = new EventEmitter<void>();

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
}
