import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-mantenimiento',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mantenimiento.component.html',
  styleUrl: './mantenimiento.component.css'
})
export class MantenimientoComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly router = inject(Router);

  readonly isLoggedIn = this.authService.isLoggedIn;
  readonly currentUser = this.authService.currentUser;
  readonly userRoleLabel = this.authService.userRoleLabel;
  readonly userRole = this.authService.userRole;
  readonly isMaintenanceMode = this.configService.isMaintenanceMode;

  readonly isChecking = signal(false);
  readonly checkFeedback = signal<string | null>(null);

  ngOnInit(): void {
    // Si la web ya no está en mantenimiento y el usuario no está logueado, redirigir a la portada
    this.configService.checkMaintenance().subscribe(active => {
      if (!active) {
        this.router.navigate(['/']);
      }
    });
  }

  /**
   * Consulta el estado del servidor en tiempo real para verificar si el mantenimiento ya concluyó.
   */
  comprobarEstado(): void {
    this.isChecking.set(true);
    this.checkFeedback.set(null);

    this.configService.checkMaintenance(true).subscribe({
      next: (active) => {
        this.isChecking.set(false);
        if (!active) {
          this.checkFeedback.set('¡El mantenimiento ha finalizado! Redirigiendo a la portada...');
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 1200);
        } else {
          this.checkFeedback.set('El sitio continúa en mantenimiento. Gracias por su paciencia.');
          setTimeout(() => {
            this.checkFeedback.set(null);
          }, 4000);
        }
      },
      error: () => {
        this.isChecking.set(false);
        this.checkFeedback.set('No se pudo comprobar el estado con el servidor.');
      }
    });
  }

  /**
   * Obtiene la ruta de inicio o panel para usuarios con sesión activa.
   */
  getDestinationUrl(): string {
    const role = this.userRole();
    if (role === 'superadministrador' || role === 'supervisor') {
      return '/admin';
    }
    if (role === 'asistente') {
      return '/asistente';
    }
    return '/';
  }
}
