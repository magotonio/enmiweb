# 💳 Datos de Prueba para la Pasarela de Pago (Sandbox Redsys)

Este documento contiene los datos de prueba oficiales del entorno **Sandbox / Pruebas** de **Redsys**, así como la información de referencia para verificar todas las modalidades de pago del sistema de inscripción de ENMI 2027.

---

## 1. Tarjetas de Prueba (Redsys Sandbox)

### 🟢 Pago Exitoso (Autorizado)

| Campo | Valor de Prueba |
| :--- | :--- |
| **Número de tarjeta (Visa)** | `4548 8100 0000 0003` |
| **Número de tarjeta (MasterCard)** | `5199 0000 0000 0005` |
| **Fecha de caducidad** | Cualquier fecha futura (ej. `12/28`, `06/29`) |
| **CVV / CVV2** | Cualquier número de 3 dígitos (ej. `123`) |
| **Código SMS / 3D Secure** *(si se solicita)* | `123456` (o cualquier PIN de 4 a 6 dígitos) |

---

### 🔴 Tarjetas para Simular Errores o Denegaciones

Si deseas comprobar el comportamiento de la aplicación y la pantalla de rechazo (`/pago?pago=ko`), puedes emplear estas tarjetas:

| Caso de Prueba | Número de Tarjeta | Código Redsys Esperado |
| :--- | :--- | :--- |
| **Operación Denegada** (Fondos insuficientes) | `4548 8100 0000 0011` | `0101` / `0180` |
| **Tarjeta Caducada** | `4548 8100 0000 0029` | `0104` |
| **Error en Autenticación 3D Secure** | `4548 8100 0000 0045` | `0184` |

### Comprobación del descuento tras un pago fallido

1. Aplica un código de descuento válido y comprueba el total reducido.
2. Inicia el pago en Redsys, provoca una denegación y vuelve a la aplicación desde la pasarela.
3. Comprueba que siguen visibles el cupón y el total reducido, sin introducir de nuevo el código.
4. Reintenta el pago o cambia a una modalidad manual: debe enviarse el mismo código sin consumir otro uso para esa inscripción, incluso si el primer intento consumió el último uso disponible.
5. Quita el descuento y recarga: no debe reaparecer. Tampoco debe trasladarse al registrar otro participante.

El descuento se conserva en la sesión de la pestaña. La notificación de Redsys mantiene los datos del descuento del pedido para que el servidor pueda reutilizarlo en los reintentos.

---

## 2. Configuración del Comercio Sandbox de Redsys

Parámetros estándar utilizados por la pasarela de pruebas de Redsys para este entorno:

- **Entorno:** `sandbox`
- **URL del TPV Virtual:** `https://sis-t.redsys.es:25443/sis/realizarPago`
- **Código de Comercio (FUC):** `999008881`
- **Terminal:** `1` (se envía formateado como `001`)
- **Moneda:** `978` (Euro)
- **Clave Secreta HMAC SHA-256 oficial:** `sq7HjrUOBfKmC576ILgskD5srU870gJ7`
- **Tipo de Firma:** `HMAC_SHA256_V1`

---

## 3. Modalidades de Pago Manuales y Simulador

Además de la pasarela oficial Redsys, la aplicación permite:

1. **Bizum**:
   - Teléfono configurado en administración (por defecto: `+34 600 000 000`).
   - Deja la inscripción en estado `pendiente`.
2. **Transferencia Bancaria**:
   - IBAN bancario y titular definidos en administración.
   - Concepto dinámico generado: `ENMI-2027-{ID}-{APELLIDOS}`.
   - Deja la inscripción en estado `pendiente`.
3. **Otras Modalidades**:
   - Para acuerdos personalizados (pago en acreditación, fraccionado, etc.).
   - Deja la inscripción en estado `pendiente`.
4. **Simulador Redsys (Demo Pago)**:
   - Botón directo en pantalla de pago (solo activo si `demo_pago = 1` en administración) que permite simular la respuesta `OK` o `KO` de forma inmediata sin necesidad de salir a la web de Redsys.

### Intenciones de pago frente a cobros reales

- Elegir Bizum, transferencia u otras modalidades crea una **intención de pago del participante**, con estado `no-pagado`. No acredita un cobro ni incrementa el total abonado.
- El cobro manual posterior crea un registro independiente identificado como **pago registrado por administración / supervisor**, conservando su auditoría y la intención de pago original.
- La tarjeta solo cuenta como abonada cuando Redsys valida el pago. Los intentos fallidos o pendientes no suman.
- Las simulaciones conservan el comportamiento demo de la inscripción, pero se identifican como simulaciones y no suman al total de cobros reales.
- Los registros existentes se clasifican a partir de sus datos de auditoría y referencias; no se necesita migración. Un registro de origen desconocido se muestra como tal y no acredita un cobro.

Comprobación: seleccionar transferencia por 250 €, abrir la ficha y verificar una intención de pago con total abonado de 0 €. Registrar después un cobro manual de 250 €: deben aparecer ambos registros diferenciados, con un total abonado de 250 €, no 500 €. Un cobro parcial de 100 € debe sumar solo 100 €.
