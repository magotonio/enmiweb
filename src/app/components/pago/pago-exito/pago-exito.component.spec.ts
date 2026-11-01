import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { routes } from '../../../app.routes';
import { InscripcionSessionData, PagoConfigInfo } from '../../../models/inscripcion.model';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';
import { PagoService } from '../../../services/pago.service';
import { PagoComponent } from '../pago.component';
import { PagoExitoComponent } from './pago-exito.component';

@Component({ standalone: true, template: '' })
class DestinationComponent {}

describe('Payment success routing', () => {
  let harness: RouterTestingHarness;
  let sessionService: InscripcionSessionService;
  let pagoService: jasmine.SpyObj<PagoService>;
  let maintenance: boolean;
  const session: InscripcionSessionData = {
    id: 42, fullName: 'Carlos Gomez', artistName: 'Mago Carlos', apellidos: 'Gomez',
    email: 'carlos@example.com', telefono: '600123456', status: 'pendiente', modalidad: 'bizum'
  };
  const config: PagoConfigInfo = {
    success: true, importe: '250.00',
    bizum: { telefono: '600000000', beneficiario: 'ENMI' },
    transferencia: { iban: 'ES00', titular: 'ENMI', banco: 'Banco', concepto_template: 'ENMI-{ID}' },
    otras: { texto: 'Directo' },
    redsys: { activo: false, entorno: 'sandbox', sandbox: true, tpv_url: 'https://sis-t.redsys.es' }
  };

  beforeEach(async () => {
    maintenance = false;
    pagoService = jasmine.createSpyObj<PagoService>('PagoService', ['getPagoConfig', 'confirmarModalidad']);
    pagoService.getPagoConfig.and.returnValue(of(config));
    pagoService.confirmarModalidad.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          ...routes.filter(route => route.path === 'pago' || route.path === 'pago/exito'),
          { path: 'registro', component: DestinationComponent },
          { path: 'mantenimiento', component: DestinationComponent }
        ]),
        { provide: PagoService, useValue: pagoService },
        { provide: ConfigService, useValue: {
          isLoaded: () => true, isMaintenanceMode: () => maintenance
        } },
        { provide: AuthService, useValue: { isLoggedIn: () => false } }
      ]
    });
    sessionService = TestBed.inject(InscripcionSessionService);
    sessionService.clearSession();
    sessionService.saveSession(session);
    spyOn(window, 'scrollTo');
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionService.clearSession());

  it('renders the standalone confirmation for a saved payment intention', async () => {
    await harness.navigateByUrl('/pago/exito', PagoExitoComponent);

    expect(TestBed.inject(Router).url).toBe('/pago/exito');
    expect(harness.routeNativeElement?.querySelector('#successState')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('#paymentModalitySection')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('¡Inscripción Recibida con Éxito!');
    expect(harness.routeNativeElement?.textContent).toContain('intención de pago');
    expect(harness.routeNativeElement?.textContent).toContain('#ENMI-42');
    expect(harness.routeNativeElement?.querySelector('#confirmedEmail')?.textContent).toContain(session.email);
    expect(sessionService.getSession()?.status).toBe('pendiente');
  });

  it('renders paid sessions without offering another payment', async () => {
    sessionService.saveSession({ ...session, status: 'pagada', modalidad: 'redsys' });
    const component = await harness.navigateByUrl('/pago/exito', PagoExitoComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Pago Confirmado');
    expect(harness.routeNativeElement?.querySelector('#changeModalityBtn')).toBeNull();
    component.cambiarModalidad();
    expect(TestBed.inject(Router).url).toBe('/pago/exito');
  });

  it('redirects paid sessions from the selector to success', async () => {
    sessionService.saveSession({ ...session, status: 'pagada' });
    await harness.navigateByUrl('/pago', PagoExitoComponent);
    expect(TestBed.inject(Router).url).toBe('/pago/exito');
  });

  it('redirects saved intentions from the selector to success', async () => {
    await harness.navigateByUrl('/pago');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/pago/exito');
    expect(harness.routeNativeElement?.querySelector('#successState')).not.toBeNull();
  });

  it('redirects success visits without a session to registration', async () => {
    sessionService.clearSession();
    await harness.navigateByUrl('/pago/exito?pago=ok&id=42', DestinationComponent);
    expect(TestBed.inject(Router).url).toBe('/registro');
  });

  for (const status of ['iniciada', 'pendiente'] as const) {
    it(`redirects ${status} sessions without a confirmed modality to the selector`, async () => {
      sessionService.saveSession({ ...session, status, modalidad: null });
      await harness.navigateByUrl('/pago/exito', PagoComponent);
      expect(TestBed.inject(Router).url).toBe('/pago');
    });
  }

  it('allows changing modality and returns to success after confirmation', async () => {
    const component = await harness.navigateByUrl('/pago/exito', PagoExitoComponent);
    const discount = {
      valido: true, token_id: 1, token: 'MAGIA50', descuento: 50, descuento_str: '50.00',
      precio_original: 250, nuevo_total: 200, nuevo_total_str: '200.00', usos_restantes: 1
    };
    sessionService.updateDescuento(discount);
    component.cambiarModalidad();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/pago?cambiar=1');
    const selector = await harness.navigateByUrl('/pago?cambiar=1', PagoComponent);
    expect(selector.descuentoInfo()).toEqual(discount);
    expect(selector.selectedModalidad()).toBe('bizum');
    expect(harness.routeNativeElement?.querySelector('#successState')).toBeNull();

    selector.confirmarMetodoManual('transferencia');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/pago/exito');
    expect(sessionService.getSession()?.modalidad).toBe('transferencia');
    expect(sessionService.getSession()?.status).toBe('pendiente');
    expect(pagoService.confirmarModalidad).toHaveBeenCalledWith(42, 'transferencia', 'MAGIA50');
  });

  it('preserves historical Redsys modality until returning to the selector', async () => {
    sessionService.saveSession({ ...session, modalidad: 'redsys' });
    const component = await harness.navigateByUrl('/pago/exito', PagoExitoComponent);
    expect(component.selectedModalidad()).toBe('redsys');
    component.cambiarModalidad();
    await harness.fixture.whenStable();
    const selector = await harness.navigateByUrl('/pago?cambiar=1', PagoComponent);
    expect(selector.selectedModalidad()).toBe('bizum');
    expect(sessionService.getSession()?.modalidad).toBe('redsys');
  });

  it('clears the session when registering another participant', async () => {
    const component = await harness.navigateByUrl('/pago/exito', PagoExitoComponent);
    component.registrarOtro();
    await harness.fixture.whenStable();
    expect(sessionService.hasSession()).toBeFalse();
    expect(TestBed.inject(Router).url).toBe('/registro');
  });

  it('retains maintenance protection on the success page', async () => {
    maintenance = true;
    await harness.navigateByUrl('/pago/exito', DestinationComponent);
    expect(TestBed.inject(Router).url).toBe('/mantenimiento');
  });

  it('shows configuration failures without inventing a fee and allows retry', async () => {
    pagoService.getPagoConfig.and.returnValue(throwError(() => new Error('Network error')));
    const component = await harness.navigateByUrl('/pago/exito', PagoExitoComponent);
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('250.00');

    pagoService.getPagoConfig.and.returnValue(of(config));
    component.loadPagoConfig();
    harness.detectChanges();
    expect(component.configError()).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('250.00');
  });

  it('rejects unsuccessful configuration responses', async () => {
    pagoService.getPagoConfig.and.returnValue(of({ ...config, success: false, message: 'No disponible' }));
    const component = await harness.navigateByUrl('/pago/exito', PagoExitoComponent);
    expect(component.configError()).toBe('No disponible');
    expect(component.pagoConfig()).toBeNull();
  });
});
