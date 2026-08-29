import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { maintenanceGuard } from './maintenance.guard';
import { ConfigService } from '../services/config.service';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs';

describe('maintenanceGuard', () => {
  let configService: ConfigService;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    configService = TestBed.inject(ConfigService);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  const runGuard = (url: string): boolean | UrlTree | Observable<boolean | UrlTree> => {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => maintenanceGuard(route, state)) as boolean | UrlTree | Observable<boolean | UrlTree>;
  };

  it('should redirect non-authenticated user to /mantenimiento when maintenance mode is active', (done) => {
    configService.isMaintenanceMode.set(true);
    configService.isLoaded.set(true);
    spyOn(authService, 'isLoggedIn').and.returnValue(false);

    const result = runGuard('/');
    if (result instanceof Observable) {
      result.subscribe(val => {
        expect(val instanceof UrlTree).toBeTrue();
        expect((val as UrlTree).toString()).toBe('/mantenimiento');
        done();
      });
    } else {
      expect(result instanceof UrlTree).toBeTrue();
      expect((result as UrlTree).toString()).toBe('/mantenimiento');
      done();
    }
  });

  it('should allow authenticated user to visit any page when maintenance mode is active', (done) => {
    configService.isMaintenanceMode.set(true);
    configService.isLoaded.set(true);
    spyOn(authService, 'isLoggedIn').and.returnValue(true);

    const result = runGuard('/registro');
    if (result instanceof Observable) {
      result.subscribe(val => {
        expect(val).toBeTrue();
        done();
      });
    } else {
      expect(result).toBeTrue();
      done();
    }
  });

  it('should allow non-authenticated user to visit /login even when maintenance mode is active', (done) => {
    configService.isMaintenanceMode.set(true);
    configService.isLoaded.set(true);
    spyOn(authService, 'isLoggedIn').and.returnValue(false);

    const result = runGuard('/login');
    if (result instanceof Observable) {
      result.subscribe(val => {
        expect(val).toBeTrue();
        done();
      });
    } else {
      expect(result).toBeTrue();
      done();
    }
  });

  it('should redirect /mantenimiento to / when maintenance mode is inactive', (done) => {
    configService.isMaintenanceMode.set(false);
    configService.isLoaded.set(true);

    const result = runGuard('/mantenimiento');
    if (result instanceof Observable) {
      result.subscribe(val => {
        expect(val instanceof UrlTree).toBeTrue();
        expect((val as UrlTree).toString()).toBe('/');
        done();
      });
    } else {
      expect(result instanceof UrlTree).toBeTrue();
      expect((result as UrlTree).toString()).toBe('/');
      done();
    }
  });
});
