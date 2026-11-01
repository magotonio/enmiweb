import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigService } from './config.service';
import { provideRouter } from '@angular/router';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.isMaintenanceMode()).toBeFalse();
  });

  it('should fetch and update maintenance mode to true when server returns 1', () => {
    service.checkMaintenance(true).subscribe(active => {
      expect(active).toBeTrue();
      expect(service.isMaintenanceMode()).toBeTrue();
      expect(service.isLoaded()).toBeTrue();
    });

    const req = httpMock.expectOne(request => request.url.includes('configuracion.php'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      mantenimiento: true,
      mantenimiento_valor: '1'
    });
  });

  it('should update maintenance mode via setMaintenanceMode', () => {
    service.setMaintenanceMode(true).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(service.isMaintenanceMode()).toBeTrue();
    });

    const req = httpMock.expectOne(request => request.url.includes('configuracion.php'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.clave).toBe('mantenimiento');
    expect(req.request.body.valor).toBe('1');
    req.flush({
      success: true,
      message: "Parámetro 'mantenimiento' actualizado correctamente.",
      mantenimiento: true
    });
  });

  it('should update demo pago mode via setDemoPagoMode', () => {
    service.setDemoPagoMode(false).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(service.isDemoPago()).toBeFalse();
    });

    const req = httpMock.expectOne(request => request.url.includes('configuracion.php'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.clave).toBe('pago_modo_demo');
    expect(req.request.body.valor).toBe('0');
    req.flush({
      success: true,
      message: "Parámetro 'pago_modo_demo' actualizado correctamente.",
      demo_pago: false
    });
  });

  it('requests the protected full list including secret metadata', () => {
    const items = [{ clave: 'smtp_pass', valor: '********', secreto: true }];
    service.getFullConfig().subscribe(result => expect(result).toEqual(items));
    const req = httpMock.expectOne(request => request.params.get('include_all') === '1');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, mantenimiento: false, configuracion: items });
  });

  it('propagates full-list HTTP errors instead of returning an empty list', () => {
    service.getFullConfig().subscribe({
      next: () => fail('A failed load must not appear successful'),
      error: error => expect(error.status).toBe(403)
    });
    httpMock.expectOne(request => request.params.has('include_all'))
      .flush({ message: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
  });

  it('rejects unsuccessful or malformed full-list responses', () => {
    for (const response of [
      { success: false, message: 'Error al consultar' },
      { success: true }
    ]) {
      service.getFullConfig().subscribe({
        next: () => fail('An invalid response must not appear successful'),
        error: error => expect(error instanceof Error).toBeTrue()
      });
      httpMock.expectOne(request => request.params.has('include_all')).flush(response);
    }
  });

  it('saves arbitrary values exactly and synchronizes maintenance and demo state', () => {
    service.setConfig('pago_otras_modalidades_texto', ' Texto\ncon saltos ').subscribe();
    const req = httpMock.expectOne(request => request.url.includes('configuracion.php'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ clave: 'pago_otras_modalidades_texto', valor: ' Texto\ncon saltos ' });
    req.flush({ success: true, mantenimiento: true, demo_pago: false });
    expect(service.isMaintenanceMode()).toBeTrue();
    expect(service.isDemoPago()).toBeFalse();
  });

  it('does not change global flags when saving fails', () => {
    service.setConfig('mantenimiento', '1').subscribe();
    httpMock.expectOne(request => request.url.includes('configuracion.php'))
      .flush({ success: false, mantenimiento: true, demo_pago: false });
    expect(service.isMaintenanceMode()).toBeFalse();
    expect(service.isDemoPago()).toBeTrue();
  });
});
