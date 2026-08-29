import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Inscripcion } from '../../models/inscripcion.model';
import { InscripcionService } from '../../services/inscripcion.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-asistente-ficha',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './asistente-ficha.component.html',
  styleUrl: './asistente-ficha.component.css'
})
export class AsistenteFichaComponent implements OnInit {
  private readonly inscripcionService = inject(InscripcionService);
  readonly authService = inject(AuthService);

  readonly currentUser = this.authService.currentUser;
  readonly miInscripcion = signal<Inscripcion | null>(null);
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarFicha();
  }

  cargarFicha(isManualRefresh = false): void {
    if (isManualRefresh) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);

    this.inscripcionService.getInscripciones().subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        if (response.success && Array.isArray(response.data) && response.data.length > 0) {
          this.miInscripcion.set(response.data[0]);
        } else {
          this.miInscripcion.set(null);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        const msg = err?.error?.message || 'No se pudo recuperar la información de tu ficha.';
        this.errorMessage.set(msg);
      }
    });
  }

  getInitials(nombre?: string, apellidos?: string): string {
    const n = (nombre || this.currentUser()?.login || 'A').trim().charAt(0);
    const a = (apellidos || '').trim().charAt(0);
    return `${n}${a}`.toUpperCase() || 'EN';
  }

  imprimirFicha(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}
