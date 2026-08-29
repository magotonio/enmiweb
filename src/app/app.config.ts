import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withComponentInputBinding } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { routes } from './app.routes';
import { ConfigService } from './services/config.service';

// Registrar locale en español para formateo de fechas y números
registerLocaleData(localeEs, 'es');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
    ),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      return configService.checkMaintenance();
    }),
    { provide: LOCALE_ID, useValue: 'es' }
  ]
};
