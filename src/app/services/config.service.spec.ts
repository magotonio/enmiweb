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
});
