import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InscripcionService } from './inscripcion.service';
import { InscripcionFormData } from '../models/inscripcion.model';
import { environment } from '../../environments/environment';

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
        provideHttpClient(),
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
