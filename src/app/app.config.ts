import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withComponentInputBinding } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { AuthService } from './services/auth.service';
import { apiSecurityInterceptor } from './interceptors/api-security.interceptor';

// Registrar locale en español para formateo de fechas y números
registerLocaleData(localeEs, 'es');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch(), withInterceptors([apiSecurityInterceptor])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
    ),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      return configService.checkMaintenance();
    }),
    provideAppInitializer(() => inject(AuthService).verifySession()),
    { provide: LOCALE_ID, useValue: 'es' }
  ]
};
