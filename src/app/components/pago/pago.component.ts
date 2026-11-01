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
  isLoadingPagoConfig = signal(false);
  configError = signal<string | null>(null);
  isRedsysActivo = computed(() => this.pagoConfig()?.redsys.activo === true);
  isDemoPagoActive = computed(() => this.isRedsysActivo() && this.pagoConfig()?.demo_pago !== false);
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
    // 2. Si la sesión ya estaba en estado pagada o con modalidad confirmada, mostrar pantalla final
    const currentSession = this.sessionService.getSession();
    if (currentSession) {
      if (currentSession.descuento) {
        this.mostrarDescuento(currentSession.descuento);
      }
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
            const paid = response.success && (response.pagos?.some(pago =>
              pago.tipo_registro === 'redsys' && pago.pago_confirmado
            ) ?? false);
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
              this.selectedModalidad.set('redsys');
              this.sessionService.updateStatus('pagada', 'redsys');
              this.isCompleted.set(true);
              this.paymentError.set(null);
              this.paymentNotice.set('El pago ha sido verificado correctamente por la pasarela de Redsys.');
            } else {
              this.sessionService.updateStatus('pendiente', 'redsys');
              this.isCompleted.set(false);
              this.normalizarModalidadDisponible();
              this.paymentNotice.set(null);
              this.paymentError.set(pagoStatus === 'ko'
                ? 'El pago no se completó. La inscripción permanece pendiente; puedes reintentarlo o elegir otra modalidad.'
                : 'Redsys todavía no confirma el pago. La inscripción permanece pendiente.');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
          error: () => {
            this.normalizarModalidadDisponible();
            this.paymentNotice.set(null);
            this.paymentError.set('No se pudo verificar el resultado del pago. La inscripción no se marcará como pagada.');
          }
        });
      }
    });
    this.loadPagoConfig();
  }

  loadPagoConfig(): void {
    this.isLoadingPagoConfig.set(true);
    this.configError.set(null);
    this.pagoConfig.set(null);
    this.pagoService.getPagoConfig().subscribe({
      next: (config) => {
        this.isLoadingPagoConfig.set(false);
        if (!config.success) {
          this.configError.set(config.message || 'No se pudo cargar la configuración de pago. Vuelve a intentarlo.');
          return;
        }
        this.pagoConfig.set(config);
        this.normalizarModalidadDisponible();
      },
      error: () => {
        this.isLoadingPagoConfig.set(false);
        this.configError.set('No se pudo cargar la configuración de pago. Vuelve a intentarlo.');
      }
    });
  }

  private normalizarModalidadDisponible(): void {
    if (this.pagoConfig() && !this.isCompleted() && this.selectedModalidad() === 'redsys' && !this.isRedsysActivo()) {
      this.selectedModalidad.set('bizum');
    }
  }

  chooseModalidad(mod: ModalidadPago): void {
    if (mod === 'redsys' && !this.isRedsysActivo()) {
      this.paymentError.set('El pago con Redsys no está disponible. Elige otra modalidad de pago.');
      return;
    }
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
          this.mostrarDescuento(res.descuento);
          this.sessionService.updateDescuento(res.descuento);
          this.descuentoError.set(null);
        } else {
          this.descuentoInfo.set(null);
          this.sessionService.updateDescuento(null);
          this.descuentoError.set(res.message || 'El código de descuento no está disponible.');
        }
      },
      error: (err) => {
        this.isValidatingDescuento.set(false);
        this.descuentoInfo.set(null);
        this.sessionService.updateDescuento(null);
        this.descuentoError.set(err?.error?.message || 'El código de descuento no está disponible o ha caducado.');
      }
    });
  }

  private mostrarDescuento(descuento: DescuentoTokenInfo): void {
    this.codigoDescuentoInput.set(descuento.token);
    this.descuentoInfo.set(descuento);
    this.descuentoExito.set(`¡Descuento de ${descuento.descuento_str} € aplicado! Total a abonar: ${descuento.nuevo_total_str} €`);
  }

  /**
   * Retira el código de descuento aplicado
   */
  quitarDescuento(): void {
    this.sessionService.updateDescuento(null);
    this.descuentoInfo.set(null);
    this.codigoDescuentoInput.set('');
    this.descuentoError.set(null);
    this.descuentoExito.set(null);
  }

  /**
   * Procesa la opción 1: Pasarela Redsys Oficial
   */
  procederRedsysOficial(): void {
    if (!this.isRedsysActivo()) {
      this.paymentError.set('El pago con Redsys no está disponible. Elige otra modalidad de pago.');
      return;
    }
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
    if (!this.isDemoPagoActive()) {
      this.paymentError.set('El simulador de Redsys no está disponible.');
      return;
    }
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
    if (!this.pagoConfig()) {
      this.paymentError.set('Es necesario cargar la configuración de pago antes de continuar.');
      return;
    }
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
    this.normalizarModalidadDisponible();
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
