import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { PagoComponent } from './pago.component';
import { PagoService } from '../../services/pago.service';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';
import { DescuentoTokenInfo } from '../../models/inscripcion.model';

describe('PagoComponent', () => {
  let component: PagoComponent;
  let fixture: ComponentFixture<PagoComponent>;
  let mockPagoService: jasmine.SpyObj<PagoService>;
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let queryParams$: BehaviorSubject<Record<string, string>>;
  const descuento: DescuentoTokenInfo = {
    valido: true,
    token_id: 5,
    token: 'MAGIA50',
    descuento: 50,
    descuento_str: '50.00',
    precio_original: 250,
    nuevo_total: 200,
    nuevo_total_str: '200.00',
    usos_restantes: 1
  };

  beforeEach(async () => {
    mockPagoService = jasmine.createSpyObj('PagoService', [
      'getPagoConfig',
      'validarDescuento',
      'iniciarRedsys',
      'confirmarModalidad',
      'simularRedsys',
      'getPagosByInscripcion',
      'submitToRedsysGateway'
    ]);
    queryParams$ = new BehaviorSubject<Record<string, string>>({});
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', [
      'saveSession',
      'getSession',
      'hasSession',
      'updateStatus',
      'updateModalidad',
      'updateDescuento',
      'clearSession'
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockPagoService.getPagoConfig.and.returnValue(of({
      success: true,
      importe: '250.00',
      bizum: { telefono: '+34 600 000 000', beneficiario: 'ENMI' },
      transferencia: { iban: 'ES00 1234', titular: 'ENMI', banco: 'Santander', concepto_template: 'ENMI-{ID}-{APELLIDOS}' },
      otras: { texto: 'Coordinación directa' },
      redsys: { entorno: 'sandbox', sandbox: true, tpv_url: 'https://sis-t.redsys.es' }
    }));

    mockSessionService.getSession.and.returnValue({
      id: 42,
      fullName: 'Carlos Gómez',
      artistName: 'Mago Carlos',
      apellidos: 'Gómez',
      email: 'carlos@mago.es',
      telefono: '600123456',
      status: 'iniciada',
      modalidad: null
    });

    // Mock session signal read
    (mockSessionService as any).currentSession = () => ({
      id: 42,
      fullName: 'Carlos Gómez',
      artistName: 'Mago Carlos',
      apellidos: 'Gómez',
      email: 'carlos@mago.es',
      telefono: '600123456',
      status: 'iniciada',
      modalidad: null
    });

    await TestBed.configureTestingModule({
      imports: [PagoComponent],
      providers: [
        { provide: PagoService, useValue: mockPagoService },
        { provide: InscripcionSessionService, useValue: mockSessionService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create PagoComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should display participant info from session', () => {
    expect(component.registeredId()).toBe(42);
    expect(component.registeredFullName()).toBe('Carlos Gómez');
    expect(component.registeredStatus()).toBe('iniciada');
  });

  it('should change payment modality', () => {
    component.chooseModalidad('bizum');
    expect(component.selectedModalidad()).toBe('bizum');

    component.chooseModalidad('transferencia');
    expect(component.selectedModalidad()).toBe('transferencia');
  });

  it('should not trust Redsys return query parameters as payment confirmation', () => {
    mockSessionService.hasSession.and.returnValue(true);
    mockPagoService.getPagosByInscripcion.and.returnValue(of({
      success: true,
      inscripcion_id: 42,
      total: 0,
      pagos: []
    }));

    queryParams$.next({ pago: 'ok', id: '42' });

    expect(mockPagoService.getPagosByInscripcion).toHaveBeenCalledWith(42);
    expect(mockSessionService.updateStatus).not.toHaveBeenCalledWith('pagada', 'redsys');
    expect(component.isCompleted()).toBeFalse();
  });

  it('should mark payment complete only when the API reports a paid Redsys payment', () => {
    mockSessionService.hasSession.and.returnValue(true);
    mockPagoService.getPagosByInscripcion.and.returnValue(of({
      success: true,
      inscripcion_id: 42,
      total: 1,
      pagos: [{ modalidad_pago: 'redsys', estado: 'pagado', tipo_registro: 'redsys', pago_confirmado: true }]
    } as any));

    queryParams$.next({ pago: 'ko', id: '42' });

    expect(mockSessionService.updateStatus).toHaveBeenCalledWith('pagada', 'redsys');
    expect(component.isCompleted()).toBeTrue();
  });

  for (const tipo of ['manual_administracion', 'simulacion', 'promesa'] as const) {
    it(`should not treat ${tipo} as a validated card payment`, () => {
      mockSessionService.hasSession.and.returnValue(true);
      mockPagoService.getPagosByInscripcion.and.returnValue(of({
        success: true,
        pagos: [{
          id: 1,
          inscripcion_id: 42,
          referencia: 'ENMI-TEST',
          cantidad_pagada: 250,
          modalidad_pago: 'redsys',
          estado: 'pagado',
          tipo_registro: tipo,
          pago_confirmado: tipo === 'manual_administracion',
          fecha_creacion: '2026-11-01 10:00:00'
        }]
      }));

      queryParams$.next({ pago: 'ok', id: '42' });

      expect(mockSessionService.updateStatus).not.toHaveBeenCalledWith('pagada', 'redsys');
      expect(component.isCompleted()).toBeFalse();
    });
  }

  it('should apply and remove discount code', () => {
    mockPagoService.validarDescuento.and.returnValue(of({
      success: true,
      descuento: {
        valido: true,
        token_id: 5,
        token: 'MAGIA50',
        descuento: 50,
        descuento_str: '50.00',
        precio_original: 250,
        nuevo_total: 200,
        nuevo_total_str: '200.00',
        usos_restantes: 4
      }
    }));

    component.codigoDescuentoInput.set('MAGIA50');
    component.aplicarDescuento();

    expect(mockPagoService.validarDescuento).toHaveBeenCalledWith('MAGIA50');
    expect(component.descuentoInfo()?.token).toBe('MAGIA50');
    expect(component.importeFinal()).toBe(200);
    expect(component.importeFinalStr()).toBe('200.00');
    expect(mockSessionService.updateDescuento).toHaveBeenCalledWith(component.descuentoInfo());

    component.quitarDescuento();
    expect(component.descuentoInfo()).toBeNull();
    expect(component.importeFinal()).toBe(250);
    expect(mockSessionService.updateDescuento).toHaveBeenCalledWith(null);
  });

  it('should restore the applied discount after a failed gateway return and send it on retry', () => {
    const session = mockSessionService.getSession();
    if (!session) throw new Error('Expected an enrollment session');
    mockSessionService.getSession.and.returnValue({
      ...session, status: 'pendiente', modalidad: 'redsys', descuento
    });
    mockSessionService.hasSession.and.returnValue(true);
    mockPagoService.getPagosByInscripcion.and.returnValue(of({
      success: true, inscripcion_id: 42, total: 0, pagos: []
    }));
    mockPagoService.iniciarRedsys.and.returnValue(of({
      success: true, inscripcion_id: 42, tpv_url: 'https://sis-t.redsys.es',
      Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: 'params',
      Ds_Signature: 'signature', order: '123456789012', importe: '200.00', sandbox: true
    }));
    fixture.destroy();
    queryParams$.next({ pago: 'ko', id: '42' });
    fixture = TestBed.createComponent(PagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isCompleted()).toBeFalse();
    expect(component.descuentoInfo()).toEqual(descuento);
    expect(component.codigoDescuentoInput()).toBe('MAGIA50');
    expect(component.importeFinalStr()).toBe('200.00');
    expect(fixture.nativeElement.textContent).toContain('Cupón: MAGIA50');
    expect(mockPagoService.validarDescuento).not.toHaveBeenCalled();

    component.procederRedsysOficial();
    expect(mockPagoService.iniciarRedsys).toHaveBeenCalledWith(42, 'MAGIA50');
    expect(mockPagoService.submitToRedsysGateway).toHaveBeenCalled();

    mockPagoService.confirmarModalidad.and.returnValue(of({ success: true }));
    component.confirmarMetodoManual('transferencia');
    expect(mockPagoService.confirmarModalidad).toHaveBeenCalledWith(42, 'transferencia', 'MAGIA50');
  });

  it('should clear the stored discount when validation fails', () => {
    mockPagoService.validarDescuento.and.returnValue(throwError(() => ({
      error: { message: 'El código ha caducado.' }
    })));
    component.codigoDescuentoInput.set('CADUCADO');
    component.aplicarDescuento();

    expect(component.descuentoInfo()).toBeNull();
    expect(mockSessionService.updateDescuento).toHaveBeenCalledWith(null);
    expect(component.descuentoError()).toBe('El código ha caducado.');
  });

  it('should confirm manual modality (bizum) and mark completed', () => {
    mockPagoService.confirmarModalidad.and.returnValue(of({
      success: true,
      inscripcion_id: 42,
      estado: 'pendiente'
    }));

    component.confirmarMetodoManual('bizum');

    expect(mockPagoService.confirmarModalidad).toHaveBeenCalledWith(42, 'bizum', undefined);
    expect(mockSessionService.updateStatus).toHaveBeenCalledWith('pendiente', 'bizum');
    expect(component.isCompleted()).toBeTrue();
  });

  it('should clear session and navigate to /registro on registrarOtro', () => {
    component.registrarOtro();
    expect(mockSessionService.clearSession).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/registro']);
  });

  it('should show simulator buttons when demo_pago is true', () => {
    component.pagoConfig.set({
      success: true,
      importe: '250.00',
      bizum: { telefono: '+34 600 000 000', beneficiario: 'ENMI' },
      transferencia: { iban: 'ES00 1234', titular: 'ENMI', banco: 'Santander', concepto_template: 'ENMI' },
      otras: { texto: 'Directo' },
      redsys: { entorno: 'sandbox', sandbox: true, tpv_url: 'https://sis-t.redsys.es' },
      demo_pago: true
    });
    fixture.detectChanges();

    expect(component.isDemoPagoActive()).toBeTrue();
    const okBtn = fixture.nativeElement.querySelector('#simulateOkBtn');
    const koBtn = fixture.nativeElement.querySelector('#simulateKoBtn');
    expect(okBtn).toBeTruthy();
    expect(koBtn).toBeTruthy();
  });

  it('should hide simulator buttons when demo_pago is false', () => {
    component.pagoConfig.set({
      success: true,
      importe: '250.00',
      bizum: { telefono: '+34 600 000 000', beneficiario: 'ENMI' },
      transferencia: { iban: 'ES00 1234', titular: 'ENMI', banco: 'Santander', concepto_template: 'ENMI' },
      otras: { texto: 'Directo' },
      redsys: { entorno: 'sandbox', sandbox: true, tpv_url: 'https://sis-t.redsys.es' },
      demo_pago: false
    });
    fixture.detectChanges();

    expect(component.isDemoPagoActive()).toBeFalse();
    const okBtn = fixture.nativeElement.querySelector('#simulateOkBtn');
    const koBtn = fixture.nativeElement.querySelector('#simulateKoBtn');
    expect(okBtn).toBeNull();
    expect(koBtn).toBeNull();
  });
});
