import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InscripcionSessionService } from '../../services/inscripcion-session.service';
import { RegistrationFormComponent } from './registration-form/registration-form.component';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [RegistrationFormComponent],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.css'
})
export class RegistrationComponent implements OnInit {
  private readonly sessionService = inject(InscripcionSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Si se accede a /registro con parámetros de pasarela Redsys (retornos o enlaces previos),
    // redirigir inmediatamente a /pago preservando los queryParams
    this.route.queryParams.subscribe(params => {
      if (params['pago'] || params['id']) {
        this.router.navigate(['/pago'], { queryParams: params });
      } else if (this.sessionService.hasSession()) {
        this.router.navigate(['/registro/completado'], { replaceUrl: true });
      }
    });
  }
}
