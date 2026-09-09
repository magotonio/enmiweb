import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (state().isOpen) {
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmDialogTitle"
      (click)="onBackdropClick()">

      <div
        class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
        (click)="$event.stopPropagation()">

        <!-- Cabecera: Icono y Título -->
        <div class="flex items-center gap-3">
          @if (state().tipo === 'danger') {
          <div class="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          } @else if (state().tipo === 'success') {
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          } @else if (state().tipo === 'info') {
          <div class="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </div>
          } @else {
          <!-- warning (por defecto) -->
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          }

          <h3 id="confirmDialogTitle" class="text-lg font-bold text-slate-900 leading-snug">
            {{ state().titulo }}
          </h3>
        </div>

        <!-- Cuerpo del Mensaje -->
        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
          {{ state().mensaje || state().cuerpo }}
        </p>

        <!-- Botones de Acción -->
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            (click)="cancelar()"
            class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200">
            {{ state().textoCancelar }}
          </button>

          <button
            type="button"
            (click)="aceptar()"
            class="px-5 py-2 text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
            [class.bg-red-600]="state().tipo === 'danger'"
            [class.hover:bg-red-700]="state().tipo === 'danger'"
            [class.text-white]="state().tipo === 'danger'"
            [class.bg-emerald-600]="state().tipo === 'success'"
            [class.hover:bg-emerald-700]="state().tipo === 'success'"
            [class.text-white]="state().tipo === 'success'"
            [class.bg-amber-500]="state().tipo === 'warning'"
            [class.hover:bg-amber-600]="state().tipo === 'warning'"
            [class.text-white]="state().tipo === 'warning'"
            [class.bg-slate-900]="state().tipo === 'info' || !state().tipo"
            [class.hover:bg-slate-800]="state().tipo === 'info' || !state().tipo"
            [class.text-white]="state().tipo === 'info' || !state().tipo">
            {{ state().textoAceptar }}
          </button>
        </div>

      </div>
    </div>
    }
  `
})
export class ConfirmDialogComponent {
  private readonly confirmService = inject(ConfirmService);
  readonly state = this.confirmService.state;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state().isOpen) {
      this.cancelar();
    }
  }

  onBackdropClick(): void {
    this.cancelar();
  }

  aceptar(): void {
    this.confirmService.aceptar();
  }

  cancelar(): void {
    this.confirmService.cancelar();
  }
}
