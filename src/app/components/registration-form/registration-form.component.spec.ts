import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RegistrationFormComponent } from './registration-form.component';
import { InscripcionService } from '../../services/inscripcion.service';

describe('RegistrationFormComponent', () => {
  let component: RegistrationFormComponent;
  let fixture: ComponentFixture<RegistrationFormComponent>;
  let mockInscripcionService: jasmine.SpyObj<InscripcionService>;

  beforeEach(async () => {
    mockInscripcionService = jasmine.createSpyObj('InscripcionService', ['inscribir']);
    mockInscripcionService.inscribir.and.returnValue(of({
      success: true,
      message: 'Inscripción guardada correctamente.',
      id: 1,
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
        { provide: InscripcionService, useValue: mockInscripcionService }
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

  it('should handle successful submission and reset', () => {
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

    expect(component.isSubmitted()).toBeTrue();
    expect(component.registeredFullName()).toBe('Carlos Gómez');
    expect(component.registeredArtistName()).toBe('Mago Carlos');

    component.onReset();
    expect(component.isSubmitted()).toBeFalse();
    expect(component.registeredFullName()).toBe('');
    expect(component.form.value.nombre).toBe('');
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
});
