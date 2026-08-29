import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MantenimientoComponent } from './mantenimiento.component';
import { ConfigService } from '../../services/config.service';

describe('MantenimientoComponent', () => {
  let component: MantenimientoComponent;
  let fixture: ComponentFixture<MantenimientoComponent>;
  let configService: ConfigService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MantenimientoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    configService = TestBed.inject(ConfigService);
    configService.isMaintenanceMode.set(true);
    configService.isLoaded.set(true);

    fixture = TestBed.createComponent(MantenimientoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the maintenance component', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial state for checking as false', () => {
    expect(component.isChecking()).toBeFalse();
  });
});
