import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { AdminConfiguracionComponent } from './admin-configuracion.component';
import { ConfigService } from '../../services/config.service';
import { ConfigItem, ConfigResponse } from '../../models/configuracion.model';
import { routes } from '../../app.routes';
import { roleGuard } from '../../guards/role.guard';
import { maintenanceGuard } from '../../guards/maintenance.guard';

describe('AdminConfiguracionComponent', () => {
  let fixture: ComponentFixture<AdminConfiguracionComponent>;
  let component: AdminConfiguracionComponent;
  let service: jasmine.SpyObj<ConfigService>;
  const config: ConfigItem[] = [
    { clave: 'mantenimiento', valor: '0' },
    { clave: 'smtp_host', valor: 'mail.example.test', descripcion: 'Servidor de correo' },
    { clave: 'smtp_pass', valor: '********', secreto: true },
    { clave: 'notification_emails', valor: 'admin@example.test' },
    { clave: 'token_resetpwd_expiracion_horas', valor: '24' },
    { clave: 'pago_importe', valor: '250.00' },
    { clave: 'pago_bizum_telefono', valor: '+34 600 000 000' },
    { clave: 'pago_transferencia_iban', valor: 'ES00' },
    { clave: 'pago_redsys_activo', valor: '1' },
    { clave: 'pago_redsys_clave_secreta', valor: '********', secreto: true },
    { clave: 'personalizada', valor: null }
  ];

  beforeEach(async () => {
    service = jasmine.createSpyObj<ConfigService>('ConfigService', ['getFullConfig', 'setConfig']);
    service.getFullConfig.and.returnValue(of(config));
    service.setConfig.and.returnValue(of({ success: true, mantenimiento: false }));
    await TestBed.configureTestingModule({
      imports: [AdminConfiguracionComponent],
      providers: [provideRouter([]), { provide: ConfigService, useValue: service }]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminConfiguracionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('restricts the route to superadministrators with both guards', () => {
    const route = routes.find(route => route.path === 'admin/configuracion');
    expect(route?.component).toBe(AdminConfiguracionComponent);
    expect(route?.data?.['roles']).toEqual(['superadministrador']);
    expect(route?.canActivate).toEqual([maintenanceGuard, roleGuard]);
  });

  it('classifies every key once, including unknown and nullable entries', () => {
    expect(component.visibleGroups().map(group => group.id)).toEqual([
      'sistema', 'correo', 'notificaciones', 'acceso', 'pagos', 'bizum', 'transferencia', 'redsys', 'otros'
    ]);
    expect(component.visibleGroups().flatMap(group => group.items).length).toBe(config.length);
    expect(component.pendingCount()).toBe(0);
    expect(component.groupFor('pago_modo_demo')).toBe('pagos');
    expect(component.groupFor('pago_otras_modalidades_texto')).toBe('pagos');
  });

  it('renders every group as an initially collapsed accordion', () => {
    const root: HTMLElement = fixture.nativeElement;
    const groups = root.querySelectorAll('details');
    expect(groups.length).toBe(component.visibleGroups().length);
    groups.forEach(group => {
      expect(group.open).toBeFalse();
      expect(group.querySelector('summary h2')).not.toBeNull();
    });

  });

  it('allows enabling and disabling Redsys independently of demo mode and other settings', () => {
    const root: HTMLElement = fixture.nativeElement;
    const select = root.querySelector<HTMLSelectElement>('#config-pago_redsys_activo')!;
    expect(select.tagName).toBe('SELECT');
    expect(Array.from(select.options).map(option => option.value)).toEqual(['1', '0']);
    expect(component.groupFor('pago_redsys_activo')).toBe('redsys');

    for (const valor of ['0', '1']) {
      select.value = valor;
      select.dispatchEvent(new Event('change'));
      service.setConfig.and.returnValue(of({ success: true, mantenimiento: false, valor }));
      component.guardar(component.items().find(item => item.clave === 'pago_redsys_activo')!);
      fixture.detectChanges();
      expect(service.setConfig).toHaveBeenCalledWith('pago_redsys_activo', valor);
      expect(component.items().find(item => item.clave === 'pago_redsys_activo')?.valor).toBe(valor);
    }
    expect(service.setConfig).toHaveBeenCalledTimes(2);
  });

  it('toggles groups independently without losing pending edits', () => {
    const root: HTMLElement = fixture.nativeElement;
    const groups = root.querySelectorAll('details');
    const summary = groups[1].querySelector('summary')!;
    summary.click();
    expect(groups[1].open).toBeTrue();
    expect(groups[0].open).toBeFalse();

    component.setDraft('smtp_host', 'pending.example.test');
    fixture.detectChanges();
    summary.click();
    expect(groups[1].open).toBeFalse();
    summary.click();
    expect(groups[1].open).toBeTrue();
    expect(component.items().find(item => item.clave === 'smtp_host')?.draft).toBe('pending.example.test');
    expect(component.pendingCount()).toBe(1);
  });

  it('combines case-insensitive search by description with the group filter', () => {
    component.searchQuery.set(' SERVIDOR ');
    expect(component.visibleGroups()[0].items.map(item => item.clave)).toEqual(['smtp_host']);
    component.selectedGroup.set('redsys');
    expect(component.visibleGroups()).toEqual([]);
  });

  it('renders secret inputs empty and never saves an untouched secret', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#config-smtp_pass');
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    const secret = component.items().find(item => item.clave === 'smtp_pass')!;
    component.guardar(secret);
    expect(service.setConfig).not.toHaveBeenCalled();
  });

  it('saves only the selected key, preserving other drafts and the returned value', () => {
    component.setDraft('smtp_host', 'new.example.test');
    component.setDraft('pago_importe', '300');
    service.setConfig.and.returnValue(of({
      success: true, mantenimiento: false, valor: '300.00'
    }));
    component.guardar(component.items().find(item => item.clave === 'pago_importe')!);
    expect(service.setConfig).toHaveBeenCalledOnceWith('pago_importe', '300');
    expect(component.items().find(item => item.clave === 'pago_importe')?.draft).toBe('300.00');
    expect(component.items().find(item => item.clave === 'smtp_host')?.draft).toBe('new.example.test');
    expect(component.pendingCount()).toBe(1);
    expect(component.successMessage()).toContain('pago_importe');
  });

  it('clears secret drafts after saving and restores ordinary values on discard', () => {
    component.setDraft('smtp_pass', 'replacement-test-value');
    component.guardar(component.items().find(item => item.clave === 'smtp_pass')!);
    const secret = component.items().find(item => item.clave === 'smtp_pass')!;
    expect(service.setConfig).toHaveBeenCalledOnceWith('smtp_pass', 'replacement-test-value');
    expect(secret.draft).toBe('');
    expect(secret.valor).toBe('********');
    component.setDraft('smtp_host', 'changed');
    component.resetItem(component.items().find(item => item.clave === 'smtp_host')!);
    expect(component.pendingCount()).toBe(0);
  });

  it('supports empty ordinary values without trimming text or sending other keys', () => {
    component.setDraft('smtp_host', '');
    component.guardar(component.items().find(item => item.clave === 'smtp_host')!);
    expect(service.setConfig).toHaveBeenCalledOnceWith('smtp_host', '');
    expect(component.items().find(item => item.clave === 'smtp_host')?.valor).toBe('');
  });

  it('prevents duplicate submissions while a save is in flight', () => {
    const response = new Subject<ConfigResponse>();
    service.setConfig.and.returnValue(response);
    component.setDraft('smtp_host', 'new.example.test');
    const item = component.items().find(item => item.clave === 'smtp_host')!;
    component.guardar(item);
    component.guardar(item);
    expect(service.setConfig).toHaveBeenCalledTimes(1);
    expect(component.savingKey()).toBe('smtp_host');
    response.next({ success: true, mantenimiento: false });
    response.complete();
    expect(component.savingKey()).toBeNull();
  });

  it('shows load failures rather than an empty success state and supports retry', () => {
    service.getFullConfig.and.returnValue(throwError(() => new Error('Error de configuración')));
    component.cargarConfiguracion();
    expect(component.errorMessage()).toBe('Error de configuración');
    expect(component.isLoading()).toBeFalse();
    service.getFullConfig.and.returnValue(of(config));
    component.cargarConfiguracion();
    expect(component.errorMessage()).toBeNull();
    expect(component.items().length).toBe(config.length);
  });

  it('preserves drafts on business and HTTP save errors', () => {
    component.setDraft('smtp_host', 'new.example.test');
    const item = component.items().find(item => item.clave === 'smtp_host')!;
    service.setConfig.and.returnValue(of({ success: false, mantenimiento: false, message: 'No guardado' }));
    component.guardar(item);
    expect(component.errorMessage()).toBe('No guardado');
    expect(component.pendingCount()).toBe(1);
    expect(component.successMessage()).toBeNull();
    service.setConfig.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403, error: { message: 'No tienes permisos suficientes.' }
    })));
    component.guardar(item);
    expect(component.errorMessage()).toBe('No tienes permisos suficientes.');
    expect(component.savingKey()).toBeNull();
    expect(component.pendingCount()).toBe(1);
  });
});
