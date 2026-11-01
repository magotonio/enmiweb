import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Router, ActivatedRoute, Params } from '@angular/router';
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
  let queryParams: BehaviorSubject<Params>;

  beforeEach(async () => {
    queryParams = new BehaviorSubject<Params>({});
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
        { provide: ActivatedRoute, useValue: { queryParams } }
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
    const formEl = fixture.nativeElement.querySelector('app-registration-form');
    expect(formEl).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-registration-active-session')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ya has completado tu registro');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should redirect an active session to the separate completed page', () => {
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

    queryParams.next({});
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/registro/completado'], { replaceUrl: true });
    expect(fixture.nativeElement.querySelector('app-registration-active-session')).toBeNull();
  });

  for (const hasSession of [false, true]) {
    for (const params of [{ pago: 'ok', id: '99' }, { id: '99' }, { pago: 'ko' }]) {
      it(`should preserve payment parameters ${JSON.stringify(params)} with session=${hasSession}`, () => {
        mockSessionService.hasSession.and.returnValue(hasSession);
        queryParams.next(params);
        expect(mockRouter.navigate).toHaveBeenCalledOnceWith(['/pago'], { queryParams: params });
      });
    }
  }
});
