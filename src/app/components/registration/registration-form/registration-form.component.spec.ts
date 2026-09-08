import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { RegistrationFormComponent } from './registration-form.component';
import { InscripcionService } from '../../../services/inscripcion.service';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';

describe('RegistrationFormComponent', () => {
  let component: RegistrationFormComponent;
  let fixture: ComponentFixture<RegistrationFormComponent>;
  let mockInscripcionService: jasmine.SpyObj<InscripcionService>;
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockInscripcionService = jasmine.createSpyObj('InscripcionService', ['inscribir']);
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', ['saveSession', 'getSession', 'hasSession', 'clearSession']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockInscripcionService.inscribir.and.returnValue(of({
      success: true,
      message: 'Inscripción guardada correctamente.',
      id: 1,
      estado: 'iniciada',
      data: {
        nombre: 'Carlos',
        apellidos: 'Gómez',
        nombre_artistico: 'Mago Carlos',
        email: 'carlos@mago.es',
        quiero_participar: true
      }
    }));

    await TestBed.configureTestingModule({
      imports: [RegistrationFormComponent],
      providers: [
        { provide: InscripcionService, useValue: mockInscripcionService },
        { provide: InscripcionSessionService, useValue: mockSessionService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the registration form', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form as invalid', () => {
    expect(component.form.valid).toBeFalse();
  });

  it('should validate required fields and email format', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.form.controls['nif_pasaporte'].setValue('12345678Z');
    component.form.controls['email'].setValue('invalid-email');
    component.form.controls['telefono'].setValue('600123456');
    component.form.controls['origen'].setValue('Madrid');
    component.form.controls['acepta_privacidad'].setValue(true);
    expect(component.form.valid).toBeFalse();

    component.form.controls['email'].setValue('carlos@mago.es');
    expect(component.form.valid).toBeTrue();
  });

  it('should handle successful submission, save session and navigate to /pago', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.form.controls['nombre_artistico'].setValue('Mago Carlos');
    component.form.controls['nif_pasaporte'].setValue('12345678Z');
    component.form.controls['email'].setValue('carlos@mago.es');
    component.form.controls['telefono'].setValue('600123456');
    component.form.controls['origen'].setValue('Segovia');
    component.form.controls['quiero_participar'].setValue(true);
    component.form.controls['acepta_privacidad'].setValue(true);
    component.form.controls['consentimiento_imagen'].setValue(true);
    component.form.controls['comentarios'].setValue('Interesado en participar en el concurso o taller');

    component.onSubmit();

    expect(mockInscripcionService.inscribir).toHaveBeenCalled();
    expect(mockSessionService.saveSession).toHaveBeenCalledWith(jasmine.objectContaining({
      id: 1,
      fullName: 'Carlos Gómez',
      artistName: 'Mago Carlos',
      email: 'carlos@mago.es',
      telefono: '600123456',
      status: 'iniciada'
    }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
  });

  it('should open and accept privacy policy from modal', () => {
    component.openPrivacidadModal();
    expect(component.showPrivacidadModal()).toBeTrue();

    component.acceptPrivacidadFromModal();
    expect(component.showPrivacidadModal()).toBeFalse();
    expect(component.form.get('acepta_privacidad')?.value).toBeTrue();
  });

  it('should open and close participacion info modal', () => {
    component.openParticipacionModal();
    expect(component.showParticipacionModal()).toBeTrue();

    component.closeParticipacionModal();
    expect(component.showParticipacionModal()).toBeFalse();
  });

  it('should handle duplicate registration errors (NIF, email, phone) from API', () => {
    const errorResponse = {
      status: 409,
      error: {
        success: false,
        duplicado: true,
        message: 'Ya existe una inscripción registrada en el sistema con el mismo NIF/Pasaporte, correo electrónico, número de móvil.',
        errors: {
          nif_pasaporte: 'Ya existe una inscripción registrada con este NIF / CIF / Pasaporte.',
          email: 'Ya existe una inscripción registrada con este correo electrónico.',
          telefono: 'Ya existe una inscripción registrada con este número de teléfono móvil.'
        }
      }
    };

    mockInscripcionService.inscribir.and.returnValue(throwError(() => errorResponse));

    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.form.controls['nif_pasaporte'].setValue('12345678Z');
    component.form.controls['email'].setValue('carlos@mago.es');
    component.form.controls['telefono'].setValue('600123456');
    component.form.controls['origen'].setValue('Madrid');
    component.form.controls['acepta_privacidad'].setValue(true);
    component.form.controls['consentimiento_imagen'].setValue(true);

    component.onSubmit();
    fixture.detectChanges();

    expect(component.isDuplicateError()).toBeTrue();
    expect(component.serverError()).toContain('Ya existe una inscripción registrada');

    const bannerEl = fixture.nativeElement.querySelector('#duplicateWarningBanner');
    expect(bannerEl).toBeTruthy();
    expect(bannerEl.textContent).toContain('Inscripción ya registrada');
    expect(bannerEl.textContent).toContain('Datos Duplicados');

    component.form.controls['nif_pasaporte'].setValue('87654321A');
    expect(component.serverFieldErrors()['nif_pasaporte']).toBeUndefined();
  });

  it('should show image rights confirmation modal when consentimiento_imagen is false on submit', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.form.controls['nif_pasaporte'].setValue('12345678Z');
    component.form.controls['email'].setValue('carlos@mago.es');
    component.form.controls['telefono'].setValue('600123456');
    component.form.controls['origen'].setValue('Madrid');
    component.form.controls['acepta_privacidad'].setValue(true);
    component.form.controls['consentimiento_imagen'].setValue(false);

    component.onSubmit();
    fixture.detectChanges();

    expect(component.showNoImagenModal()).toBeTrue();
    expect(mockInscripcionService.inscribir).not.toHaveBeenCalled();

    const modalTitle = fixture.nativeElement.querySelector('#noImagenModalTitle');
    expect(modalTitle).toBeTruthy();
    expect(modalTitle.textContent).toContain('No autorizo el uso de mi imagen');
  });

  it('should submit without image rights when user checks mandatory checkbox and confirms in modal', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.form.controls['nif_pasaporte'].setValue('12345678Z');
    component.form.controls['email'].setValue('carlos@mago.es');
    component.form.controls['telefono'].setValue('600123456');
    component.form.controls['origen'].setValue('Madrid');
    component.form.controls['acepta_privacidad'].setValue(true);
    component.form.controls['consentimiento_imagen'].setValue(false);

    component.onSubmit();
    expect(component.showNoImagenModal()).toBeTrue();

    // Trying to submit without checking checkbox should do nothing
    component.confirmNoImagenAndSubmit();
    expect(mockInscripcionService.inscribir).not.toHaveBeenCalled();

    // Check mandatory confirmation checkbox and submit
    component.toggleNoImagenConfirmedCheckbox(true);
    component.confirmNoImagenAndSubmit();

    expect(component.showNoImagenModal()).toBeFalse();
    expect(mockInscripcionService.inscribir).toHaveBeenCalledWith(jasmine.objectContaining({
      consentimiento_imagen: false
    }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
  });

  it('should authorize image and submit when user chooses authorize button in modal', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.form.controls['nif_pasaporte'].setValue('12345678Z');
    component.form.controls['email'].setValue('carlos@mago.es');
    component.form.controls['telefono'].setValue('600123456');
    component.form.controls['origen'].setValue('Madrid');
    component.form.controls['acepta_privacidad'].setValue(true);
    component.form.controls['consentimiento_imagen'].setValue(false);

    component.onSubmit();
    expect(component.showNoImagenModal()).toBeTrue();

    component.authorizeImagenAndSubmit();

    expect(component.showNoImagenModal()).toBeFalse();
    expect(component.form.get('consentimiento_imagen')?.value).toBeTrue();
    expect(mockInscripcionService.inscribir).toHaveBeenCalledWith(jasmine.objectContaining({
      consentimiento_imagen: true
    }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pago']);
  });

  it('should reset form and clear errors on onReset()', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.serverError.set('Error previo');
    component.onReset();
    expect(component.form.get('nombre')?.value).toBe('');
    expect(component.serverError()).toBeNull();
  });
});
