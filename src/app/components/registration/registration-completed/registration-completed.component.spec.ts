import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { InscripcionSessionData, PagosInscripcionResponse } from '../../../models/inscripcion.model';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';
import { PagoService } from '../../../services/pago.service';
import { RegistrationCompletedComponent } from './registration-completed.component';

describe('RegistrationCompletedComponent', () => {
  let fixture: ComponentFixture<RegistrationCompletedComponent>;
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockPagoService: jasmine.SpyObj<PagoService>;
  const currentSession = signal<InscripcionSessionData | null>(null);

  beforeEach(async () => {
    currentSession.set({
      id: 99,
      fullName: 'Mago Test',
      artistName: 'El Gran Mago',
      apellidos: 'Test',
      email: 'test@mago.es',
      telefono: '600000000',
      status: 'iniciada',
      modalidad: null,
      registeredAt: '2026-11-01T10:00:00Z'
    });
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', ['hasSession', 'clearSession', 'updateStatus'], {
      currentSession
    });
    mockSessionService.hasSession.and.callFake(() => currentSession() !== null);
    mockSessionService.clearSession.and.callFake(() => currentSession.set(null));
    mockSessionService.updateStatus.and.callFake(status => {
      const session = currentSession();
      if (session) currentSession.set({ ...session, status });
    });
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockPagoService = jasmine.createSpyObj('PagoService', ['getPagosByInscripcion']);
    mockPagoService.getPagosByInscripcion.and.returnValue(of({
      success: true, inscripcion_id: 99, estado: 'iniciada', pagos: []
    }));

    await TestBed.configureTestingModule({
      imports: [RegistrationCompletedComponent],
      providers: [
        { provide: InscripcionSessionService, useValue: mockSessionService },
        { provide: PagoService, useValue: mockPagoService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(RegistrationCompletedComponent);
  });

  it('should show the completed registration and session details without a form', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ya has completado tu registro');
    expect(fixture.nativeElement.textContent).toContain('Mago Test');
    expect(fixture.nativeElement.textContent).toContain('#ENMI-99');
    expect(fixture.nativeElement.querySelector('#activeSessionCard')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-registration-form')).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should redirect to registration without showing a completed message when there is no session', () => {
    currentSession.set(null);
    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/registro'], { replaceUrl: true });
    expect(fixture.nativeElement.querySelector('#activeSessionCard')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ya has completado tu registro');
    expect(mockPagoService.getPagosByInscripcion).not.toHaveBeenCalled();
  });

  it('should continue to payment from the summary button', () => {
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#continuePayBtn').click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
    expect(mockSessionService.clearSession).not.toHaveBeenCalled();
  });

  it('should clear the session before navigating to a new registration', () => {
    mockRouter.navigate.and.callFake(() => {
      expect(currentSession()).toBeNull();
      return Promise.resolve(true);
    });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#newRegistrationBtn').click();

    expect(mockSessionService.clearSession).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/registro']);
  });

  it('should refresh a stale session marked paid by administration even without payment records', () => {
    mockPagoService.getPagosByInscripcion.and.returnValue(of({
      success: true, inscripcion_id: 99, estado: 'pagada', pagos: []
    }));
    fixture.detectChanges();
    fixture.componentInstance.continuarAlPago();

    expect(mockPagoService.getPagosByInscripcion).toHaveBeenCalledWith(99);
    expect(mockSessionService.updateStatus).toHaveBeenCalledWith('pagada');
    expect(fixture.nativeElement.textContent).toContain('Pagada');
    expect(fixture.nativeElement.textContent).not.toContain('Pendiente de Pago');
    expect(fixture.nativeElement.querySelector('#continuePayBtn')).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('#newRegistrationBtn').click();
    expect(mockSessionService.clearSession).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/registro']);
  });

  it('should block payment until the current status is verified', () => {
    const response = new Subject<PagosInscripcionResponse>();
    mockPagoService.getPagosByInscripcion.and.returnValue(response);
    fixture.detectChanges();
    fixture.componentInstance.continuarAlPago();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#continuePayBtn')).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();

    response.next({ success: true, estado: 'pendiente', pagos: [] });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#continuePayBtn').click();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
  });

  it('should show verification errors, block payment and allow retrying', () => {
    mockPagoService.getPagosByInscripcion.and.returnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();
    fixture.componentInstance.continuarAlPago();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('No se pudo comprobar el estado');
    expect(fixture.nativeElement.querySelector('#continuePayBtn')).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();

    mockPagoService.getPagosByInscripcion.and.returnValue(of({
      success: true, estado: 'pagada', pagos: []
    }));
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Pagada');
  });

  it('should not enable payment when the API response has no registration status', () => {
    mockPagoService.getPagosByInscripcion.and.returnValue(of({ success: true, pagos: [] }));
    fixture.detectChanges();
    fixture.componentInstance.continuarAlPago();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(mockSessionService.updateStatus).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
