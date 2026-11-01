import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { CsrfTokenService } from '../services/csrf-token.service';

export const apiSecurityInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiUrl)) {
    return next(request);
  }

  const csrfToken = inject(CsrfTokenService).token;
  const headers = csrfToken ? request.headers.set('X-CSRF-Token', csrfToken) : request.headers;
  return next(request.clone({ withCredentials: true, headers }));
};