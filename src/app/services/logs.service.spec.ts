import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LogsService } from './logs.service';

describe('LogsService', () => {
  let service: LogsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LogsService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(LogsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch logs with filters and without client identity claims', () => {
    service.getLogs({ q: 'login', nivel: 'ERROR' }).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.data.length).toBe(1);
    });

    const req = httpMock.expectOne(request => request.url.includes('logs.php'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('operator_id')).toBeFalse();
    expect(req.request.params.has('operator_login')).toBeFalse();
    expect(req.request.params.get('q')).toBe('login');
    expect(req.request.params.get('nivel')).toBe('ERROR');

    req.flush({
      success: true,
      total: 1,
      limit: 50,
      offset: 0,
      stats: { total: 1, errores: 1, warnings: 0, infos: 0, auth_events: 1 },
      data: [{
        id: 1,
        nivel: 'ERROR',
        categoria: 'auth',
        accion: 'login_fallido',
        mensaje: 'Fallo de acceso',
        fecha_creacion: '2026-08-29 19:00:00'
      }]
    });
  });

  it('should send POST request to clear old logs without operator identity claims', () => {
    service.clearOldLogs().subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.message).toContain('purgaron');
    });

    const req = httpMock.expectOne(request => request.url.includes('logs.php'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.action).toBe('clear_old');
    expect(req.request.body.operator_id).toBeUndefined();
    expect(req.request.body.operator_login).toBeUndefined();

    req.flush({
      success: true,
      message: 'Se purgaron 10 logs antiguos.'
    });
  });
});
