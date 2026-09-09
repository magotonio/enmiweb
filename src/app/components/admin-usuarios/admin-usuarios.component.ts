import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Usuario, UserRole, ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../models/usuario.model';
import { UsuarioService } from '../../services/usuario.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.css'
})
export class AdminUsuariosComponent implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly usuarioService = inject(UsuarioService);
  readonly authService = inject(AuthService);

  readonly roleLabels = ROLE_LABELS;
  readonly roleBadges = ROLE_BADGE_CLASSES;

  // Estados reactivos principales
  readonly rawUsuarios = signal<Usuario[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Filtros
  readonly searchQuery = signal('');
  readonly roleFilter = signal<string>('todos');

  // Modal: Crear Usuario
  readonly isCreateModalOpen = signal(false);
  newUserLogin = '';
  newUserEmail = '';
  newUserRole: UserRole = 'asistente';
  newUserPassword = '';

  // Modal: Cambiar Rol
  readonly selectedUserForRole = signal<Usuario | null>(null);
  selectedNewRole: UserRole = 'asistente';

  // Modal: Restablecer Contraseña
  readonly selectedUserForPassword = signal<Usuario | null>(null);
  newPassword = '';

  // Computeds
  readonly filteredUsuarios = computed(() => {
    let list = [...this.rawUsuarios()];
    const query = this.searchQuery().trim().toLowerCase();
    const role = this.roleFilter();

    if (query) {
      list = list.filter(u =>
        u.login.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.rol && u.rol.toLowerCase().includes(query)) ||
        u.id?.toString().includes(query)
      );
    }

    if (role !== 'todos') {
      list = list.filter(u => u.rol === role);
    }

    return list;
  });

  // Métricas
  readonly totalUsuarios = computed(() => this.rawUsuarios().length);
  readonly totalSuperAdmins = computed(() => this.rawUsuarios().filter(u => u.rol === 'superadministrador').length);
  readonly totalSupervisores = computed(() => this.rawUsuarios().filter(u => u.rol === 'supervisor').length);
  readonly totalAsistentes = computed(() => this.rawUsuarios().filter(u => u.rol === 'asistente').length);
  readonly totalBloqueados = computed(() => this.rawUsuarios().filter(u => Boolean(u.bloqueado)).length);

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  /**
   * Obtiene el listado de usuarios desde la API PHP.
   */
  cargarUsuarios(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.usuarioService.getUsuarios().subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success && Array.isArray(response.data)) {
          this.rawUsuarios.set(response.data);
        } else {
          this.errorMessage.set(response.message || 'No se pudieron recuperar los usuarios.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al conectar con el servidor.');
      }
    });
  }

  /**
   * Abre modal para crear nuevo usuario.
   */
  /**
   * Abre modal para crear nuevo usuario.
   */
  openCreateModal(): void {
    this.newUserLogin = '';
    this.newUserEmail = '';
    this.newUserRole = 'asistente';
    this.errorMessage.set(null);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  /**
   * Guarda el nuevo usuario y le envía el enlace de activación de 24 horas.
   */
  submitCreateUser(): void {
    if (!this.newUserLogin.trim() || !this.newUserEmail.trim()) {
      this.errorMessage.set('Por favor, indica el nombre de usuario y correo electrónico.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.usuarioService.createUsuario({
      login: this.newUserLogin.trim(),
      email: this.newUserEmail.trim(),
      rol: this.newUserRole
    }).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (response.success) {
          this.closeCreateModal();
          this.showSuccess(`Usuario '${this.newUserLogin}' creado. Se ha enviado un enlace de 24h a ${this.newUserEmail} para definir su contraseña.`);
          this.cargarUsuarios();
        } else {
          this.errorMessage.set(response.message || 'No se pudo crear el usuario.');
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.message || 'Error al crear el usuario.');
      }
    });
  }

  /**
   * Abre modal para cambiar rol de usuario.
   */
  openRoleModal(user: Usuario): void {
    this.selectedUserForRole.set(user);
    this.selectedNewRole = user.rol || 'asistente';
    this.errorMessage.set(null);
  }

  closeRoleModal(): void {
    this.selectedUserForRole.set(null);
  }

  /**
   * Guarda el nuevo rol.
   */
  submitChangeRole(): void {
    const user = this.selectedUserForRole();
    if (!user || !user.id) return;

    this.isSaving.set(true);
    this.usuarioService.updateRol(user.id, this.selectedNewRole).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (response.success) {
          this.closeRoleModal();
          this.showSuccess(`Perfil de '${user.login}' actualizado a '${this.roleLabels[this.selectedNewRole]}'.`);
          this.cargarUsuarios();
        } else {
          this.errorMessage.set(response.message || 'Error al actualizar rol.');
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.message || 'Error al actualizar el perfil.');
      }
    });
  }

  /**
   * Alterna bloqueo de usuario.
   */
  async toggleBlock(user: Usuario): Promise<void> {
    if (!user.id) return;
    const nuevoEstado = !user.bloqueado;
    const accionTexto = nuevoEstado ? 'bloquear' : 'desbloquear';

    const confirmado = await this.confirmService.confirm({
      titulo: `${accionTexto.charAt(0).toUpperCase() + accionTexto.slice(1)} usuario`,
      cuerpo: `¿Estás seguro de que deseas ${accionTexto} al usuario '${user.login}'?`,
      textoAceptar: 'Aceptar',
      textoCancelar: 'Cancelar',
      tipo: 'success'
    });

    if (!confirmado) {
      return;
    }

    this.usuarioService.toggleBlock(user.id, nuevoEstado).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess(`Usuario '${user.login}' ${nuevoEstado ? 'bloqueado' : 'desbloqueado y activo'}.`);
          this.cargarUsuarios();
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || `Error al ${accionTexto} usuario.`);
      }
    });
  }

  /**
   * Abre modal de confirmación para restablecer contraseña con token de 24 horas.
   */
  openPasswordModal(user: Usuario): void {
    this.selectedUserForPassword.set(user);
    this.errorMessage.set(null);
  }

  closePasswordModal(): void {
    this.selectedUserForPassword.set(null);
  }

  /**
   * Envía el enlace seguro de restablecimiento de contraseña de 24 horas al correo del usuario.
   */
  submitResetPassword(): void {
    const user = this.selectedUserForPassword();
    if (!user || !user.id) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.usuarioService.resetPassword(user.id).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (response.success) {
          this.closePasswordModal();
          this.showSuccess(response.message || `Enlace de restablecimiento de 24h enviado al correo '${user.email}'.`);
          this.cargarUsuarios();
        } else {
          this.errorMessage.set(response.message || 'Error al enviar restablecimiento de contraseña.');
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.message || 'Error al solicitar el restablecimiento de contraseña.');
      }
    });
  }

  /**
   * Muestra mensaje temporal de éxito.
   */
  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }
}
