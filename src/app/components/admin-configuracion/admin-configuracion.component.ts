import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfigItem } from '../../models/configuracion.model';
import { ConfigService } from '../../services/config.service';

interface ConfigEditorItem extends ConfigItem {
  draft: string;
}

@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-configuracion.component.html'
})
export class AdminConfiguracionComponent implements OnInit {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<ConfigEditorItem[]>([]);
  readonly isLoading = signal(false);
  readonly savingKey = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly selectedGroup = signal('todos');
  readonly groups = [
    { id: 'sistema', label: 'Sistema y mantenimiento' },
    { id: 'correo', label: 'Correo SMTP' },
    { id: 'notificaciones', label: 'Notificaciones' },
    { id: 'acceso', label: 'Acceso y recuperación de contraseña' },
    { id: 'pagos', label: 'Pagos: opciones generales' },
    { id: 'bizum', label: 'Pagos: Bizum' },
    { id: 'transferencia', label: 'Pagos: transferencia bancaria' },
    { id: 'redsys', label: 'Pagos: pasarela Redsys' },
    { id: 'otros', label: 'Otros parámetros' }
  ];

  readonly pendingCount = computed(() => this.items().filter(item => this.isDirty(item)).length);
  readonly visibleGroups = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.groups
      .filter(group => this.selectedGroup() === 'todos' || group.id === this.selectedGroup())
      .map(group => ({
        ...group,
        items: this.items().filter(item =>
          this.groupFor(item.clave) === group.id &&
          (!query || `${item.clave} ${item.descripcion ?? ''} ${group.label}`.toLowerCase().includes(query))
        )
      }))
      .filter(group => group.items.length > 0);
  });

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  groupFor(clave: string): string {
    if (clave === 'mantenimiento') return 'sistema';
    if (clave.startsWith('smtp_')) return 'correo';
    if (clave.startsWith('notification_')) return 'notificaciones';
    if (clave.startsWith('token_')) return 'acceso';
    if (clave.startsWith('pago_bizum_')) return 'bizum';
    if (clave.startsWith('pago_transferencia_')) return 'transferencia';
    if (clave.startsWith('pago_redsys_')) return 'redsys';
    if (clave.startsWith('pago_')) return 'pagos';
    return 'otros';
  }

  isBoolean(clave: string): boolean {
    return ['mantenimiento', 'pago_modo_demo', 'pago_redsys_activo', 'smtp_auth'].includes(clave);
  }

  isDirty(item: ConfigEditorItem): boolean {
    return item.secreto ? item.draft !== '' : item.draft !== (item.valor ?? '');
  }

  setDraft(clave: string, draft: string): void {
    this.items.update(items => items.map(item => item.clave === clave ? { ...item, draft } : item));
    this.successMessage.set(null);
  }

  resetItem(item: ConfigEditorItem): void {
    this.setDraft(item.clave, item.secreto ? '' : (item.valor ?? ''));
  }

  cargarConfiguracion(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.configService.getFullConfig().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items.set(items.map(item => ({ ...item, draft: item.secreto ? '' : (item.valor ?? '') })));
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorText(error, 'No se pudo cargar la configuración.'));
        this.isLoading.set(false);
      }
    });
  }

  guardar(item: ConfigEditorItem): void {
    if (this.savingKey() || !this.isDirty(item)) return;
    this.savingKey.set(item.clave);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.configService.setConfig(item.clave, item.draft).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.savingKey.set(null);
        if (!response.success) {
          this.errorMessage.set(response.message || `No se pudo guardar ${item.clave}.`);
          return;
        }
        this.items.update(items => items.map(current => current.clave === item.clave
          ? {
              ...current,
              valor: item.secreto ? '********' : (response.valor ?? item.draft),
              draft: item.secreto ? '' : (response.valor ?? item.draft),
              fecha_actualizacion: new Date().toISOString()
            }
          : current));
        this.successMessage.set(`Parámetro "${item.clave}" guardado correctamente.`);
      },
      error: (error: unknown) => {
        this.savingKey.set(null);
        this.errorMessage.set(this.errorText(error, `No se pudo guardar ${item.clave}.`));
      }
    });
  }

  private errorText(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return typeof error.error?.message === 'string' ? error.error.message : fallback;
    }
    return error instanceof Error ? error.message : fallback;
  }
}
