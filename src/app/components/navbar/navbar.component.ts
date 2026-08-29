import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly configService = inject(ConfigService);

  readonly isMobileMenuOpen = signal(false);
  readonly isMaintenanceMode = this.configService.isMaintenanceMode;
  readonly currentUser = this.authService.currentUser;
  readonly isLoggedIn = this.authService.isLoggedIn;
  readonly userRole = this.authService.userRole;
  readonly userRoleLabel = this.authService.userRoleLabel;
  readonly userRoleBadge = this.authService.userRoleBadge;
  readonly isSuperAdmin = this.authService.isSuperAdmin;
  readonly isSupervisor = this.authService.isSupervisor;
  readonly isAsistente = this.authService.isAsistente;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(prev => !prev);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
  }
}
