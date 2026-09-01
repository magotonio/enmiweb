import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsuarioService } from '../../services/usuario.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm: FormGroup = this.fb.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isBlocked = signal(false);

  // Modal Recordar Contraseña
  readonly isForgotModalOpen = signal(false);
  readonly isForgotLoading = signal(false);
  readonly forgotInput = signal('');
  readonly forgotMessage = signal<string | null>(null);
  readonly forgotSuccess = signal(false);

  ngOnInit(): void {
    // Si viene redirigido porque su cuenta está bloqueada, mostrar el aviso
    const blockedParam = this.route.snapshot.queryParams['blocked'];
    if (blockedParam === '1') {
      this.isBlocked.set(true);
      this.errorMessage.set('Su usuario está bloqueado. La sesión ha sido cerrada automáticamente. Por favor, contacte con el administrador.');
      return;
    }

    // Si ya está conectado y no está bloqueado, redirigir a su panel correspondiente
    if (this.authService.isLoggedIn()) {
      const destination = this.getRedirectUrl(this.authService.userRole());
      this.router.navigateByUrl(destination);
    }
  }

  togglePassword(): void {
    this.showPassword.update(prev => !prev);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isBlocked.set(false);

    const { login, password } = this.loginForm.value;

    this.authService.login({ login: login.trim(), password }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success && !response.bloqueado && (!response.user || !this.authService.isBlocked(response.user))) {
          const userRole = response.user?.rol || this.authService.userRole();
          const destination = this.getRedirectUrl(userRole);
          this.router.navigateByUrl(destination);
        } else {
          const blocked = !!response.bloqueado || (!!response.user && this.authService.isBlocked(response.user));
          this.isBlocked.set(blocked);
          this.errorMessage.set(
            response.message || (blocked ? 'Su usuario está bloqueado. Por favor, contacte con el administrador.' : 'No se pudo iniciar sesión.')
          );
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const isBlockedError = err.status === 403 || !!err.error?.bloqueado || (typeof err.error?.message === 'string' && err.error.message.toLowerCase().includes('bloquead'));
        this.isBlocked.set(isBlockedError);

        const serverMsg = err.error?.message || (isBlockedError ? 'Su usuario está bloqueado. Por favor, contacte con el administrador.' : 'Error al conectar con el servidor. Inténtelo de nuevo.');
        this.errorMessage.set(serverMsg);
      }
    });
  }

  // Métodos para Recordar Contraseña
  openForgotModal(): void {
    this.forgotInput.set('');
    this.forgotMessage.set(null);
    this.forgotSuccess.set(false);
    this.isForgotLoading.set(false);
    this.isForgotModalOpen.set(true);
  }

  closeForgotModal(): void {
    this.isForgotModalOpen.set(false);
  }

  submitForgot(): void {
    const email = this.forgotInput().trim();
    if (!email) {
      this.forgotMessage.set('Por favor, indica tu correo electrónico o nombre de usuario.');
      this.forgotSuccess.set(false);
      return;
    }

    this.isForgotLoading.set(true);
    this.forgotMessage.set(null);

    this.usuarioService.solicitarRecuperacion(email).subscribe({
      next: (response) => {
        this.isForgotLoading.set(false);
        this.forgotSuccess.set(true);
        this.forgotMessage.set(
          response.message || 'Si la cuenta existe, se ha enviado un enlace de 24 horas para restablecer tu contraseña.'
        );
      },
      error: (err) => {
        this.isForgotLoading.set(false);
        this.forgotSuccess.set(false);
        this.forgotMessage.set(err.error?.message || 'Error al procesar la solicitud. Inténtalo de nuevo.');
      }
    });
  }

  /**
   * Obtiene la ruta de destino según el rol del usuario conectado.
   */
  private getRedirectUrl(role?: string | null): string {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      // Si el rol es asistente y el returnUrl era /admin o subruta admin, enviarlo a /asistente
      if (role === 'asistente' && returnUrl.startsWith('/admin')) {
        return '/asistente';
      }
      return returnUrl;
    }
    return role === 'asistente' ? '/asistente' : '/admin';
  }
}
