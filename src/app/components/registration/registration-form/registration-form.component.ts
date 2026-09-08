import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EstadoInscripcion, InscripcionFormData } from '../../../models/inscripcion.model';
import { InscripcionService } from '../../../services/inscripcion.service';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';

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
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly router = inject(Router);

  @ViewChild('nombreInput') nombreInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('apellidosInput') apellidosInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('nifInput') nifInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('emailInput') emailInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('telefonoInput') telefonoInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('origenInput') origenInputElement?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  isLoading = signal<boolean>(false);
  serverError = signal<string | null>(null);
  isDuplicateError = signal<boolean>(false);
  serverFieldErrors = signal<Record<string, string>>({});

  // Modales de información y legal
  showParticipacionModal = signal<boolean>(false);
  showPrivacidadModal = signal<boolean>(false);
  showNoImagenModal = signal<boolean>(false);
  noImagenConfirmedCheckbox = signal<boolean>(false);

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

    // Limpiar errores del servidor en un campo cuando el usuario lo modifica
    ['nombre', 'apellidos', 'nif_pasaporte', 'email', 'telefono', 'origen', 'asociacion', 'comentarios'].forEach(fieldName => {
      this.form.get(fieldName)?.valueChanges.subscribe(() => {
        const currentErrors = this.serverFieldErrors();
        if (currentErrors[fieldName]) {
          const updated = { ...currentErrors };
          delete updated[fieldName];
          this.serverFieldErrors.set(updated);
          if (Object.keys(updated).length === 0) {
            this.serverError.set(null);
            this.isDuplicateError.set(false);
          }
        }
      });
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    const hasServerError = !!this.serverFieldErrors()[fieldName];
    return !!(hasServerError || (control && control.invalid && (control.dirty || control.touched)));
  }

  getErrorMessage(fieldName: string): string {
    const serverMsg = this.serverFieldErrors()[fieldName];
    if (serverMsg) {
      return serverMsg;
    }

    const control = this.form.get(fieldName);
    if (!control || !control.errors) return '';

    if (control.errors['serverError']) {
      return control.errors['serverError'];
    }

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

  // =====================================================================
  // MODALES
  // =====================================================================

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
    this.closePrivacidadModal();
  }

  openNoImagenModal(): void {
    this.showNoImagenModal.set(true);
    this.noImagenConfirmedCheckbox.set(false);
  }

  closeNoImagenModal(): void {
    this.showNoImagenModal.set(false);
    this.noImagenConfirmedCheckbox.set(false);
  }

  toggleNoImagenConfirmedCheckbox(checked: boolean): void {
    this.noImagenConfirmedCheckbox.set(checked);
  }

  authorizeImagenAndSubmit(): void {
    this.form.get('consentimiento_imagen')?.setValue(true);
    this.closeNoImagenModal();
    this.executeSubmission();
  }

  confirmNoImagenAndSubmit(): void {
    if (!this.noImagenConfirmedCheckbox()) return;
    this.closeNoImagenModal();
    this.executeSubmission();
  }

  // =====================================================================
  // FORM SUBMISSION & VALIDACIÓN
  // =====================================================================
  onSubmit(): void {
    this.serverError.set(null);
    this.isDuplicateError.set(false);
    this.serverFieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstError();
      return;
    }

    const consentimientoImagen = this.form.get('consentimiento_imagen')?.value;
    if (!consentimientoImagen) {
      this.openNoImagenModal();
      return;
    }

    this.executeSubmission();
  }

  private focusFirstError(): void {
    const fields = ['nombre', 'apellidos', 'nif_pasaporte', 'email', 'telefono', 'origen', 'acepta_privacidad'];
    for (const field of fields) {
      const control = this.form.get(field);
      if (control?.invalid) {
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

  private executeSubmission(): void {
    this.isLoading.set(true);
    const data = this.form.value as InscripcionFormData;
    const fullName = `${data.nombre.trim()} ${data.apellidos.trim()}`;
    const artistName = (data.nombre_artistico || '').trim();

    this.inscripcionService.inscribir(data).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const newId = res.id || 0;

        // Guardar estado completo en la sesión
        this.sessionService.saveSession({
          id: newId,
          fullName,
          artistName,
          apellidos: data.apellidos.trim(),
          email: data.email.trim(),
          telefono: data.telefono.trim(),
          status: (res.estado as EstadoInscripcion) || 'iniciada',
          modalidad: null
        });

        // Navegar a la página de pago independiente
        this.router.navigate(['/pago']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorBody = err?.error;
        const isDup = !!errorBody?.duplicado || err?.status === 409;
        this.isDuplicateError.set(isDup);

        const errorDetail = errorBody?.message || 'No se pudo conectar con el servidor o registrar los datos. Por favor, inténtalo de nuevo.';
        this.serverError.set(errorDetail);

        if (errorBody?.errors && typeof errorBody.errors === 'object') {
          this.serverFieldErrors.set(errorBody.errors);

          for (const [fieldName, errorMsg] of Object.entries(errorBody.errors as Record<string, string>)) {
            const control = this.form.get(fieldName);
            if (control) {
              control.setErrors({ serverError: errorMsg });
              control.markAsTouched();
            }
          }

          // Enfocar automáticamente el primer campo conflictivo
          const dupKeys = Object.keys(errorBody.errors);
          if (dupKeys.includes('nif_pasaporte')) {
            this.nifInputElement?.nativeElement.focus();
          } else if (dupKeys.includes('email')) {
            this.emailInputElement?.nativeElement.focus();
          } else if (dupKeys.includes('telefono')) {
            this.telefonoInputElement?.nativeElement.focus();
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
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
    this.showNoImagenModal.set(false);
    this.noImagenConfirmedCheckbox.set(false);
    this.isLoading.set(false);
    this.serverError.set(null);
    this.isDuplicateError.set(false);
    this.serverFieldErrors.set({});

    // Enfocar automáticamente el campo Nombre tras reiniciar
    setTimeout(() => {
      this.nombreInputElement?.nativeElement.focus();
    }, 0);
  }
}
