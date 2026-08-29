import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LogsService } from './logs.service';
import { AuthService } from './auth.service';
import { provideRouter } from '@angular/router';
import { AuthUser } from '../models/usuario.model';

describe('LogsService', () => {
  let service: LogsService;
  let authService: AuthService;
  let httpMock: HttpTestingController;

  const mockSuperadmin: AuthUser = {
    id: 1,
    login: 'superadmin',
    email: 'admin@enmi.es',
    rol: 'superadministrador',
    bloqueado: false
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LogsService,
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    service = TestBed.inject(LogsService);
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);

    authService.currentUser.set(mockSuperadmin);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch logs with operator params and filters', () => {
    service.getLogs({ q: 'login', nivel: 'ERROR' }).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.data.length).toBe(1);
    });

    const req = httpMock.expectOne(request => request.url.includes('logs.php'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('operator_id')).toBe('1');
    expect(req.request.params.get('operator_login')).toBe('superadmin');
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

  it('should send POST request to clear old logs with operator credentials', () => {
    service.clearOldLogs().subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.message).toContain('purgaron');
    });

    const req = httpMock.expectOne(request => request.url.includes('logs.php'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.action).toBe('clear_old');
    expect(req.request.body.operator_id).toBe(1);
    expect(req.request.body.operator_login).toBe('superadmin');

    req.flush({
      success: true,
      message: 'Se purgaron 10 logs antiguos.'
    });
  });
});
