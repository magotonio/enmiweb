import { InscripcionSessionService } from './inscripcion-session.service';
import { DescuentoTokenInfo, InscripcionSessionData } from '../models/inscripcion.model';

describe('InscripcionSessionService discount persistence', () => {
  const session: InscripcionSessionData = {
    id: 42, fullName: 'Participante', apellidos: 'Prueba',
    email: '', telefono: '', status: 'iniciada'
  };
  const descuento: DescuentoTokenInfo = {
    valido: true, token_id: 5, token: 'MAGIA50', descuento: 50,
    descuento_str: '50.00', precio_original: 250, nuevo_total: 200,
    nuevo_total_str: '200.00', usos_restantes: 1
  };
  let service: InscripcionSessionService;

  beforeEach(() => {
    service = new InscripcionSessionService();
    service.clearSession();
    service.saveSession(session);
  });

  afterEach(() => service.clearSession());

  it('should persist the discount through status changes and a full reload', () => {
    service.updateDescuento(descuento);
    service.updateModalidad('redsys');
    service.updateStatus('pendiente', 'redsys');

    const restored = new InscripcionSessionService().getSession();
    expect(restored?.descuento).toEqual(descuento);
    expect(restored?.status).toBe('pendiente');
    expect(restored?.modalidad).toBe('redsys');
  });

  it('should not restore a removed discount', () => {
    service.updateDescuento(descuento);
    service.updateDescuento(null);
    expect(new InscripcionSessionService().getSession()?.descuento).toBeNull();
  });

  it('should not carry the discount to another enrollment', () => {
    service.updateDescuento(descuento);
    service.clearSession();
    expect(new InscripcionSessionService().getSession()).toBeNull();
    service.saveSession({ ...session, id: 43 });
    expect(new InscripcionSessionService().getSession()?.descuento).toBeUndefined();
  });
});
