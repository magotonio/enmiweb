import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InscripcionService } from '../../services/inscripcion.service';
import { ConfigService } from '../../services/config.service';
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
  private readonly configService = inject(ConfigService);
  private readonly router = inject(Router);

  // Estado del usuario autenticado
  readonly currentUser = this.authService.currentUser;
  readonly userRole = this.authService.userRole;
  readonly userRoleLabel = this.authService.userRoleLabel;
  readonly userRoleBadge = this.authService.userRoleBadge;
  readonly isSuperAdmin = this.authService.isSuperAdmin;
  readonly isSupervisor = this.authService.isSupervisor;
  readonly isAsistente = this.authService.isAsistente;

  // Estado de configuración y mantenimiento
  readonly isMaintenanceMode = this.configService.isMaintenanceMode;
  readonly isUpdatingMaintenance = signal(false);
  readonly maintenanceSuccessMessage = signal<string | null>(null);
  readonly isMaintenanceModalOpen = signal(false);
  readonly pendingMaintenanceState = signal<boolean | null>(null);

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
    if (this.authService.isBlocked(this.currentUser())) {
      this.authService.logout('blocked');
      return;
    }

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

    this.configService.checkMaintenance(true).subscribe();
  }

  /**
   * Abre el modal de confirmación para cambiar el estado del modo mantenimiento.
   */
  openMaintenanceModal(enable: boolean): void {
    if (!this.isSuperAdmin()) return;
    this.pendingMaintenanceState.set(enable);
    this.isMaintenanceModalOpen.set(true);
  }

  /**
   * Cierra el modal de confirmación sin realizar cambios.
   */
  closeMaintenanceModal(): void {
    if (this.isUpdatingMaintenance()) return;
    this.isMaintenanceModalOpen.set(false);
    this.pendingMaintenanceState.set(null);
  }

  /**
   * Confirma la acción y ejecuta el cambio de modo mantenimiento en el backend.
   */
  confirmMaintenanceChange(): void {
    const targetState = this.pendingMaintenanceState();
    if (targetState === null || !this.isSuperAdmin()) return;

    this.isUpdatingMaintenance.set(true);
    this.maintenanceSuccessMessage.set(null);
    this.errorMessage.set(null);

    this.configService.setMaintenanceMode(targetState).subscribe({
      next: (res) => {
        this.isUpdatingMaintenance.set(false);
        this.isMaintenanceModalOpen.set(false);
        this.pendingMaintenanceState.set(null);
        if (res.success) {
          const msg = targetState
            ? 'Modo Mantenimiento ACTIVADO. La web pública ahora está cerrada y cualquier visitante es redirigido a /mantenimiento.'
            : 'Modo Mantenimiento DESACTIVADO. La web vuelve a estar abierta al público con normalidad.';
          this.maintenanceSuccessMessage.set(msg);
          setTimeout(() => this.maintenanceSuccessMessage.set(null), 6000);
        } else {
          this.errorMessage.set(res.message || 'No se pudo actualizar el modo mantenimiento.');
        }
      },
      error: (err) => {
        this.isUpdatingMaintenance.set(false);
        this.isMaintenanceModalOpen.set(false);
        this.pendingMaintenanceState.set(null);
        this.errorMessage.set(err.error?.message || 'Error al conectar con el servidor para actualizar el modo mantenimiento.');
      }
    });
  }

  /**
   * Exporta directamente todos los registros en formato CSV (Superadmin y Supervisor).
   */
  exportarCsv(): void {
    if (!this.isSupervisor()) return;
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
