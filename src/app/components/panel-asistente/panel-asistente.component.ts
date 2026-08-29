import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Inscripcion } from '../../models/inscripcion.model';
import { InscripcionService } from '../../services/inscripcion.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-panel-asistente',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './panel-asistente.component.html',
  styleUrl: './panel-asistente.component.css'
})
export class PanelAsistenteComponent implements OnInit {
  private readonly inscripcionService = inject(InscripcionService);
  readonly authService = inject(AuthService);

  // Datos del usuario conectado
  readonly currentUser = this.authService.currentUser;
  readonly userRoleLabel = this.authService.userRoleLabel;
  readonly userRoleBadge = this.authService.userRoleBadge;

  // Estado de la inscripción personal del asistente
  readonly miInscripcion = signal<Inscripcion | null>(null);
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarMiInscripcion();
  }

  /**
   * Consulta los datos de la inscripción personal del asistente autenticado.
   */
  cargarMiInscripcion(isManualRefresh = false): void {
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
          // Asigna su propia inscripción
          this.miInscripcion.set(response.data[0]);
        } else {
          this.miInscripcion.set(null);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.errorMessage.set('No se pudo recuperar la información de tu inscripción.');
      }
    });
  }

  /**
   * Obtiene las iniciales para el avatar visual del congresista.
   */
  getInitials(nombre?: string, apellidos?: string): string {
    const n = (nombre || this.currentUser()?.login || 'A').trim().charAt(0);
    const a = (apellidos || '').trim().charAt(0);
    return `${n}${a}`.toUpperCase() || 'EN';
  }

  /**
   * Abre el diálogo de impresión para imprimir el comprobante / credencial de congresista.
   */
  imprimirCredencial(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  /**
   * Cierra la sesión activa.
   */
  logout(): void {
    this.authService.logout();
  }
}
