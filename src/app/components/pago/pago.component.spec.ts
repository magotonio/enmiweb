import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { PagoComponent } from './pago.component';
import { PagoService } from '../../services/pago.service';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';

describe('PagoComponent', () => {
  let component: PagoComponent;
  let fixture: ComponentFixture<PagoComponent>;
  let mockPagoService: jasmine.SpyObj<PagoService>;
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockPagoService = jasmine.createSpyObj('PagoService', [
      'getPagoConfig',
      'iniciarRedsys',
      'confirmarModalidad',
      'simularRedsys',
      'submitToRedsysGateway'
    ]);
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', [
      'saveSession',
      'getSession',
      'hasSession',
      'updateStatus',
      'updateModalidad',
      'clearSession'
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockPagoService.getPagoConfig.and.returnValue(of({
      success: true,
      importe: '120.00',
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
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } }
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

  it('should confirm manual modality (bizum) and mark completed', () => {
    mockPagoService.confirmarModalidad.and.returnValue(of({
      success: true,
      inscripcion_id: 42,
      estado: 'pendiente'
    }));

    component.confirmarMetodoManual('bizum');

    expect(mockPagoService.confirmarModalidad).toHaveBeenCalledWith(42, 'bizum');
    expect(mockSessionService.updateStatus).toHaveBeenCalledWith('pendiente', 'bizum');
    expect(component.isCompleted()).toBeTrue();
  });

  it('should clear session and navigate to /registro on registrarOtro', () => {
    component.registrarOtro();
    expect(mockSessionService.clearSession).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/registro']);
  });
});
