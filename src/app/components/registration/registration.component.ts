import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';
import { RegistrationFormComponent } from './registration-form/registration-form.component';
import { RegistrationActiveSessionComponent } from './registration-active-session/registration-active-session.component';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, RegistrationFormComponent, RegistrationActiveSessionComponent],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.css'
})
export class RegistrationComponent implements OnInit {
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Estado de sesión activa si el usuario retrocede desde /pago
  hasActiveSession = computed(() => this.sessionService.hasSession());
  activeSession = this.sessionService.currentSession;

  ngOnInit(): void {
    // Si se accede a /registro con parámetros de pasarela Redsys (retornos o enlaces previos),
    // redirigir inmediatamente a /pago preservando los queryParams
    this.route.queryParams.subscribe(params => {
      if (params['pago'] || params['id']) {
        this.router.navigate(['/pago'], { queryParams: params });
      }
    });
  }

  continuarAlPago(): void {
    this.router.navigate(['/pago']);
  }

  iniciarNuevoRegistro(): void {
    this.sessionService.clearSession();
  }
}
