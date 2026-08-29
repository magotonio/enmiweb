import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { InscripcionService } from './inscripcion.service';
import { AuthService } from './auth.service';
import { InscripcionFormData } from '../models/inscripcion.model';
import { AuthUser } from '../models/usuario.model';
import { environment } from '../../environments/environment';

describe('InscripcionService', () => {
  let service: InscripcionService;
  let httpMock: HttpTestingController;
  let currentUserSignal = signal<AuthUser | null>(null);

  const mockAuthService = {
    currentUser: currentUserSignal
  };

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
    currentUserSignal.set(null);

    TestBed.configureTestingModule({
      providers: [
        InscripcionService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
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

  it('should send registration data without operator credentials when no user is logged in', () => {
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

  it('should attach operator credentials when an authenticated user registers a participant (allowing registration in maintenance mode)', () => {
    currentUserSignal.set({
      id: 1,
      login: 'admin',
      email: 'admin@eutikea.com',
      rol: 'superadministrador'
    });

    service.inscribir(sampleFormData).subscribe(res => {
      expect(res.success).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/inscribir.php`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.nombre).toBe('Elena');
    expect(req.request.body.operator_id).toBe(1);
    expect(req.request.body.operator_login).toBe('admin');
    expect(req.request.body.operator_email).toBe('admin@eutikea.com');

    req.flush({ success: true, message: 'Inscripción guardada correctamente.' });
  });

  it('should retrieve list of participants with filters and operator params', () => {
    currentUserSignal.set({
      id: 2,
      login: 'supervisor',
      email: 'supervisor@enmi2027.es',
      rol: 'supervisor'
    });

    service.getInscripciones({ q: 'Elena', estado: 'activo' }).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.count).toBe(1);
    });

    const req = httpMock.expectOne(request => 
      request.url === `${environment.apiUrl}/inscripciones.php` &&
      request.params.get('q') === 'Elena' &&
      request.params.get('estado') === 'activo' &&
      request.params.get('user_id') === '2' &&
      request.params.get('user_login') === 'supervisor'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      count: 1,
      data: []
    });
  });
});
