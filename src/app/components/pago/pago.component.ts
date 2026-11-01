import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PagoService } from '../../services/pago.service';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';
import { DescuentoTokenInfo, ModalidadPago, PagoConfigInfo } from '../../models/inscripcion.model';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  // Gestión de Códigos de Descuento
  codigoDescuentoInput = signal<string>('');
  descuentoInfo = signal<DescuentoTokenInfo | null>(null);
  isValidatingDescuento = signal<boolean>(false);
  descuentoError = signal<string | null>(null);
  descuentoExito = signal<string | null>(null);

  // Importes calculados reactivamente
  importeBase = computed(() => parseFloat(this.pagoConfig()?.importe || '250.00'));
  importeDescuento = computed(() => this.descuentoInfo()?.descuento || 0);
  importeFinal = computed(() => {
    const base = this.importeBase();
    const desc = this.importeDescuento();
    const final = base - desc;
    return final > 0 ? final : 0;
  });
  importeFinalStr = computed(() => this.importeFinal().toFixed(2));

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

    // 3. Treat the browser return as a hint and verify payment status with the API.
    this.route.queryParams.subscribe(params => {
      const pagoStatus = params['pago'];
      const idParam = params['id'];

      if (pagoStatus && idParam && !Number.isNaN(Number(idParam))) {
        const id = Number(idParam);
        this.selectedModalidad.set('redsys');
        this.paymentNotice.set('Verificando el resultado del pago...');

        this.pagoService.getPagosByInscripcion(id).subscribe({
          next: response => {
            const paid = response.pagos?.some(pago => pago.modalidad_pago === 'redsys' && pago.estado === 'pagado') ?? false;
            if (!this.sessionService.hasSession()) {
              this.sessionService.saveSession({
                id,
                fullName: 'Participante #' + id,
                apellidos: 'PARTICIPANTE',
                email: '',
                telefono: '',
                status: paid ? 'pagada' : 'pendiente',
                modalidad: 'redsys'
              });
            }

            if (paid) {
              this.sessionService.updateStatus('pagada', 'redsys');
              this.isCompleted.set(true);
              this.paymentError.set(null);
              this.paymentNotice.set('El pago ha sido verificado correctamente por la pasarela de Redsys.');
            } else {
              this.sessionService.updateStatus('pendiente', 'redsys');
              this.isCompleted.set(false);
              this.paymentNotice.set(null);
              this.paymentError.set(pagoStatus === 'ko'
                ? 'El pago no se completó. La inscripción permanece pendiente; puedes reintentarlo o elegir otra modalidad.'
                : 'Redsys todavía no confirma el pago. La inscripción permanece pendiente.');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
          error: () => {
            this.paymentNotice.set(null);
            this.paymentError.set('No se pudo verificar el resultado del pago. La inscripción no se marcará como pagada.');
          }
        });
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
            texto: 'Para otra forma de pago, nos pondremos en contacto contigo personalmente a través de tu teléfono o email.'
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
   * Aplica un código de descuento introducido por el usuario
   */
  aplicarDescuento(): void {
    const raw = this.codigoDescuentoInput().trim();
    if (!raw) {
      this.descuentoError.set('Por favor, introduce un código de descuento.');
      this.descuentoExito.set(null);
      return;
    }

    this.isValidatingDescuento.set(true);
    this.descuentoError.set(null);
    this.descuentoExito.set(null);

    this.pagoService.validarDescuento(raw).subscribe({
      next: (res) => {
        this.isValidatingDescuento.set(false);
        if (res.success && res.descuento) {
          this.descuentoInfo.set(res.descuento);
          this.descuentoExito.set(`¡Descuento de ${res.descuento.descuento_str} € aplicado! Total a abonar: ${res.descuento.nuevo_total_str} €`);
          this.descuentoError.set(null);
        } else {
          this.descuentoInfo.set(null);
          this.descuentoError.set(res.message || 'El código de descuento no está disponible.');
        }
      },
      error: (err) => {
        this.isValidatingDescuento.set(false);
        this.descuentoInfo.set(null);
        this.descuentoError.set(err?.error?.message || 'El código de descuento no está disponible o ha caducado.');
      }
    });
  }

  /**
   * Retira el código de descuento aplicado
   */
  quitarDescuento(): void {
    this.descuentoInfo.set(null);
    this.codigoDescuentoInput.set('');
    this.descuentoError.set(null);
    this.descuentoExito.set(null);
  }

  /**
   * Procesa la opción 1: Pasarela Redsys Oficial
   */
  procederRedsysOficial(): void {
    const id = this.registeredId();
    if (id <= 0) return;

    this.isProcessingPayment.set(true);
    this.paymentError.set(null);

    const codigo = this.descuentoInfo()?.token;

    this.pagoService.iniciarRedsys(id, codigo).subscribe({
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

    const codigo = this.descuentoInfo()?.token;

    this.pagoService.simularRedsys(id, resultado, codigo).subscribe({
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

    const codigo = this.descuentoInfo()?.token;

    this.pagoService.confirmarModalidad(id, modalidad, codigo).subscribe({
      next: (res) => {
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
