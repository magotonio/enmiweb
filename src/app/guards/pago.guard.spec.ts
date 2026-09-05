import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { pagoGuard } from './pago.guard';
import { InscripcionSessionService } from '../services/inscripcion-session.service';

describe('pagoGuard', () => {
  let mockSessionService: jasmine.SpyObj<InscripcionSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockSessionService = jasmine.createSpyObj('InscripcionSessionService', ['hasSession']);
    mockRouter = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: InscripcionSessionService, useValue: mockSessionService },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  const executeGuard = (queryParams: Record<string, string> = {}) => {
    const route = { queryParams } as unknown as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => pagoGuard(route, state));
  };

  it('should allow access when user has an active registration in session', () => {
    mockSessionService.hasSession.and.returnValue(true);

    const result = executeGuard();

    expect(result).toBeTrue();
  });

  it('should allow access when returning from Redsys with valid pago and id query params', () => {
    mockSessionService.hasSession.and.returnValue(false);

    const result = executeGuard({ pago: 'ok', id: '15' });

    expect(result).toBeTrue();
  });

  it('should redirect to /registro when neither session nor valid Redsys params exist', () => {
    mockSessionService.hasSession.and.returnValue(false);
    const mockUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(mockUrlTree);

    const result = executeGuard({});

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/registro']);
    expect(result).toBe(mockUrlTree);
  });
});
