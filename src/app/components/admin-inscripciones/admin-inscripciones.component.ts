import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Inscripcion, InscripcionesStats } from '../../models/inscripcion.model';
import { InscripcionService } from '../../services/inscripcion.service';
import { AuthService } from '../../services/auth.service';

type SortField = 'id' | 'nombre' | 'apellidos' | 'nombre_artistico' | 'email' | 'nif_pasaporte' | 'origen' | 'quiero_participar' | 'fecha_creacion' | 'estado';
type SortDirection = 'ASC' | 'DESC';

@Component({
  selector: 'app-admin-inscripciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-inscripciones.component.html',
  styleUrl: './admin-inscripciones.component.css'
})
export class AdminInscripcionesComponent implements OnInit {
  private readonly inscripcionService = inject(InscripcionService);
  readonly authService = inject(AuthService);

  readonly isSupervisor = this.authService.isSupervisor;
  readonly userRoleLabel = this.authService.userRoleLabel;
  readonly userRoleBadge = this.authService.userRoleBadge;

  // Estados reactivos principales
  readonly rawInscripciones = signal<Inscripcion[]>([]);
  readonly stats = signal<InscripcionesStats>({ total: 0, hoy: 0, activos: 0, quieren_participar: 0 });
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Estados de filtros, búsqueda y paginación
  readonly searchQuery = signal('');
  readonly statusFilter = signal('todos');
  readonly sortField = signal<SortField>('fecha_creacion');
  readonly sortDirection = signal<SortDirection>('DESC');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  // Modal de detalles
  readonly selectedInscripcion = signal<Inscripcion | null>(null);

  // Lista filtrada y ordenada reactivamente
  readonly filteredInscripciones = computed(() => {
    let list = [...this.rawInscripciones()];
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    // Filtro por texto enriquecido
    if (query) {
      list = list.filter(item =>
        item.nombre.toLowerCase().includes(query) ||
        item.apellidos.toLowerCase().includes(query) ||
        `${item.nombre} ${item.apellidos}`.toLowerCase().includes(query) ||
        (item.nombre_artistico && item.nombre_artistico.toLowerCase().includes(query)) ||
        (item.email && item.email.toLowerCase().includes(query)) ||
        (item.nif_pasaporte && item.nif_pasaporte.toLowerCase().includes(query)) ||
        (item.telefono && item.telefono.toLowerCase().includes(query)) ||
        (item.origen && item.origen.toLowerCase().includes(query)) ||
        (item.asociacion && item.asociacion.toLowerCase().includes(query)) ||
        item.id.toString().includes(query) ||
        (item.ip_registro && item.ip_registro.toLowerCase().includes(query))
      );
    }

    // Filtro por estado / participación
    if (status !== 'todos') {
      if (status === 'participa') {
        list = list.filter(item => !!item.quiero_participar);
      } else {
        list = list.filter(item => (item.estado || 'activo').toLowerCase() === status.toLowerCase());
      }
    }

    // Ordenación
    const field = this.sortField();
    const direction = this.sortDirection();

    list.sort((a, b) => {
      let comparison = 0;
      if (field === 'id') {
        comparison = a.id - b.id;
      } else if (field === 'nombre') {
        comparison = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      } else if (field === 'apellidos') {
        comparison = a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' });
      } else if (field === 'nombre_artistico') {
        comparison = (a.nombre_artistico || '').localeCompare(b.nombre_artistico || '', 'es', { sensitivity: 'base' });
      } else if (field === 'email') {
        comparison = (a.email || '').localeCompare(b.email || '', 'es', { sensitivity: 'base' });
      } else if (field === 'nif_pasaporte') {
        comparison = (a.nif_pasaporte || '').localeCompare(b.nif_pasaporte || '', 'es');
      } else if (field === 'origen') {
        comparison = (a.origen || '').localeCompare(b.origen || '', 'es', { sensitivity: 'base' });
      } else if (field === 'quiero_participar') {
        comparison = (a.quiero_participar ? 1 : 0) - (b.quiero_participar ? 1 : 0);
      } else if (field === 'estado') {
        comparison = (a.estado || 'activo').localeCompare(b.estado || 'activo', 'es');
      } else if (field === 'fecha_creacion') {
        const timeA = new Date(a.fecha_creacion).getTime();
        const timeB = new Date(b.fecha_creacion).getTime();
        comparison = timeA - timeB;
      }
      return direction === 'ASC' ? comparison : -comparison;
    });

    return list;
  });

  // Métricas derivadas
  readonly totalFilteredCount = computed(() => this.filteredInscripciones().length);

  readonly totalPages = computed(() => {
    const size = this.pageSize();
    if (size <= 0) return 1;
    return Math.max(1, Math.ceil(this.totalFilteredCount() / size));
  });

  readonly paginatedInscripciones = computed(() => {
    const size = this.pageSize();
    if (size <= 0) return this.filteredInscripciones();
    const start = (this.currentPage() - 1) * size;
    return this.filteredInscripciones().slice(start, start + size);
  });

  readonly paginationRangeText = computed(() => {
    const total = this.totalFilteredCount();
    if (total === 0) return '0 de 0 registros';
    const size = this.pageSize();
    if (size <= 0) return `1 - ${total} de ${total} registros`;
    const start = (this.currentPage() - 1) * size + 1;
    const end = Math.min(start + size - 1, total);
    return `${start} - ${end} de ${total} registros`;
  });

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Carga los datos de inscripciones desde la API PHP.
   */
  loadData(isManualRefresh = false): void {
    if (this.authService.isBlocked(this.authService.currentUser())) {
      this.authService.logout('blocked');
      return;
    }

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
        if (response.success && response.data) {
          this.rawInscripciones.set(response.data);
          if (response.stats) {
            this.stats.set(response.stats);
          } else {
            // Calcular estadísticas de respaldo
            const total = response.data.length;
            const hoyStr = new Date().toISOString().slice(0, 10);
            const hoy = response.data.filter(item => item.fecha_creacion?.startsWith(hoyStr)).length;
            const quieren_participar = response.data.filter(item => item.quiero_participar).length;
            this.stats.set({ total, hoy, activos: total, quieren_participar });
          }
        } else {
          this.errorMessage.set(response.message || 'No se pudieron recuperar los registros.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        const errorText = err.error?.message || 'Error de comunicación con el servidor. Verifique su conexión.';
        this.errorMessage.set(errorText);
      }
    });
  }

  /**
   * Actualiza el término de búsqueda y reinicia la paginación a la primera página.
   */
  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.currentPage.set(1);
  }

  /**
   * Limpia el buscador.
   */
  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  /**
   * Cambia el filtro de estado / participación.
   */
  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  /**
   * Alterna la ordenación de una columna.
   */
  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(dir => (dir === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'fecha_creacion' ? 'DESC' : 'ASC');
    }
  }

  /**
   * Cambia el número de registros mostrados por página.
   */
  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSize.set(Number(select.value));
    this.currentPage.set(1);
  }

  /**
   * Navega a una página específica.
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  /**
   * Abre el modal de detalles de una inscripción.
   */
  openDetail(item: Inscripcion): void {
    this.selectedInscripcion.set(item);
  }

  /**
   * Cierra el modal de detalles.
   */
  closeDetail(): void {
    this.selectedInscripcion.set(null);
  }

  /**
   * Exporta la lista actual (filtrada) a un archivo CSV compatible con Excel.
   */
  exportCsv(): void {
    const dataToExport = this.filteredInscripciones();
    if (dataToExport.length === 0) return;
    this.inscripcionService.exportToCsv(dataToExport);
  }

  /**
   * Dispara la impresión del navegador o guardado en PDF.
   */
  printReport(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  /**
   * Obtiene las iniciales del participante para el avatar visual.
   */
  getInitials(nombre: string, apellidos: string): string {
    const n = (nombre || '').trim().charAt(0);
    const a = (apellidos || '').trim().charAt(0);
    return `${n}${a}`.toUpperCase() || 'EN';
  }
}
