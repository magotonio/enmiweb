import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PagoService } from '../../services/pago.service';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';
import { ModalidadPago, PagoConfigInfo } from '../../models/inscripcion.model';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pago.component.html',
  styleUrls: []
})

export class PagoComponent implements OnInit {
  private readonly pagoService = inject(PagoService);
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Configuración de pagos y pasarela
  pagoConfig = signal<PagoConfigInfo | null>(null);
  isDemoPagoActive = computed(() => this.pagoConfig()?.demo_pago !== false);
  selectedModalidad = signal<ModalidadPago>('redsys');
  isProcessingPayment = signal<boolean>(false);
  paymentError = signal<string | null>(null);
  paymentNotice = signal<string | null>(null);
  copiedField = signal<string | null>(null);

  // Control de pantalla: selector de pago vs pantalla de confirmación/éxito
  isCompleted = signal<boolean>(false);

  // Datos reactivos de la sesión
  sessionData = this.sessionService.currentSession;
  registeredId = computed(() => this.sessionData()?.id || 0);
  registeredFullName = computed(() => this.sessionData()?.fullName || 'Participante');
  registeredArtistName = computed(() => this.sessionData()?.artistName || '');
  registeredEmail = computed(() => this.sessionData()?.email || '');
  registeredPhone = computed(() => this.sessionData()?.telefono || '');
  registeredStatus = computed(() => this.sessionData()?.status || 'iniciada');

  ngOnInit(): void {
    // 1. Cargar configuración pública de pago
    this.loadPagoConfig();

    // 2. Si la sesión ya estaba en estado pagada o con modalidad confirmada, mostrar pantalla final
    const currentSession = this.sessionService.getSession();
    if (currentSession) {
      if (currentSession.modalidad) {
        this.selectedModalidad.set(currentSession.modalidad);
      }
      if (currentSession.status === 'pagada' || (currentSession.status === 'pendiente' && currentSession.modalidad)) {
        this.isCompleted.set(true);
      }
    }

    // 3. Comprobar retorno de pasarela Redsys mediante query parameters
    this.route.queryParams.subscribe(params => {
      const pagoStatus = params['pago'];
      const idParam = params['id'];

      if (idParam && !isNaN(Number(idParam))) {
        const id = Number(idParam);

        // Si por alguna razón la sesión local no tenía el ID, lo sincronizamos
        if (!this.sessionService.hasSession()) {
          this.sessionService.saveSession({
            id,
            fullName: 'Participante #' + id,
            apellidos: 'PARTICIPANTE',
            email: '',
            telefono: '',
            status: pagoStatus === 'ok' ? 'pagada' : 'pendiente',
            modalidad: 'redsys'
          });
        }

        if (pagoStatus === 'ok') {
          // El pago en Redsys fue exitoso
          this.sessionService.updateStatus('pagada', 'redsys');
          this.isCompleted.set(true);
          this.paymentNotice.set('¡Tu pago ha sido procesado y verificado correctamente por la pasarela de Redsys!');
          this.pagoService.sincronizarRetornoRedsys(id, 'ok').subscribe();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (pagoStatus === 'ko') {
          // El pago en Redsys fue cancelado o rechazado
          this.sessionService.updateStatus('pendiente', 'redsys');
          this.selectedModalidad.set('redsys');
          this.isCompleted.set(false);
          this.paymentError.set('La pasarela de pago no completó la transacción o fue cancelada. Tu inscripción se encuentra en estado pendiente. Puedes reintentar el pago o elegir otra modalidad.');
          this.pagoService.sincronizarRetornoRedsys(id, 'ko').subscribe();
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
          importe: '250.00',
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
          },
          demo_pago: true
        });
      }
    });
  }

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
        this.sessionService.updateModalidad('redsys');
        this.pagoService.submitToRedsysGateway(params);
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.paymentError.set(err?.error?.message || 'No se pudo conectar con la pasarela de pago. Por favor, inténtalo de nuevo.');
      }
    });
  }

  /**
   * Simulador de pruebas para desarrollo local
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
          this.sessionService.updateStatus('pagada', 'redsys');
          this.isCompleted.set(true);
          this.paymentNotice.set(res.message || '¡Pago completado con éxito! Inscripción pagada y confirmada.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          this.sessionService.updateStatus('pendiente', 'redsys');
          this.paymentError.set(res.message || 'El pago no ha sido completado. Tu inscripción queda en estado pendiente.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.paymentError.set(err?.error?.message || 'Error al ejecutar la simulación de pago.');
      }
    });
  }

  /**
   * Confirma la selección de modalidades manuales (Bizum, Transferencia, Otras)
   */
  confirmarMetodoManual(modalidad: ModalidadPago): void {
    const id = this.registeredId();
    if (id <= 0) return;

    this.isProcessingPayment.set(true);
    this.paymentError.set(null);

    this.pagoService.confirmarModalidad(id, modalidad).subscribe({
      next: () => {
        this.isProcessingPayment.set(false);
        this.sessionService.updateStatus('pendiente', modalidad);
        this.isCompleted.set(true);
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
    const rawApellidos = this.sessionData()?.apellidos || 'PARTICIPANTE';
    const apellidos = rawApellidos.trim().toUpperCase().replace(/\s+/g, '-');
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

  /**
   * Permite volver a la pantalla de selección de modalidad si aún está pendiente
   */
  cambiarModalidad(): void {
    this.isCompleted.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Limpia la sesión y navega a la página de registro para inscribir a otra persona
   */
  registrarOtro(): void {
    this.sessionService.clearSession();
    this.router.navigate(['/registro']);
  }
}
