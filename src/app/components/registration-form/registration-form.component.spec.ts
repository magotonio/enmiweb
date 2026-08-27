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
      data: { nombre: 'Carlos', apellidos: 'Gómez' }
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

  it('should validate nombre and apellidos require at least 2 characters', () => {
    component.form.controls['nombre'].setValue('A');
    component.form.controls['apellidos'].setValue('B');
    expect(component.form.valid).toBeFalse();

    component.form.controls['nombre'].setValue('Ana');
    component.form.controls['apellidos'].setValue('Pérez');
    expect(component.form.valid).toBeTrue();
  });

  it('should handle successful submission and reset', () => {
    component.form.controls['nombre'].setValue('Carlos');
    component.form.controls['apellidos'].setValue('Gómez');
    component.onSubmit();

    expect(component.isSubmitted()).toBeTrue();
    expect(component.registeredFullName()).toBe('Carlos Gómez');

    component.onReset();
    expect(component.isSubmitted()).toBeFalse();
    expect(component.registeredFullName()).toBe('');
    expect(component.form.value.nombre).toBe('');
  });
});
