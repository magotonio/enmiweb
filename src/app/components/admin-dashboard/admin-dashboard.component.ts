import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InscripcionService } from '../../services/inscripcion.service';
import { Inscripcion } from '../../models/inscripcion.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly inscripcionService = inject(InscripcionService);
  private readonly router = inject(Router);

  // Estado del usuario autenticado
  readonly currentUser = this.authService.currentUser;

  // Estado de carga y datos
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly inscripciones = signal<Inscripcion[]>([]);

  // Métricas computadas del encuentro
  readonly totalInscritos = computed(() => this.inscripciones().length);

  readonly totalActivos = computed(() =>
    this.inscripciones().filter(i => (i.estado || 'activo') === 'activo').length
  );

  readonly totalParticipantesArtisticos = computed(() =>
    this.inscripciones().filter(i => Boolean(i.quiero_participar)).length
  );

  readonly totalSinConsentimientoImagen = computed(() =>
    this.inscripciones().filter(i => !i.consentimiento_imagen).length
  );

  readonly totalAsociacionesUnicas = computed(() => {
    const asocs = this.inscripciones()
      .map(i => i.asociacion?.trim())
      .filter((a): a is string => Boolean(a && a.length > 0));
    return new Set(asocs).size;
  });

  // Últimas 5 inscripciones para la tarjeta de actividad reciente
  readonly ultimasInscripciones = computed(() => {
    return [...this.inscripciones()]
      .sort((a, b) => {
        const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
        const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  /**
   * Obtiene la lista de inscripciones desde el backend para calcular estadísticas.
   */
  cargarDatos(isRefresh = false): void {
    if (isRefresh) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);

    this.inscripcionService.getInscripciones().subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          this.inscripciones.set(response.data);
        } else {
          this.inscripciones.set([]);
        }
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard de administración:', err);
        this.errorMessage.set('No se pudieron obtener los datos actualizados del servidor.');
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      }
    });
  }

  /**
   * Exporta directamente todos los registros en formato CSV.
   */
  exportarCsv(): void {
    const listado = this.inscripciones();
    if (listado.length > 0) {
      this.inscripcionService.exportToCsv(listado);
    }
  }

  /**
   * Cierra la sesión activa del usuario.
   */
  logout(): void {
    this.authService.logout();
  }
}
