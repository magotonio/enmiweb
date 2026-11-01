import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { InscripcionSessionService } from '../../../services/inscripcion-session.service';
import { InscripcionSessionData } from '../../../models/inscripcion.model';

@Component({
  selector: 'app-registration-active-session',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './registration-active-session.component.html',
  styleUrl: './registration-active-session.component.css'
})
export class RegistrationActiveSessionComponent {
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly router = inject(Router);

  private readonly customSession = signal<InscripcionSessionData | null | undefined>(undefined);

  @Input()
  set session(value: InscripcionSessionData | null | undefined) {
    this.customSession.set(value);
  }

  @Output() continuePayment = new EventEmitter<void>();
  @Output() newRegistration = new EventEmitter<void>();

  readonly activeSession = computed(() => {
    const custom = this.customSession();
    return custom !== undefined ? custom : this.sessionService.currentSession();
  });

  continuarAlPago(): void {
    if (this.activeSession()?.status === 'pagada') return;

    if (this.continuePayment.observed) {
      this.continuePayment.emit();
    } else {
      this.router.navigate(['/pago']);
    }
  }

  iniciarNuevoRegistro(): void {
    if (this.newRegistration.observed) {
      this.newRegistration.emit();
    } else {
      this.sessionService.clearSession();
    }
  }
}
