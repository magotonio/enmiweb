import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-acceso-denegado',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './acceso-denegado.component.html',
  styleUrl: './acceso-denegado.component.css'
})
export class AccesoDenegadoComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly currentUser = this.authService.currentUser;
  readonly userRoleLabel = this.authService.userRoleLabel;
  readonly userRoleBadge = this.authService.userRoleBadge;

  readonly attemptedUrl = computed(() => {
    return this.route.snapshot.queryParams['ruta'] || 'la sección solicitada';
  });

  readonly requiredRole = computed(() => {
    return this.route.snapshot.queryParams['requerido'] || 'un nivel de seguridad superior';
  });
}
