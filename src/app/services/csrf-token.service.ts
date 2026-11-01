import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CsrfTokenService {
  private readonly value = signal<string | null>(null);

  get token(): string | null {
    return this.value();
  }

  setToken(token: string | null): void {
    this.value.set(token);
  }
}