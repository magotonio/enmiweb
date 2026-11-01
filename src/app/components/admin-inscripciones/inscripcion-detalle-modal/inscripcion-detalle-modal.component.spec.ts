import { Injector, runInInjectionContext, signal } from '@angular/core';
import { InscripcionDetalleModalComponent } from './inscripcion-detalle-modal.component';
import { PagoRegistro } from '../../../models/inscripcion.model';
import { PagoService } from '../../../services/pago.service';
import { InscripcionService } from '../../../services/inscripcion.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmService } from '../../../services/confirm.service';

describe('InscripcionDetalleModalComponent: pagos e intenciones de pago', () => {
  let component: InscripcionDetalleModalComponent;

  const registro = (tipo: PagoRegistro['tipo_registro'], confirmado: boolean, cantidad = 250): PagoRegistro => ({
    id: 1,
    inscripcion_id: 42,
    referencia: 'ENMI-TEST',
    cantidad_pagada: cantidad,
    modalidad_pago: tipo === 'redsys' ? 'redsys' : 'transferencia',
    estado: confirmado || tipo === 'simulacion' ? 'pagado' : 'no-pagado',
    tipo_registro: tipo,
    pago_confirmado: confirmado,
    fecha_creacion: '2026-11-01 10:00:00'
  });

  beforeEach(() => {
    const injector = Injector.create({
      providers: [
        { provide: PagoService, useValue: {} },
        { provide: InscripcionService, useValue: {} },
        { provide: ConfirmService, useValue: {} },
        { provide: AuthService, useValue: { isSupervisor: signal(true), isSuperAdmin: signal(false) } }
      ]
    });
    component = runInInjectionContext(injector, () => new InscripcionDetalleModalComponent());
  });

  it('no suma una intención de pago como dinero abonado', () => {
    component.pagos.set([registro('promesa', false)]);
    expect(component.getTotalPagado()).toBe(0);
    expect(component.getTipoRegistroLabel(component.pagos()[0])).toBe('Intención de pago del participante');
  });

  it('conserva intención de pago y cobro sin duplicar el total', () => {
    component.pagos.set([registro('promesa', false), registro('manual_administracion', true)]);
    expect(component.pagos().length).toBe(2);
    expect(component.getTotalPagado()).toBe(250);
    expect(component.getTipoRegistroLabel(component.pagos()[1])).toContain('supervisor');
  });

  it('calcula el saldo a partir del cobro parcial, no de la intención de pago', () => {
    component.tarifaInscripcion.set(250);
    component.pagos.set([registro('promesa', false), registro('manual_administracion', true, 100)]);
    expect(component.getTotalPagado()).toBe(100);
    component.abrirFormPagoManual();
    expect(component.cantidadPagoManual()).toBe(150);
  });

  it('suma tarjeta validada pero excluye intentos, simulaciones y registros desconocidos', () => {
    component.pagos.set([
      registro('redsys', true),
      registro('redsys', false),
      registro('simulacion', false),
      registro('desconocido', false)
    ]);
    expect(component.getTotalPagado()).toBe(250);
    expect(component.getTipoRegistroLabel(component.pagos()[0])).toContain('validado');
    expect(component.getTipoRegistroLabel(component.pagos()[1])).toContain('Intento');
    expect(component.getTipoRegistroLabel(component.pagos()[2])).toContain('no es un cobro real');
  });
});
