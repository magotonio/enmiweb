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
  @ViewChild('nifInput') nifInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('emailInput') emailInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('telefonoInput') telefonoInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('origenInput') origenInputElement?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  isSubmitted = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  serverError = signal<string | null>(null);
  registeredFullName = signal<string>('');
  registeredArtistName = signal<string>('');
  registeredEmail = signal<string>('');

  // Modales de información y legal
  showParticipacionModal = signal<boolean>(false);
  showPrivacidadModal = signal<boolean>(false);

  constructor() {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      apellidos: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      nombre_artistico: ['', [Validators.maxLength(100)]],
      nif_pasaporte: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      telefono: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]],
      origen: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      asociacion: ['', [Validators.maxLength(150)]],
      quiero_participar: [false],
      acepta_privacidad: [false, [Validators.requiredTrue]],
      consentimiento_imagen: [false],
      comentarios: ['', [Validators.maxLength(1000)]]
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getErrorMessage(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      switch (fieldName) {
        case 'nombre': return 'Por favor, introduce tu nombre.';
        case 'apellidos': return 'Por favor, introduce tus apellidos.';
        case 'nif_pasaporte': return 'El NIF, CIF o pasaporte es obligatorio.';
        case 'email': return 'El correo electrónico es obligatorio.';
        case 'telefono': return 'El teléfono móvil es obligatorio.';
        case 'origen': return 'Por favor, indica tu localidad, provincia o país de residencia.';
        default: return 'Este campo es obligatorio.';
      }
    }

    if (control.errors['requiredTrue']) {
      if (fieldName === 'acepta_privacidad') {
        return 'Debes aceptar la Política de Privacidad y el tratamiento de datos para inscribirte.';
      }
      return 'Debes aceptar esta condición obligatoria.';
    }

    if (control.errors['email']) {
      return 'Introduce una dirección de correo electrónico válida (ej. mago@ejemplo.com).';
    }

    if (control.errors['minlength']) {
      const min = control.errors['minlength'].requiredLength;
      return `Debe tener al menos ${min} caracteres.`;
    }

    if (control.errors['maxlength']) {
      const max = control.errors['maxlength'].requiredLength;
      return `No puede superar los ${max} caracteres.`;
    }

    return 'Campo inválido.';
  }

  openParticipacionModal(): void {
    this.showParticipacionModal.set(true);
  }

  closeParticipacionModal(): void {
    this.showParticipacionModal.set(false);
  }

  openPrivacidadModal(): void {
    this.showPrivacidadModal.set(true);
  }

  closePrivacidadModal(): void {
    this.showPrivacidadModal.set(false);
  }

  acceptPrivacidadFromModal(): void {
    this.form.get('acepta_privacidad')?.setValue(true);
    this.form.get('acepta_privacidad')?.markAsTouched();
    this.showPrivacidadModal.set(false);
  }

  onSubmit(): void {
    this.serverError.set(null);

    if (this.form.valid) {
      this.isLoading.set(true);
      const data = this.form.value as InscripcionFormData;
      const fullName = `${data.nombre.trim()} ${data.apellidos.trim()}`;
      const artistName = (data.nombre_artistico || '').trim();

      this.inscripcionService.inscribir(data).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.registeredFullName.set(fullName);
          this.registeredArtistName.set(artistName);
          this.registeredEmail.set(data.email.trim());
          this.isSubmitted.set(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (err) => {
          this.isLoading.set(false);
          const errorDetail = err?.error?.message || 'No se pudo conectar con el servidor o registrar los datos. Por favor, inténtalo de nuevo.';
          this.serverError.set(errorDetail);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      this.form.markAllAsTouched();

      // Enfocar el primer campo con error de forma accesible
      const orderOfControls = ['nombre', 'apellidos', 'nif_pasaporte', 'email', 'telefono', 'origen', 'acepta_privacidad'];
      for (const field of orderOfControls) {
        if (this.form.get(field)?.invalid) {
          switch (field) {
            case 'nombre': this.nombreInputElement?.nativeElement.focus(); break;
            case 'apellidos': this.apellidosInputElement?.nativeElement.focus(); break;
            case 'nif_pasaporte': this.nifInputElement?.nativeElement.focus(); break;
            case 'email': this.emailInputElement?.nativeElement.focus(); break;
            case 'telefono': this.telefonoInputElement?.nativeElement.focus(); break;
            case 'origen': this.origenInputElement?.nativeElement.focus(); break;
          }
          break;
        }
      }
    }
  }

  onReset(): void {
    this.form.reset({
      nombre: '',
      apellidos: '',
      nombre_artistico: '',
      nif_pasaporte: '',
      email: '',
      telefono: '',
      origen: '',
      asociacion: '',
      quiero_participar: false,
      acepta_privacidad: false,
      consentimiento_imagen: false,
      comentarios: ''
    });
    this.isSubmitted.set(false);
    this.isLoading.set(false);
    this.serverError.set(null);
    this.registeredFullName.set('');
    this.registeredArtistName.set('');
    this.registeredEmail.set('');

    // Enfocar automáticamente el campo Nombre tras reiniciar
    setTimeout(() => {
      this.nombreInputElement?.nativeElement.focus();
    }, 0);
  }
}
