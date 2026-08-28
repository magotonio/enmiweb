import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm: FormGroup = this.fb.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    // Si ya está conectado, redirigir a la administración o al inicio
    if (this.authService.isLoggedIn()) {
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/inscritos';
      this.router.navigateByUrl(returnUrl);
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

    const { login, password } = this.loginForm.value;

    this.authService.login({ login: login.trim(), password }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/inscritos';
          this.router.navigateByUrl(returnUrl);
        } else {
          this.errorMessage.set(response.message || 'No se pudo iniciar sesión.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const serverMsg = err.error?.message || 'Error al conectar con el servidor. Inténtelo de nuevo.';
        this.errorMessage.set(serverMsg);
      }
    });
  }
}
