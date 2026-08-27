import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InscripcionFormData } from '../../models/inscripcion.model';
import { InscripcionService } from '../../services/inscripcion.service';

@Component({
  selector: 'app-registration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registration-form.component.html',
  styleUrl: './registration-form.component.css'
})
export class RegistrationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly inscripcionService = inject(InscripcionService);

  @ViewChild('nombreInput') nombreInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('apellidosInput') apellidosInputElement?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  isSubmitted = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  serverError = signal<string | null>(null);
  registeredFullName = signal<string>('');

  constructor() {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  isFieldInvalid(fieldName: 'nombre' | 'apellidos'): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getErrorMessage(fieldName: 'nombre' | 'apellidos'): string {
    const control = this.form.get(fieldName);
    if (!control || !control.errors) return '';

    const label = fieldName === 'nombre' ? 'nombre' : 'apellidos';

    if (control.errors['required']) {
      return fieldName === 'nombre' ? 'Por favor, introduce tu nombre.' : 'Por favor, introduce tus apellidos.';
    }
    if (control.errors['minlength']) {
      return fieldName === 'nombre'
        ? 'El nombre debe tener al menos 2 caracteres.'
        : 'Los apellidos deben tener al menos 2 caracteres.';
    }
    return 'Campo inválido.';
  }

  onSubmit(): void {
    this.serverError.set(null);

    if (this.form.valid) {
      this.isLoading.set(true);
      const data = this.form.value as InscripcionFormData;
      const fullName = `${data.nombre.trim()} ${data.apellidos.trim()}`;

      this.inscripcionService.inscribir(data).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.registeredFullName.set(fullName);
          this.isSubmitted.set(true);
        },
        error: (err) => {
          this.isLoading.set(false);
          const errorDetail = err?.error?.message || 'No se pudo conectar con el servidor o registrar los datos. Por favor, inténtalo de nuevo.';
          this.serverError.set(errorDetail);
        }
      });
    } else {
      this.form.markAllAsTouched();

      // Enfocar el primer campo inválido
      if (this.form.get('nombre')?.invalid) {
        this.nombreInputElement?.nativeElement.focus();
      } else if (this.form.get('apellidos')?.invalid) {
        this.apellidosInputElement?.nativeElement.focus();
      }
    }
  }

  onReset(): void {
    this.form.reset({
      nombre: '',
      apellidos: ''
    });
    this.isSubmitted.set(false);
    this.isLoading.set(false);
    this.serverError.set(null);
    this.registeredFullName.set('');

    // Enfocar automáticamente el campo Nombre tras reiniciar
    setTimeout(() => {
      this.nombreInputElement?.nativeElement.focus();
    }, 0);
  }
}

