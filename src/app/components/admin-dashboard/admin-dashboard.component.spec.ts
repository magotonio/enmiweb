import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';
import { InscripcionService } from '../../services/inscripcion.service';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let configService: jasmine.SpyObj<ConfigService>;
  let inscripcionService: jasmine.SpyObj<InscripcionService>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['logout', 'isBlocked'], {
      currentUser: signal({ id: 1, login: 'superadmin', rol: 'superadministrador' }),
      userRole: signal('superadministrador'),
      userRoleLabel: signal('Superadministrador'),
      userRoleBadge: signal({ badge: 'bg-amber-100 text-amber-800' }),
      isSuperAdmin: signal(true),
      isSupervisor: signal(true),
      isAsistente: signal(true)
    });

    const configSpy = jasmine.createSpyObj('ConfigService', ['checkMaintenance', 'setMaintenanceMode'], {
      isMaintenanceMode: signal(false)
    });
    configSpy.checkMaintenance.and.returnValue(of(false));
    configSpy.setMaintenanceMode.and.returnValue(of({ success: true, message: 'OK' }));

    const inscripcionSpy = jasmine.createSpyObj('InscripcionService', ['getInscripciones', 'exportToCsv']);
    inscripcionSpy.getInscripciones.and.returnValue(of({ success: true, data: [] }));

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: ConfigService, useValue: configSpy },
        { provide: InscripcionService, useValue: inscripcionSpy }
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    configService = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
    inscripcionService = TestBed.inject(InscripcionService) as jasmine.SpyObj<InscripcionService>;

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the admin dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should open modal for enabling maintenance mode', () => {
    component.openMaintenanceModal(true);
    expect(component.isMaintenanceModalOpen()).toBeTrue();
    expect(component.pendingMaintenanceState()).toBeTrue();
  });

  it('should open modal for disabling maintenance mode', () => {
    component.openMaintenanceModal(false);
    expect(component.isMaintenanceModalOpen()).toBeTrue();
    expect(component.pendingMaintenanceState()).toBeFalse();
  });

  it('should close maintenance modal without changing state', () => {
    component.openMaintenanceModal(true);
    component.closeMaintenanceModal();
    expect(component.isMaintenanceModalOpen()).toBeFalse();
    expect(component.pendingMaintenanceState()).toBeNull();
  });

  it('should confirm enabling maintenance mode and update successfully', () => {
    component.openMaintenanceModal(true);
    component.confirmMaintenanceChange();

    expect(configService.setMaintenanceMode).toHaveBeenCalledWith(true);
    expect(component.isMaintenanceModalOpen()).toBeFalse();
    expect(component.pendingMaintenanceState()).toBeNull();
    expect(component.maintenanceSuccessMessage()).toContain('ACTIVADO');
  });

  it('should confirm disabling maintenance mode and update successfully', () => {
    component.openMaintenanceModal(false);
    component.confirmMaintenanceChange();

    expect(configService.setMaintenanceMode).toHaveBeenCalledWith(false);
    expect(component.isMaintenanceModalOpen()).toBeFalse();
    expect(component.pendingMaintenanceState()).toBeNull();
    expect(component.maintenanceSuccessMessage()).toContain('DESACTIVADO');
  });

  it('should handle error when confirming maintenance mode update', () => {
    configService.setMaintenanceMode.and.returnValue(throwError(() => ({ error: { message: 'Error de servidor' } })));
    component.openMaintenanceModal(true);
    component.confirmMaintenanceChange();

    expect(component.isMaintenanceModalOpen()).toBeFalse();
    expect(component.errorMessage()).toBe('Error de servidor');
  });
});
