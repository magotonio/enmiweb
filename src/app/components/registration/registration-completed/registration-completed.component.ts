import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';
import { PagoService } from '../../../services/pago.service';
import { RegistrationActiveSessionComponent } from '../registration-active-session/registration-active-session.component';

@Component({
  selector: 'app-registration-completed',
  standalone: true,
  imports: [RegistrationActiveSessionComponent],
  templateUrl: './registration-completed.component.html'
})
export class RegistrationCompletedComponent implements OnInit {
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly router = inject(Router);
  private readonly pagoService = inject(PagoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeSession = this.sessionService.currentSession;
  readonly isCheckingStatus = signal(false);
  readonly statusError = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.sessionService.hasSession()) {
      this.router.navigate(['/registro'], { replaceUrl: true });
      return;
    }
    this.actualizarEstado();
  }

  actualizarEstado(): void {
    const session = this.activeSession();
    if (!session || this.isCheckingStatus()) return;

    this.isCheckingStatus.set(true);
    this.statusError.set(null);
    this.pagoService.getPagosByInscripcion(session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.isCheckingStatus.set(false);
          if (this.activeSession()?.id !== session.id) return;
          if (!response.success || !response.estado) {
            this.statusError.set(response.message || 'No se pudo comprobar el estado de tu inscripción.');
            return;
          }
          this.sessionService.updateStatus(response.estado);
        },
        error: () => {
          this.isCheckingStatus.set(false);
          this.statusError.set('No se pudo comprobar el estado de tu inscripción. Vuelve a intentarlo.');
        }
      });
  }

  continuarAlPago(): void {
    if (this.activeSession() && this.activeSession()?.status !== 'pagada' &&
        !this.isCheckingStatus() && !this.statusError()) {
      this.router.navigate(['/pago']);
    }
  }

  iniciarNuevoRegistro(): void {
    this.sessionService.clearSession();
    this.router.navigate(['/registro']);
  }
}
