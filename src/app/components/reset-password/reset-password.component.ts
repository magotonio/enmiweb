import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UsuarioService } from '../../services/usuario.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usuarioService = inject(UsuarioService);
  private readonly authService = inject(AuthService);

  // Estados de verificación
  readonly isVerifying = signal(true);
  readonly isTokenValid = signal(false);
  readonly token = signal<string>('');
  readonly userLogin = signal<string>('');
  readonly verificationError = signal<string | null>(null);

  // Estados de envío
  readonly isSubmitting = signal(false);
  readonly isSuccess = signal(false);
  readonly submitError = signal<string | null>(null);

  // Visibilidad de contraseñas
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly resetForm: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: [this.passwordsMatchValidator]
  });

  ngOnInit(): void {
    // Si había una sesión activa previa, cerrarla inmediatamente por seguridad
    if (this.authService.isLoggedIn() || this.authService.currentUser()) {
      this.authService.clearSession();
    }

    const tokenParam = this.route.snapshot.queryParams['token'];
    if (!tokenParam || !tokenParam.trim()) {
      this.isVerifying.set(false);
      this.isTokenValid.set(false);
      this.verificationError.set('No se ha proporcionado un enlace de restablecimiento válido en la dirección URL.');
      return;
    }

    const cleanToken = tokenParam.trim();
    this.token.set(cleanToken);

    // Verificar token contra el servidor
    this.usuarioService.verificarToken(cleanToken).subscribe({
      next: (response) => {
        this.isVerifying.set(false);
        if (response.success && response.valido) {
          this.isTokenValid.set(true);
          this.userLogin.set(response.login || '');
        } else {
          this.isTokenValid.set(false);
          this.verificationError.set(response.message || 'El enlace de restablecimiento ha expirado o no es válido.');
        }
      },
      error: (err) => {
        this.isVerifying.set(false);
        this.isTokenValid.set(false);
        this.verificationError.set(err.error?.message || 'Error de conexión al validar el enlace de seguridad.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const { password } = this.resetForm.value;
    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.usuarioService.ejecutarResetPassword({
      token: this.token(),
      password
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        if (response.success) {
          this.isSuccess.set(true);
        } else {
          this.submitError.set(response.message || 'No se pudo actualizar la contraseña.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.error?.message || 'Error al conectar con el servidor para actualizar la contraseña.');
      }
    });
  }

  private passwordsMatchValidator(group: FormGroup): Record<string, boolean> | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (pass && confirm && pass !== confirm) {
      return { passwordsMismatch: true };
    }
    return null;
  }
}
