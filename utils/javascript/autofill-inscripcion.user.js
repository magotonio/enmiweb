// ==UserScript==
// @name         ENMI 2027 - Autorrellenar Formulario de Inscripción
// @namespace    https://enmi.eutikea.com
// @version      1.1.0
// @description  Autorrellena datos de prueba aleatorios en el formulario de inscripción de ENMI mediante atajo de teclado Ctrl+Shift+A (sin elementos visuales).
// @author       Felipe Velayos
// @match        *://*.enmi.es/*
// @match        *://enmi.es/*
// @include      http://localhost:*/*
// @include      https://localhost:*/*
// @include      http://localhost/*
// @include      https://localhost/*
// @include      http://127.0.0.1:*/*
// @include      https://127.0.0.1:*/*
// @include      http://127.0.0.1/*
// @include      https://127.0.0.1/*
// @include      https://enmi.eutikea.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // =========================================================================
  // BANCO DE DATOS ALEATORIOS
  // =========================================================================

  const NOMBRES = [
    'Alejandro', 'Álvaro', 'Beatriz', 'Carlos', 'Carmen', 'Daniel', 'David',
    'Elena', 'Félix', 'Fernando', 'Gonzalo', 'Guillermo', 'Hugo', 'Ignacio',
    'Irene', 'Javier', 'Jorge', 'Laura', 'Lucía', 'Manuel', 'Marcos', 'Marta',
    'Mateo', 'Miguel', 'Nerea', 'Pablo', 'Paula', 'Raquel', 'Rodrigo', 'Sara',
    'Sergio', 'Sofía', 'Víctor'
  ];

  const APELLIDOS = [
    'García', 'González', 'Rodríguez', 'Fernández', 'López', 'Martínez',
    'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández',
    'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
    'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez',
    'Serrano', 'Blanco', 'Molina', 'Morales', 'Suárez', 'Ortega', 'Delgado',
    'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Núñez', 'Iglesias', 'Medina',
    'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto'
  ];

  const ASOCIACIONES = [
    'Sociedad Española de Ilusionismo (SEI)',
    'Círculo de Ilusionistas de Madrid (CIM)',
    'Asociación de Magos Profesionales',
    'Círculo Mágico de Segovia',
    'Club Mágico de Barcelona (AMIC)',
    'Hermandad Mágica Española',
    'Club Ilusionistas del Norte'
  ];

  const LOCALIDADES = [
    'Madrid, España', 'Segovia, Castilla y León', 'Barcelona, Cataluña',
    'Valencia, Comunidad Valenciana', 'Sevilla, Andalucía', 'Bilbao, País Vasco',
    'Zaragoza, Aragón', 'Valladolid, Castilla y León', 'Málaga, Andalucía',
    'Toledo, Castilla-La Mancha', 'Salamanca, Castilla y León'
  ];

  const COMENTARIOS = [
    'Prueba de inscripción automatizada.',
    'Menú sin gluten y sin lactosa si es posible.',
    'Participante con interés en actuar en la gala infantil.',
    'Necesito acceso para material de escena voluminoso.',
    'Acompañado por 1 adulto como asistente de escena.',
    ''
  ];

  // =========================================================================
  // GENERADORES DE DATOS
  // =========================================================================

  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /**
   * Genera sufijo aleatorio alfanumérico para el correo (4 caracteres)
   * Formato requerido: fvelayos+xxxx@gmail.com
   */
  function generarEmailAleatorio() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let xxxx = '';
    for (let i = 0; i < 4; i++) {
      xxxx += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `fvelayos+${xxxx}@gmail.com`;
  }

  /**
   * Genera un DNI español válido (8 dígitos + letra de control oficial)
   * para evitar fallos de checksum y colisiones de clave única
   */
  function generarDniValido() {
    const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const numero = Math.floor(10000000 + Math.random() * 90000000);
    const letra = letras[numero % 23];
    return `${numero}${letra}`;
  }

  /**
   * Genera un número de teléfono móvil español válido (6XXXXXXXX)
   */
  function generarTelefonoAleatorio() {
    const ultimos8 = Math.floor(10000000 + Math.random() * 90000000);
    return `+34 6${ultimos8}`;
  }

  // =========================================================================
  // ACTUALIZACIÓN COMPATIBLE CON ANGULAR REACTIVE FORMS
  // =========================================================================

  /**
   * En Angular ReactiveForms, actualizar .value no es suficiente:
   * se deben disparar eventos 'input' y 'change' con bubbles: true.
   */
  function setNativeInputValue(selectorOrEl, value) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) return false;

    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.blur();
    return true;
  }

  function setNativeCheckboxValue(selectorOrEl, checked) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) return false;

    el.checked = checked;
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    return true;
  }

  // =========================================================================
  // ACCIÓN PRINCIPAL DE AUTORRELLENADO
  // =========================================================================

  function rellenarFormularioInscripcion() {
    // Comprobar que existe el campo nombre del formulario de inscripción
    const inputNombre = document.querySelector('#nombre');
    if (!inputNombre) {
      console.warn('[ENMI Autofill] No se detectó el formulario de inscripción en esta página.');
      return;
    }

    const nombre = getRandomItem(NOMBRES);
    const apellido1 = getRandomItem(APELLIDOS);
    let apellido2 = getRandomItem(APELLIDOS);
    while (apellido2 === apellido1) {
      apellido2 = getRandomItem(APELLIDOS);
    }
    const apellidos = `${apellido1} ${apellido2}`;

    const nombreArtistico = Math.random() > 0.3 ? `Mago ${nombre}` : '';
    const nif = generarDniValido();
    const email = generarEmailAleatorio();
    const telefono = generarTelefonoAleatorio();
    const origen = getRandomItem(LOCALIDADES);
    const asociacion = Math.random() > 0.4 ? getRandomItem(ASOCIACIONES) : '';
    const quieroParticipar = Math.random() > 0.5;
    const comentario = getRandomItem(COMENTARIOS);

    // Asignar campos de texto
    setNativeInputValue('#nombre', nombre);
    setNativeInputValue('#apellidos', apellidos);
    setNativeInputValue('#nombre_artistico', nombreArtistico);
    setNativeInputValue('#nif_pasaporte', nif);
    setNativeInputValue('#email', email);
    setNativeInputValue('#telefono', telefono);
    setNativeInputValue('#origen', origen);
    setNativeInputValue('#asociacion', asociacion);
    setNativeInputValue('#comentarios', comentario);

    // Asignar checkboxes obligatorios y opcionales
    setNativeCheckboxValue('#quiero_participar', quieroParticipar);
    setNativeCheckboxValue('#acepta_privacidad', true); // Obligatorio por RGPD
    setNativeCheckboxValue('#consentimiento_imagen', true);

    console.info('[ENMI Autofill] Formulario rellenado con éxito:', {
      nombre,
      apellidos,
      email,
      nif,
      telefono,
      origen
    });
  }

  // =========================================================================
  // ATAJO DE TECLADO: Ctrl + Shift + A
  // =========================================================================

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
      e.preventDefault();
      rellenarFormularioInscripcion();
    }
  }, true);

})();
