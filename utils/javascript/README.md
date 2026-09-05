# Userscript de Autorrelleno para Pruebas (ENMI)

Script para la extensión de navegador **Violentmonkey** (compatible también con Tampermonkey) que autorrellena automáticamente los campos del formulario de inscripción del **Encuentro Nacional de Magos Infantiles (ENMI)** con datos aleatorios válidos.

---

## Archivo
- **Ruta:** [`autofill-inscripcion.user.js`](file:///c:/codigo/otros/enmiweb/utils/javascript/autofill-inscripcion.user.js)

---

## Características
- **100% Limpio (Sin elementos visuales ni tooltips):** No altera en absoluto el DOM de la página ni inyecta botones ni estilos en la interfaz.
- **Atajo de Teclado:**
  - **`Ctrl + Shift + A`**
- **Colección de Nombres y Apellidos:** Banco de nombres y apellidos españoles realistas. Genera 2 apellidos para el formato español habitual.
- **Formato de Email:** Siempre genera correos con la estructura requerida:
  `fvelayos+xxxx@gmail.com`
  donde `xxxx` son 4 caracteres alfanuméricos aleatorios para garantizar unicidad en base de datos.
- **DNI / NIF Válido:** Genera un número de 8 dígitos y calcula su letra oficial según el algoritmo del Ministerio del Interior (`TRWAGMYFPDXBNJZSQVHLCKE`), evitando errores de validación.
- **Teléfono Móvil Realista:** Genera números móviles españoles válidos (`+34 6XXXXXXXX`).
- **Compatibilidad con Angular Reactive Forms:** Dispara los eventos nativos `input` y `change` con propagación (`bubbles: true`) para que los `FormControl` de Angular reconozcan los cambios inmediatamente.
- **Consola de depuración:** Imprime un resumen del registro rellenado en `console.info` para verificar los datos generados.

---

## Instalación en Violentmonkey

1. Abre Violentmonkey en tu navegador.
2. Haz clic en el icono del **+** (Nuevo script).
3. Pega el contenido de [`autofill-inscripcion.user.js`](file:///c:/codigo/otros/enmiweb/utils/javascript/autofill-inscripcion.user.js).
4. Guarda el script (**Ctrl+S** o botón "Guardar y cerrar").
5. Abre la aplicación en `http://localhost:4200/registro`.
6. Pulsa **`Ctrl + Shift + A`** y todos los campos del formulario se completarán al instante.
