import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InscripcionService } from './inscripcion.service';
import { InscripcionFormData } from '../models/inscripcion.model';
import { environment } from '../../environments/environment';
import { apiSecurityInterceptor } from '../interceptors/api-security.interceptor';
import { CsrfTokenService } from './csrf-token.service';
import { PagoService } from './pago.service';

describe('InscripcionService', () => {
  let service: InscripcionService;
  let httpMock: HttpTestingController;
  const sampleFormData: InscripcionFormData = {
    nombre: 'Elena',
    apellidos: 'Navarro Sánchez',
    nombre_artistico: 'Magic Elena',
    nif_pasaporte: '12345678Z',
    email: 'elena@magia.es',
    telefono: '600123456',
    origen: 'Segovia',
    asociacion: 'Círculo Mágico Segoviano',
    quiero_participar: true,
    acepta_privacidad: true,
    consentimiento_imagen: true,
    comentarios: 'Participación en gala'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InscripcionService,
        provideHttpClient(withInterceptors([apiSecurityInterceptor])),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(InscripcionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send registration data without client-supplied operator credentials', () => {
    service.inscribir(sampleFormData).subscribe(res => {
      expect(res.success).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/inscribir.php`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.nombre).toBe('Elena');
    expect(req.request.body.operator_id).toBeUndefined();
    expect(req.request.body.operator_login).toBeUndefined();

    req.flush({ success: true, message: 'Inscripción guardada correctamente.' });
  });

  it('should not attach operator identity when registering from an authenticated browser', () => {
    service.inscribir(sampleFormData).subscribe(res => {
      expect(res.success).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/inscribir.php`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.nombre).toBe('Elena');
    expect(req.request.body.operator_id).toBeUndefined();
    expect(req.request.body.operator_login).toBeUndefined();
    expect(req.request.body.operator_email).toBeUndefined();

    req.flush({ success: true, message: 'Inscripción guardada correctamente.' });
  });

  it('should retrieve participants with filters and no identity claims', () => {
    service.getInscripciones({ q: 'Elena', estado: 'activo' }).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.count).toBe(1);
    });

    const req = httpMock.expectOne(request =>
      request.url === `${environment.apiUrl}/inscripciones.php` &&
      request.params.get('q') === 'Elena' &&
      request.params.get('estado') === 'activo' &&
      !request.params.has('user_id') &&
      !request.params.has('user_login') &&
      !request.params.has('user_email')
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      count: 1,
      data: []
    });
  });

  describe('registration session token', () => {
    for (const previousToken of [null, 'expired-session-token', 'current-session-token']) {
      it(`should use the registration session token for payments when the previous token is ${previousToken}`, () => {
        const csrf = TestBed.inject(CsrfTokenService);
        const pagoService = TestBed.inject(PagoService);
        csrf.setToken(previousToken);

        service.inscribir(sampleFormData).subscribe(() => {
          expect(csrf.token).toBe('registration-session-token');
          pagoService.confirmarModalidad(42, 'transferencia').subscribe();
          pagoService.iniciarRedsys(42).subscribe();
          pagoService.simularRedsys(42, 'ok').subscribe();
        });

        const registration = httpMock.expectOne(`${environment.apiUrl}/inscribir.php`);
        expect(registration.request.withCredentials).toBeTrue();
        registration.flush({
          success: true,
          message: 'Inscripcion iniciada.',
          id: 42,
          estado: 'iniciada',
          csrf_token: 'registration-session-token'
        });

        const payments = httpMock.match(`${environment.apiUrl}/pago.php`);
        expect(payments.length).toBe(3);
        expect(payments.map(payment => payment.request.body.accion)).toEqual([
          'confirmar_modalidad', 'iniciar_redsys', 'simular_redsys'
        ]);
        for (const payment of payments) {
          expect(payment.request.headers.get('X-CSRF-Token')).toBe('registration-session-token');
          expect(payment.request.withCredentials).toBeTrue();
          payment.flush({ success: true });
        }
      });
    }

    it('should preserve the session token when registration fails', () => {
      const csrf = TestBed.inject(CsrfTokenService);
      csrf.setToken('current-session-token');

      service.inscribir(sampleFormData).subscribe({
        next: () => fail('Registration should fail'),
        error: error => expect(error.status).toBe(409)
      });

      httpMock.expectOne(`${environment.apiUrl}/inscribir.php`).flush(
        { success: false, message: 'Duplicate registration' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(csrf.token).toBe('current-session-token');
    });

  });

  it('should update inscription status to pagada', () => {
    service.actualizarEstado(42, 'pagada').subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.nuevo_estado).toBe('pagada');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/inscripciones.php`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      accion: 'actualizar_estado',
      id: 42,
      inscripcion_id: 42,
      estado: 'pagada'
    });

    req.flush({
      success: true,
      message: "Estado de la inscripción actualizado a 'pagada' con éxito.",
      inscripcion_id: 42,
      nuevo_estado: 'pagada'
    });
  });
});
