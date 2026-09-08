import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { RegistrationComponent } from './registration.component';
import { InscripcionService } from '../../services/inscripcion.service';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';
import { InscripcionSessionData } from '../../models/inscripcion.model';

describe('RegistrationComponent', () => {
  let component: RegistrationComponent;
  let fixture: ComponentFixture<RegistrationComponent>;
  let mockInscripcionService: jasmine.SpyObj<InscripcionService>;
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let currentSessionSignal = signal<InscripcionSessionData | null>(null);

  beforeEach(async () => {
    mockInscripcionService = jasmine.createSpyObj('InscripcionService', ['inscribir']);
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', ['saveSession', 'getSession', 'hasSession', 'clearSession'], {
      currentSession: currentSessionSignal
    });
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockSessionService.hasSession.and.callFake(() => currentSessionSignal() !== null);

    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        { provide: InscripcionService, useValue: mockInscripcionService },
        { provide: InscripcionSessionService, useValue: mockSessionService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } }
      ]
    }).compileComponents();

    currentSessionSignal.set(null);
    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the registration component', () => {
    expect(component).toBeTruthy();
  });

  it('should show registration form component when there is no active session', () => {
    expect(component.hasActiveSession()).toBeFalse();
    const formEl = fixture.nativeElement.querySelector('app-registration-form');
    expect(formEl).toBeTruthy();
  });

  it('should show active session card when an active session exists', () => {
    currentSessionSignal.set({
      id: 99,
      fullName: 'Mago Test',
      artistName: 'El Gran Mago',
      apellidos: 'Test',
      email: 'test@mago.es',
      telefono: '600000000',
      status: 'iniciada',
      modalidad: null,
      registeredAt: new Date().toISOString()
    });

    fixture.detectChanges();

    expect(component.hasActiveSession()).toBeTrue();
    const activeCard = fixture.nativeElement.querySelector('#activeSessionCard');
    expect(activeCard).toBeTruthy();
  });

  it('should navigate to /pago when continuarAlPago() is called', () => {
    component.continuarAlPago();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
  });

  it('should clear session when iniciarNuevoRegistro() is called', () => {
    component.iniciarNuevoRegistro();
    expect(mockSessionService.clearSession).toHaveBeenCalled();
  });
});
