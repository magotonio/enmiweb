import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { RegistrationActiveSessionComponent } from './registration-active-session.component';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';
import { InscripcionSessionData } from '../../../models/inscripcion.model';

describe('RegistrationActiveSessionComponent', () => {
  let component: RegistrationActiveSessionComponent;
  let fixture: ComponentFixture<RegistrationActiveSessionComponent>;
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let currentSessionSignal = signal<InscripcionSessionData | null>(null);

  const mockSessionData: InscripcionSessionData = {
    id: 123,
    fullName: 'Mago Houdini',
    artistName: 'Gran Houdini',
    apellidos: 'Houdini',
    email: 'houdini@test.com',
    telefono: '612345678',
    status: 'iniciada',
    modalidad: null,
    registeredAt: '2026-09-08T12:00:00.000Z'
  };

  beforeEach(async () => {
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', ['clearSession'], {
      currentSession: currentSessionSignal
    });
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegistrationActiveSessionComponent],
      providers: [
        { provide: InscripcionSessionService, useValue: mockSessionService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    currentSessionSignal.set(mockSessionData);
    fixture = TestBed.createComponent(RegistrationActiveSessionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render active session data from sessionService by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#activeSessionCard')).toBeTruthy();
    expect(el.textContent).toContain('Mago Houdini');
    expect(el.textContent).toContain('#ENMI-123');
    expect(el.textContent).toContain('houdini@test.com');
  });

  it('should allow overriding session data via @Input() session', () => {
    const customData: InscripcionSessionData = {
      id: 456,
      fullName: 'David Copperfield',
      artistName: '',
      apellidos: 'Copperfield',
      email: 'copperfield@test.com',
      telefono: '699887766',
      status: 'pagada',
      modalidad: null,
      registeredAt: '2026-09-08T14:00:00.000Z'
    };

    component.session = customData;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('David Copperfield');
    expect(el.textContent).toContain('#ENMI-456');
    expect(el.textContent).toContain('Pagada');
    expect(el.textContent).not.toContain('Pendiente de Pago');
    expect(el.querySelector('#continuePayBtn')).toBeNull();
  });

  it('should navigate to /pago on continuarAlPago() when no event listener is attached', () => {
    component.continuarAlPago();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
  });

  it('should emit continuePayment event when continuarAlPago() is called and listener is attached', () => {
    const spy = jasmine.createSpy('continuePaymentSpy');
    component.continuePayment.subscribe(spy);

    component.continuarAlPago();
    expect(spy).toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should clear session on iniciarNuevoRegistro() when no event listener is attached', () => {
    component.iniciarNuevoRegistro();
    expect(mockSessionService.clearSession).toHaveBeenCalled();
  });

  it('should hide payment and keep new registration available when the session becomes paid', () => {
    currentSessionSignal.set({ ...mockSessionData, status: 'pagada' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pagada');
    expect(fixture.nativeElement.textContent).not.toContain('Pendiente de Pago');
    expect(fixture.nativeElement.textContent).not.toContain('Puedes continuar al paso de pago');
    expect(fixture.nativeElement.querySelector('#continuePayBtn')).toBeNull();
    expect(fixture.nativeElement.querySelector('#newRegistrationBtn')).toBeTruthy();
  });

  it('should not navigate or emit payment events for a paid registration', () => {
    component.session = { ...mockSessionData, status: 'pagada' };
    component.continuarAlPago();
    const listener = jasmine.createSpy('continuePayment');
    component.continuePayment.subscribe(listener);
    component.continuarAlPago();

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('should emit newRegistration event when iniciarNuevoRegistro() is called and listener is attached', () => {
    const spy = jasmine.createSpy('newRegistrationSpy');
    component.newRegistration.subscribe(spy);

    component.iniciarNuevoRegistro();
    expect(spy).toHaveBeenCalled();
    expect(mockSessionService.clearSession).not.toHaveBeenCalled();
  });
});
