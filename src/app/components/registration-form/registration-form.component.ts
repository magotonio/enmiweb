import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EstadoInscripcion,
  InscripcionFormData,
  ModalidadPago,
  PagoConfigInfo
} from '../../models/inscripcion.model';
import { InscripcionService } from '../../services/inscripcion.service';
import { PagoService } from '../../services/pago.service';

export type RegistrationStep = 'form' | 'payment' | 'success';

@Component({
  selector: 'app-registration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registration-form.component.html',
  styleUrl: './registration-form.component.css'
})
export class RegistrationFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inscripcionService = inject(InscripcionService);
  private readonly pagoService = inject(PagoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('nombreInput') nombreInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('apellidosInput') apellidosInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('nifInput') nifInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('emailInput') emailInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('telefonoInput') telefonoInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('origenInput') origenInputElement?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  currentStep = signal<RegistrationStep>('form');
  isLoading = signal<boolean>(false);
  serverError = signal<string | null>(null);
  isDuplicateError = signal<boolean>(false);
  serverFieldErrors = signal<Record<string, string>>({});

  // Datos del participante registrado
  registeredId = signal<number>(0);
  registeredFullName = signal<string>('');
  registeredArtistName = signal<string>('');
  registeredEmail = signal<string>('');
  registeredPhone = signal<string>('');
  registeredStatus = signal<EstadoInscripcion>('iniciada');

  // Datos de pagos y pasarela
  pagoConfig = signal<PagoConfigInfo | null>(null);
  selectedModalidad = signal<ModalidadPago | null>(null);
  isProcessingPayment = signal<boolean>(false);
  paymentError = signal<string | null>(null);
  paymentNotice = signal<string | null>(null);
  copiedField = signal<string | null>(null);

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

  ngOnInit(): void {
    // Cargar configuración de pago de antemano
    this.loadPagoConfig();

    // Comprobar si el usuario vuelve de la pasarela Redsys mediante query parameters
    this.route.queryParams.subscribe(params => {
      const pagoStatus = params['pago'];
      const idParam = params['id'];

      if (idParam && !isNaN(Number(idParam))) {
        const id = Number(idParam);
        this.registeredId.set(id);

        if (pagoStatus === 'ok') {
          // El pago en Redsys fue exitoso
          this.registeredStatus.set('pagada');
          this.currentStep.set('success');
          this.paymentNotice.set('¡Tu pago ha sido procesado y verificado correctamente por la pasarela de Redsys!');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (pagoStatus === 'ko') {
          // El pago en Redsys fue cancelado o rechazado
          this.registeredStatus.set('pendiente');
          this.currentStep.set('payment');
          this.selectedModalidad.set('redsys');
          this.paymentError.set('La pasarela de pago no completó la transacción o fue cancelada. Tu inscripción se encuentra en estado pendiente. Puedes reintentar el pago o elegir otra modalidad.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  }

  loadPagoConfig(): void {
    this.pagoService.getPagoConfig().subscribe({
      next: (config) => {
        this.pagoConfig.set(config);
      },
      error: () => {
        // Fallback por defecto si hay problema temporal de conexión
        this.pagoConfig.set({
          success: true,
          importe: '120.00',
          bizum: {
            telefono: '+34 600 000 000',
            beneficiario: 'Encuentro Nacional de Magos Infantiles (ENMI)'
          },
          transferencia: {
            iban: 'ES00 0000 0000 0000 0000 0000',
            titular: 'Asociación ENMI 2027 / Eutikea',
            banco: 'Banco Santander',
            concepto_template: 'ENMI-2027-{ID}-{APELLIDOS}'
          },
          otras: {
            texto: 'Si necesitas otra forma de pago, nos pondremos en contacto contigo por teléfono o email para coordinarlo.'
          },
          redsys: {
            entorno: 'sandbox',
            sandbox: true,
            tpv_url: 'https://sis-t.redsys.es:25443/sis/realizarPago'
          }
        });
      }
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

  openNoImagenModal(): void {
    this.noImagenConfirmedCheckbox.set(false);
    this.showNoImagenModal.set(true);
  }

  closeNoImagenModal(): void {
    this.showNoImagenModal.set(false);
    this.noImagenConfirmedCheckbox.set(false);
  }

  toggleNoImagenConfirmedCheckbox(checked: boolean): void {
    this.noImagenConfirmedCheckbox.set(checked);
  }

  confirmNoImagenAndSubmit(): void {
    if (!this.noImagenConfirmedCheckbox()) return;
    this.showNoImagenModal.set(false);
    this.executeSubmission();
  }

  authorizeImagenAndSubmit(): void {
    this.form.get('consentimiento_imagen')?.setValue(true);
    this.showNoImagenModal.set(false);
    this.executeSubmission();
  }

  onSubmit(): void {
    this.serverError.set(null);
    this.serverFieldErrors.set({});
    this.isDuplicateError.set(false);

    if (this.form.valid) {
      const hasConsentimientoImagen = !!this.form.get('consentimiento_imagen')?.value;
      if (!hasConsentimientoImagen) {
        this.openNoImagenModal();
        return;
      }
      this.executeSubmission();
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

  private executeSubmission(): void {
    this.isLoading.set(true);
    const data = this.form.value as InscripcionFormData;
    const fullName = `${data.nombre.trim()} ${data.apellidos.trim()}`;
    const artistName = (data.nombre_artistico || '').trim();

    this.inscripcionService.inscribir(data).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const newId = res.id || 0;
        this.registeredId.set(newId);
        this.registeredFullName.set(fullName);
        this.registeredArtistName.set(artistName);
        this.registeredEmail.set(data.email.trim());
        this.registeredPhone.set(data.telefono.trim());
        this.registeredStatus.set('iniciada');

        // Pasar a la pantalla de modalidad de pago
        this.currentStep.set('payment');
        this.selectedModalidad.set('redsys'); // Por defecto Redsys seleccionado
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // =====================================================================
  // GESTIÓN DE MODALIDADES DE PAGO
  // =====================================================================
  chooseModalidad(mod: ModalidadPago): void {
    this.selectedModalidad.set(mod);
    this.paymentError.set(null);
  }

  /**
   * Procesa la opción 1: Pasarela Redsys Oficial
   */
  procederRedsysOficial(): void {
    const id = this.registeredId();
    if (id <= 0) return;

    this.isProcessingPayment.set(true);
    this.paymentError.set(null);

    this.pagoService.iniciarRedsys(id).subscribe({
      next: (params) => {
        this.isProcessingPayment.set(false);
        // Redirigir al formulario de Redsys
        this.pagoService.submitToRedsysGateway(params);
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.paymentError.set(err?.error?.message || 'No se pudo conectar con la pasarela de pago. Por favor, inténtalo de nuevo.');
      }
    });
  }

  /**
   * Ejecuta el simulador de Redsys (ideal para pruebas locales / Docker)
   */
  ejecutarSimuladorRedsys(resultado: 'ok' | 'ko'): void {
    const id = this.registeredId();
    if (id <= 0) return;

    this.isProcessingPayment.set(true);
    this.paymentError.set(null);

    this.pagoService.simularRedsys(id, resultado).subscribe({
      next: (res) => {
        this.isProcessingPayment.set(false);
        if (resultado === 'ok') {
          this.registeredStatus.set('pagada');
          this.currentStep.set('success');
          this.paymentNotice.set(res.message || '¡Pago completado con éxito! Inscripción pagada y confirmada.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          this.registeredStatus.set('pendiente');
          this.paymentError.set(res.message || 'El pago no ha sido completado. Tu inscripción queda en estado pendiente.');
        }
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.paymentError.set(err?.error?.message || 'Error al ejecutar la simulación de pago.');
      }
    });
  }

  /**
   * Confirma la selección de Bizum, Transferencia u Otras modalidades
   */
  confirmarMetodoManual(modalidad: ModalidadPago): void {
    const id = this.registeredId();
    if (id <= 0) return;

    this.isProcessingPayment.set(true);
    this.paymentError.set(null);

    this.pagoService.confirmarModalidad(id, modalidad).subscribe({
      next: () => {
        this.isProcessingPayment.set(false);
        this.registeredStatus.set('pendiente');
        this.currentStep.set('success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.paymentError.set(err?.error?.message || 'No se pudo registrar la modalidad de pago.');
      }
    });
  }

  /**
   * Obtiene la cadena del concepto personalizada con el ID y apellidos del participante
   */
  getConceptoPersonalizado(): string {
    const template = this.pagoConfig()?.transferencia?.concepto_template || 'ENMI-2027-{ID}-{APELLIDOS}';
    const idStr = this.registeredId() > 0 ? this.registeredId().toString() : '000';
    const apellidos = (this.form.get('apellidos')?.value || 'PARTICIPANTE').trim().toUpperCase().replace(/\s+/g, '-');
    return template.replace('{ID}', idStr).replace('{APELLIDOS}', apellidos);
  }

  /**
   * Copia texto al portapapeles y activa el badge temporal
   */
  copyToClipboard(text: string, fieldId: string): void {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField.set(fieldId);
      setTimeout(() => {
        if (this.copiedField() === fieldId) {
          this.copiedField.set(null);
        }
      }, 2500);
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
    this.currentStep.set('form');
    this.isLoading.set(false);
    this.isProcessingPayment.set(false);
    this.serverError.set(null);
    this.paymentError.set(null);
    this.paymentNotice.set(null);
    this.isDuplicateError.set(false);
    this.serverFieldErrors.set({});
    this.registeredId.set(0);
    this.registeredFullName.set('');
    this.registeredArtistName.set('');
    this.registeredEmail.set('');
    this.registeredPhone.set('');
    this.registeredStatus.set('iniciada');
    this.selectedModalidad.set(null);

    // Limpiar parámetros de URL si existieran
    this.router.navigate([], { queryParams: {} });

    // Enfocar automáticamente el campo Nombre tras reiniciar
    setTimeout(() => {
      this.nombreInputElement?.nativeElement.focus();
    }, 0);
  }
}
