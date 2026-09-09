import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SystemLog } from '../../models/usuario.model';
import { LogsService } from '../../services/logs.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-logs.component.html',
  styleUrl: './admin-logs.component.css'
})
export class AdminLogsComponent implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly logsService = inject(LogsService);
  readonly authService = inject(AuthService);

  // Estados reactivos principales
  readonly rawLogs = signal<SystemLog[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Filtros
  readonly searchQuery = signal('');
  readonly selectedLevel = signal<string>('TODOS');
  readonly selectedCategory = signal<string>('todas');
  readonly limit = signal(50);
  readonly offset = signal(0);
  readonly totalRecords = signal(0);

  // Estadísticas
  readonly stats = signal({
    total: 0,
    errores: 0,
    warnings: 0,
    infos: 0,
    auth_events: 0
  });

  // Modal para detalle de contexto JSON
  readonly selectedLogForContext = signal<SystemLog | null>(null);

  // Computeds
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  ngOnInit(): void {
    this.cargarLogs();
  }

  /**
   * Carga los logs aplicando los filtros actuales.
   */
  cargarLogs(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.logsService.getLogs({
      q: this.searchQuery(),
      nivel: this.selectedLevel(),
      categoria: this.selectedCategory(),
      limit: this.limit(),
      offset: this.offset()
    }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          this.rawLogs.set(response.data);
          this.totalRecords.set(response.total);
          this.stats.set(response.stats);
        } else {
          this.errorMessage.set('No se pudieron recuperar los registros de logs.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al conectar con el servidor.');
      }
    });
  }

  /**
   * Aplica un filtro y reinicia la paginación.
   */
  onFilterChange(): void {
    this.offset.set(0);
    this.cargarLogs();
  }

  /**
   * Cambia de página.
   */
  nextPage(): void {
    if (this.offset() + this.limit() < this.totalRecords()) {
      this.offset.update(val => val + this.limit());
      this.cargarLogs();
    }
  }

  prevPage(): void {
    if (this.offset() > 0) {
      this.offset.update(val => Math.max(0, val - this.limit()));
      this.cargarLogs();
    }
  }

  /**
   * Abre modal de contexto para un log.
   */
  openContextModal(log: SystemLog): void {
    this.selectedLogForContext.set(log);
  }

  closeContextModal(): void {
    this.selectedLogForContext.set(null);
  }

  /**
   * Limpia logs antiguos (solo para superadmin).
   */
  async clearOldLogs(): Promise<void> {
    const confirmado = await this.confirmService.confirm({
      titulo: 'Purgar logs',
      cuerpo: `¿Deseas purgar los logs con más de 60 días de antigüedad? Esta acción no se puede deshacer.`,
      textoAceptar: 'Aceptar',
      textoCancelar: 'Cancelar',
      tipo: 'success'
    });

    if (!confirmado) {
      return;
    }

    this.logsService.clearOldLogs().subscribe({
      next: (res) => {
        if (res.success) {
          this.showSuccess(res.message);
          this.cargarLogs();
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Error al purgar logs antiguos.');
      }
    });
  }

  /**
   * Clases CSS por nivel de log.
   */
  getLevelBadgeClass(level: string): string {
    switch (level.toUpperCase()) {
      case 'ERROR':
      case 'CRITICAL':
      case 'ALERT':
      case 'EMERGENCY':
        return 'bg-rose-500/15 text-rose-700 border-rose-400/40';
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-700 border-amber-400/40';
      case 'NOTICE':
      case 'INFO':
        return 'bg-sky-500/15 text-sky-700 border-sky-400/40';
      case 'DEBUG':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }
}
