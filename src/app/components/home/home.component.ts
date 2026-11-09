import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  highlights = [
    {
      icon: 'sparkles',
      title: 'Conferencias Inspiradoras',
      description: 'Ponencias magistrales y testimonios que marcarán un antes y un después en tu camino.'
    },
    {
      icon: 'users',
      title: 'Comunidad y Red',
      description: 'Espacios dinámicos para conocer, compartir y tejer lazos duraderos con participantes de todo el país.'
    },
    {
      icon: 'academic',
      title: 'Talleres Prácticos',
      description: 'Sesiones formativas con herramientas aplicables a tu desarrollo personal y comunitario.'
    },
    {
      icon: 'map-pin',
      title: 'Sede en Madrid',
      description: 'Una sede vibrante con la mejor oferta cultural, accesibilidad e instalaciones de primer nivel.'
    }
  ];
}
