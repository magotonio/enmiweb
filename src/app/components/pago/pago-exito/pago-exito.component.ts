import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';
import { PagoService } from '../../../services/pago.service';
import { PagoConfigInfo } from '../../../models/inscripcion.model';

@Component({
  selector: 'app-pago-exito',
  standalone: true,
  templateUrl: './pago-exito.component.html'
})
export class PagoExitoComponent implements OnInit {
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly pagoService = inject(PagoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sessionData = this.sessionService.currentSession;
  readonly registeredId = computed(() => this.sessionData()?.id);
  readonly registeredFullName = computed(() => this.sessionData()?.fullName);
  readonly registeredArtistName = computed(() => this.sessionData()?.artistName);
  readonly registeredEmail = computed(() => this.sessionData()?.email);
  readonly registeredStatus = computed(() => this.sessionData()?.status);
  readonly selectedModalidad = computed(() => this.sessionData()?.modalidad);
  readonly pagoConfig = signal<PagoConfigInfo | null>(null);
  readonly configError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPagoConfig();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  loadPagoConfig(): void {
    this.configError.set(null);
    this.pagoService.getPagoConfig().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: config => {
        if (!config.success) {
          this.configError.set(config.message || 'No se pudo cargar la cuota de inscripción.');
          return;
        }
        this.pagoConfig.set(config);
      },
      error: () => this.configError.set('No se pudo cargar la cuota de inscripción. Vuelve a intentarlo.')
    });
  }
}
