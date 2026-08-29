# Especificaciones del Proyecto: Formulario de Inscripción

Documento de especificaciones funcionales y técnicas del sistema de inscripción. Este archivo se mantendrá actualizado a medida que se incorporen nuevos campos, reglas de negocio o integraciones.

---

## 1. Visión General
Aplicación web moderna, accesible y modular construida con **Angular 21** conectada a un backend ligero en **PHP 8** y base de datos **MariaDB**, diseñada para la captación y registro de participantes con persistencia de datos segura, así como un panel de administración exclusivo para la consulta, filtrado, auditoría y exportación de registros de asistentes.

---

## 2. Estructura de Archivos
```text
├── docker-compose.yml                           # Orquestación de entorno local (MariaDB + PHP + phpMyAdmin)
├── docker/                                      # Recursos de contenedor Docker
│   └── php/
│       └── Dockerfile                           # Imagen PHP 8.2 con Apache y extensiones PDO MySQL
├── proxy.conf.json                              # Configuración de proxy Angular para desarrollo
├── angular.json                                 # Configuración del espacio de trabajo Angular
├── package.json                                 # Dependencias y scripts de ejecución/compilación
├── tsconfig.json / tsconfig.app.json            # Configuración de compilación TypeScript
├── ESPECIFICACIONES.md                          # Documento vivo de especificaciones del proyecto
├── api/                                         # Backend / API REST en PHP (desplegable en hosting)
│   ├── config.php                               # Conexión PDO a MariaDB y utilidades de respuesta JSON
│   ├── config.env.local.php                     # Configuración de entorno de desarrollo (LOCAL)
│   ├── config.env.pro.php                       # Plantilla de entorno de producción (PRO)
│   ├── configuracion.php                        # Endpoint REST para consulta y gestión de configuración / mantenimiento
│   ├── logger.php                               # Servicio centralizado de registro de logs y auditoría
│   ├── mailer.php                               # Servicio SMTP nativo y plantillas de notificación por correo
│   ├── inscribir.php                            # Endpoint POST para registrar inscripciones y disparar alertas
│   ├── inscripciones.php                        # Endpoint GET para listar y auditar inscripciones con estadísticas
│   ├── login.php                                # Endpoint POST para autenticación de administradores
│   ├── logs.php                                 # Endpoint GET para consulta y filtrado de auditoría del sistema
│   ├── usuarios.php                             # Endpoint CRUD para gestión de usuarios, roles y bloqueos
│   └── test_db.php                              # Endpoint de diagnóstico y salud de la base de datos
├── public/                                      # Activos estáticos públicos (favicon, etc.)
├── src/                                         # Código fuente de la aplicación Angular
│   ├── index.html                               # Plantilla HTML raíz
│   ├── main.ts                                  # Punto de entrada de la aplicación
│   ├── styles.css                               # Sistema de diseño, variables CSS y estilos globales
│   └── app/
│       ├── app.config.ts                        # Proveedores globales (HttpClient, Locale 'es', AppInitializer)
│       ├── app.routes.ts                        # Rutas de la aplicación con guards de autenticación y mantenimiento
│       ├── app.component.ts/.html/.css          # Componente principal contenedor
│       ├── models/
│       │   ├── configuracion.model.ts           # Interfaces TypeScript (parámetros de configuración del sistema)
│       │   ├── inscripcion.model.ts             # Interfaces TypeScript (inscripciones, respuestas y filtros)
│       │   └── usuario.model.ts                 # Interfaces TypeScript (usuarios, login, credenciales)
│       ├── services/
│       │   ├── auth.service.ts                  # Servicio de autenticación y gestión de sesión
│       │   ├── config.service.ts                # Servicio reactivo de configuración y modo mantenimiento
│       │   ├── inscripcion.service.ts           # Servicio HTTP para registro, consulta y exportación CSV
│       │   ├── logs.service.ts                  # Servicio HTTP para consulta y auditoría de eventos
│       │   └── usuario.service.ts               # Servicio HTTP para gestión de usuarios y credenciales
│       ├── guards/
│       │   ├── auth.guard.ts                    # Guard funcional para proteger rutas administrativas
│       │   ├── maintenance.guard.ts             # Guard funcional para control y redirección en modo mantenimiento
│       │   └── role.guard.ts                    # Guard funcional de control de acceso por roles (RBAC)
│       └── components/
│           ├── navbar/                          # Barra superior con banner de mantenimiento y menú staff
│           ├── footer/                          # Pie de página institucional
│           ├── home/                            # Portada y presentación del encuentro
│           ├── login/                           # Formulario de acceso de administradores
│           ├── mantenimiento/                   # Página pública de estado de mantenimiento
│           ├── registration-form/               # Formulario de inscripción pública
│           ├── admin-dashboard/                 # Panel general de administración con control de mantenimiento
│           ├── admin-inscripciones/             # Panel de revisión, búsqueda y exportación de inscritos
│           ├── admin-usuarios/                  # Panel de gestión de usuarios y roles
│           ├── admin-logs/                      # Panel de auditoría de logs del sistema
│           ├── panel-asistente/                 # Espacio personal de consulta para asistentes
│           ├── asistente-ficha/                 # Ficha completa de datos del asistente
│           └── acceso-denegado/                 # Vista de advertencia por privilegios insuficientes
└── db/                                          # Gestión de base de datos y versiones
    ├── schema.sql                               # Esquema completo consolidado actual (MariaDB)
    └── migrations/                              # Scripts incrementales versionados
        ├── 001_create_enmi_inscripciones.sql
        ├── 002_create_enmi_usuarios.sql
        ├── 003_create_enmi_recuperacion_passwords.sql
        ├── 004_create_enmi_logs.sql
        ├── 005_add_fields_to_enmi_inscripciones.sql
        ├── 006_add_intentos_fallidos_to_enmi_usuarios.sql
        ├── 007_add_rol_to_enmi_usuarios.sql
        └── 008_create_enmi_configuracion.sql
```

---

## 3. Stack Tecnológico e Infraestructura
- **Frontend**:
  - **Framework**: **Angular 21** (Standalone Components, Signals, Control Flow moderno `@if`/`@else`/`@for`).
  - **Seguridad**: Guards funcionales `CanActivateFn` con redirección inteligente y memoria de URL previa.
  - **Formularios**: **Reactive Forms** (`ReactiveFormsModule`, `FormBuilder`, `Validators`).
  - **Comunicación HTTP**: `@angular/common/http` (`provideHttpClient(withFetch())`).
  - **Lenguaje**: **TypeScript 5.9+** (Modo estricto).
  - **Estilos**: **Tailwind CSS v4** (`@tailwindcss/postcss`, clases de utilidad modernas, diseño responsive, microinteracciones y estados dinámicos).
  - **Internacionalización**: Locale nativo `es` (`registerLocaleData(localeEs, 'es')`) para formateo con `DatePipe`.
  - **Tipografía**: *Plus Jakarta Sans* (Google Fonts).
  - **Accesibilidad**: Atributos `aria-*`, alertas `role="alert"`, modales `role="dialog"`, navegación completa por teclado.
- **Backend**:
  - **Tabla de Configuración Dinámica de la Web (`enmi_configuracion`)**: Almacén centralizado de parámetros clave-valor de texto (`clave`, `valor`, `descripcion`, timestamps) en MariaDB. Gestiona de forma dinámica el estado de mantenimiento (`mantenimiento = "1"`) y todos los parámetros de transporte y buzón SMTP (`smtp_host`, `smtp_port`, `smtp_secure`, `smtp_auth`, `smtp_user`, `smtp_pass`, `smtp_from_email`, `smtp_from_name`, `notification_emails` separados por comas), con caché en memoria por ciclo de petición (`getDbConfig()`, `getConfigValue()`, `isMaintenanceMode()`, `getSmtpConfig()`, `getNotificationEmails()`).
  - **Servicio de Logs, Auditoría y Niveles (`api/logger.php`)**: Filtrado inteligente por severidad (`LOG_LEVEL`: `DEBUG` [100], `INFO` [200], `NOTICE` [250], `WARNING` [300], `ERROR` [400], `CRITICAL` [500]) con descarte automático de eventos menores al umbral y captura de contexto, IP, User-Agent y origen.
  - **Manejo Global de Errores en API (`api/config.php`)**: Capturador de excepciones (`set_exception_handler`), errores de runtime (`set_error_handler`) y errores fatales (`register_shutdown_function`) con registro en `enmi_logs` y respuestas JSON 500 normalizadas con detalle de depuración condicional (`SHOW_ERROR_DETAILS`).
  - **Servicio de Email y Notificaciones (`api/mailer.php`)**: Conexión nativa PHP 8.2+ con soporte SSL (puerto 465) y STARTTLS (puerto 587), cargando parámetros dinámicamente desde `enmi_configuracion` con soporte de múltiples destinatarios en `notification_emails`.
  - **Formato de Comunicación**: JSON REST con cabeceras CORS y códigos de estado HTTP estándar (200, 201, 400, 401, 403, 405, 500).
- **Infraestructura, Entornos y URLs**:
  - **Entorno Local (Desarrollo)**:
    - URL Frontend: `http://localhost:4200` (`APP_URL` en `config.env.local.php` / `environment.development.ts`).
    - **Docker Compose** con 3 servicios:
      - `api`: PHP 8.2 Apache en `http://localhost:8000`.
      - `db`: MariaDB 10.11 en `localhost:3306` (inicializado automáticamente con `db/schema.sql`).
      - `phpmyadmin`: Administrador visual de BD en `http://localhost:8080`.
  - **Producción (Hosting Privado / Dinahosting)**:
    - URL Frontend: `https://enmi.eutikea.com` (`APP_URL` en `config.env.pro.php` / `environment.ts`).
    - Despliegue de los archivos de `dist/enmi/browser/` en la raíz pública del dominio (`https://enmi.eutikea.com`).
    - Despliegue de la carpeta `api/` en el hosting PHP.
    - Base de datos MariaDB compartida.
  - **Convención de Tablas**: **Todas las tablas de este proyecto deben comenzar obligatoriamente con el prefijo `enmi_`**.

---

## 4. Comandos de Desarrollo y Despliegue

### 4.1. Flujo de Desarrollo Local (Docker + Angular)

1. **Levantar los servicios de Backend y Base de Datos con Docker**:
   ```bash
   docker compose up -d
   ```
   - API PHP: `http://localhost:8000/api/test_db.php`
   - phpMyAdmin: `http://localhost:8080` (Usuario: `root`, Contraseña: `rootpassword` o Usuario: `enmi_user`, Contraseña: `enmi_password`)
   - MariaDB: puerto local `3306`

2. **Iniciar la aplicación Angular**:
   ```bash
   npm start
   ```
   La aplicación estará disponible en `http://localhost:4200/` y redirigirá automáticamente cualquier petición a `/api/*` al contenedor PHP en el puerto 8000 mediante `proxy.conf.json`.

3. **Detener el entorno Docker**:
   ```bash
   docker compose down
   ```

### 4.2. Compilación y Despliegue a Producción (Dinahosting)

- **Compilar el frontend Angular**:
  ```bash
  npm run build
  ```
  Los archivos estáticos optimizados se generarán en `dist/enmi/browser/`.

- **Subir a Dinahosting**:
  1. Copiar el contenido de `dist/enmi/browser/` a la raíz web de tu alojamiento (ej. `public_html/` o `httpdocs/`).
  2. Copiar la carpeta `api/` a la raíz web (quedando accesible como `https://tudominio.com/api/inscribir.php`).
  3. En `api/config.php`, ajustar las credenciales de MariaDB proporcionadas por Dinahosting si no se configuran por variables de entorno.
  4. Importar `db/schema.sql` en el phpMyAdmin del panel de Dinahosting.

---

## 5. Endpoints de la API REST (`api/`)

### `POST /api/inscribir.php`
Registra una nueva inscripción en la base de datos `enmi_inscripciones`.

- **Cabeceras**: `Content-Type: application/json`
- **Cuerpo (JSON)**:
  ```json
  {
    "nombre": "Elena",
    "apellidos": "Navarro Sánchez",
    "nombre_artistico": "Magic Elena",
    "nif_pasaporte": "12345678Z",
    "email": "elena@magia.es",
    "telefono": "+34 600 123 456",
    "origen": "Segovia, España",
    "asociacion": "Círculo Mágico Segoviano",
    "quiero_participar": true,
    "acepta_privacidad": true,
    "consentimiento_imagen": true,
    "comentarios": "Disponible para gala infantil de cerca."
  }
  ```
- **Respuesta de Éxito (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "message": "Inscripción guardada correctamente.",
    "id": 1,
    "data": {
      "nombre": "Elena",
      "apellidos": "Navarro Sánchez",
      "nombre_artistico": "Magic Elena",
      "email": "elena@magia.es",
      "quiero_participar": true
    },
    "notificacion": {
      "enviada": true,
      "mensaje": "Correo enviado exitosamente vía SMTP."
    }
  }
  ```

### `GET /api/inscripciones.php`
Consulta y recupera el listado completo de participantes inscritos con estadísticas agregadas y parámetros opcionales de búsqueda y ordenación.

- **Parámetros URL Opcionales**:
  - `q`: Búsqueda textual por nombre, apellidos, nombre artístico, email, NIF, origen, asociación o ID.
  - `estado`: Filtrado por estado (`activo`, `participa`, etc.).
  - `sort`: Campo de ordenación (`fecha_creacion`, `nombre`, `apellidos`, `nombre_artistico`, `email`, `nif_pasaporte`, `origen`, `quiero_participar`, `id`).
  - `order`: Sentido de ordenación (`ASC` o `DESC`).
- **Respuesta de Éxito (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "count": 2,
    "stats": {
      "total": 2,
      "hoy": 1,
      "activos": 2,
      "quieren_participar": 1
    },
    "data": [
      {
        "id": 2,
        "nombre": "Carlos",
        "apellidos": "Gómez Pérez",
        "nombre_artistico": "Mago Carlos",
        "nif_pasaporte": "87654321X",
        "email": "carlos@mago.es",
        "telefono": "612345678",
        "origen": "Madrid, España",
        "asociacion": "Hermandad Mágica Española",
        "quiero_participar": true,
        "acepta_privacidad": true,
        "consentimiento_imagen": true,
        "comentarios": "Alergia a los frutos secos.",
        "estado": "activo",
        "ip_registro": "127.0.0.1",
        "fecha_creacion": "2026-08-28 20:15:00",
        "fecha_actualizacion": null
      }
    ]
  }
  ```

---

## 6. Base de Datos, Esquema y Control de Versiones

### 6.1. Tabla Principal: `enmi_inscripciones`

```sql
CREATE TABLE IF NOT EXISTS `enmi_inscripciones` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(150) NOT NULL,
  `nombre_artistico` VARCHAR(100) DEFAULT NULL,
  `nif_pasaporte` VARCHAR(30) NOT NULL DEFAULT '',
  `email` VARCHAR(255) NOT NULL DEFAULT '',
  `telefono` VARCHAR(30) NOT NULL DEFAULT '',
  `origen` VARCHAR(150) NOT NULL DEFAULT '',
  `asociacion` VARCHAR(150) DEFAULT NULL,
  `quiero_participar` TINYINT(1) NOT NULL DEFAULT 0,
  `acepta_privacidad` TINYINT(1) NOT NULL DEFAULT 0,
  `consentimiento_imagen` TINYINT(1) NOT NULL DEFAULT 0,
  `comentarios` TEXT DEFAULT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'activo',
  `ip_registro` VARCHAR(45) DEFAULT NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_inscripciones_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_inscripciones_apellidos` (`apellidos`),
  INDEX `idx_enmi_inscripciones_email` (`email`),
  INDEX `idx_enmi_inscripciones_nif` (`nif_pasaporte`),
  INDEX `idx_enmi_inscripciones_participar` (`quiero_participar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2. Tabla de Configuración de la Web: `enmi_configuracion`

```sql
CREATE TABLE IF NOT EXISTS `enmi_configuracion` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clave` VARCHAR(100) NOT NULL COMMENT 'Identificador único del parámetro de configuración',
  `valor` TEXT DEFAULT NULL COMMENT 'Valor del parámetro almacenado como texto',
  `descripcion` VARCHAR(255) DEFAULT NULL COMMENT 'Descripción explicativa del propósito del parámetro',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última modificación',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_configuracion_clave` (`clave`),
  INDEX `idx_enmi_configuracion_clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 7. Requisitos Funcionales (RF)

- **RF-01: Entrada de Datos Completa**:
  - Captación de nombre real, apellidos, nombre artístico, documento de identidad (NIF/CIF/Pasaporte), correo electrónico, teléfono móvil, lugar de residencia (localidad/provincia/país), asociación o círculo mágico, voluntad de participación activa, aceptación de RGPD y derechos de imagen, y comentarios adicionales.
- **RF-02: Modales Interactivos en Formulario**:
  - Modal informativo orientativo sobre las opciones en las que puede participar (Concurso no oficial, Gala de escena, Dealer / stand, Charla/taller/microconferencia y Apoyo logístico) con aviso de contacto personalizado posterior.
  - Modal legal con el texto íntegro de Política de Privacidad / RGPD y aceptación directa.
- **RF-03: Diseño Adaptable y Ampliado**:
  - Contenedor responsive ancho (`max-w-4xl`) con rejilla de 2 columnas en desktop y fluido en móviles.
- **RF-04: Gestión y Auditoría en Panel de Administración**:
  - Listado enriquecido con identificación artística, filtro de participación, modal de ficha completa y exportación a Excel/CSV con todas las columnas.
- **RF-05: Sistema de Perfiles y Niveles de Seguridad por Página (RBAC)**:
  - **3 Perfiles Diferenciados con Paneles Dedicados**:
    - `superadministrador` (Nivel 3 - Máximo): Acceso total. Gestión de usuarios y staff (`/admin/usuarios`), cambio de roles, desbloqueo de cuentas, reseteo de claves, auditoría de logs (`/admin/logs`), gestión y exportación de inscritos (`/admin/inscritos`), panel general (`/admin`) y mostrador de recepción (`/asistente`).
    - `supervisor` (Nivel 2 - Supervisión y Gestión): Panel de administración (`/admin`), gestión de inscritos con exportación CSV e informes (`/admin/inscritos`), auditoría y visor de logs (`/admin/logs`) y mostrador de recepción (`/asistente`).
    - `asistente` (Nivel 1 - Operativo / Recepción y Acreditaciones): **Panel exclusivo de asistentes (`/asistente`)** para búsqueda rápida por DNI/nombre/nombre artístico, verificación en sede, visualización de fichas de acreditación y registro in situ. El panel de administración (`/admin`) queda restringido.
  - **Guards de Seguridad en Angular**: `roleGuard` funcional que evalúa `route.data['roles']` o `route.data['minRole']`, redirigiendo usuarios no autorizados a `/acceso-denegado` (pantalla informativa 403) o a su panel correspondiente sin romper la sesión activa.
  - **Endpoints Backend Seguros en PHP**: `api/usuarios.php` (exclusivo Superadmin), `api/logs.php` (Superadmin y Supervisor), y enriquecimiento de `api/login.php` y `api/check_session.php` con el perfil del usuario.
  - **Migración 007 (`007_add_rol_to_enmi_usuarios.sql`)**: Incorporación de columna `rol` en `enmi_usuarios` y usuarios semilla de prueba para los tres perfiles.
- **RF-06: Configuración Dinámica y Centralizada en Base de Datos**:
  - Almacén de configuraciones en tabla `enmi_configuracion` con soporte clave-valor textual.
  - Parámetro de `mantenimiento` (valor `"1"` para activar el estado de mantenimiento / cierre temporal).
  - Parámetros completos del servicio de correo saliente SMTP (`smtp_host`, `smtp_port`, `smtp_secure`, `smtp_auth`, `smtp_user`, `smtp_pass`, `smtp_from_email`, `smtp_from_name`, `notification_emails` separados por comas).
- **RF-07: Control de Acceso y Redirección en Modo Mantenimiento**:
  - Si el parámetro `mantenimiento` vale `"1"`:
    - La web se coloca automáticamente en **Modo Mantenimiento**.
    - Cualquier página solo se puede visualizar si el usuario ha iniciado sesión (`isLoggedIn`).
    - Si el usuario **no** ha iniciado sesión, es redirigido de inmediato a la página de mantenimiento (`/mantenimiento`).
    - La ruta `/login` permanece accesible para permitir la autenticación de miembros del staff, supervisores y asistentes autorizados.
    - El endpoint de inscripciones públicas (`api/inscribir.php`) bloquea nuevos registros de visitantes no identificados con código HTTP 503.
    - La barra de navegación muestra un banner superior distintivo para los usuarios con sesión activa indicando el estado de mantenimiento.
  - Si el parámetro `mantenimiento` vale `"0"`:
    - La web opera en modo abierto estándar. Si se intenta acceder a `/mantenimiento`, el guard redirige a la portada (`/`).
  - Conmutación directa del modo mantenimiento desde el Panel de Administración (`AdminDashboardComponent`) para perfiles `superadministrador` y `supervisor`.

---

## 8. Registro de Cambios (Changelog)

### v2.9.0 (Actual)
- **Modo Mantenimiento Dinámico (`mantenimiento = "1"`)**: Implementación del flujo completo de cierre y apertura temporal de la plataforma.
- **Guard Funcional de Mantenimiento (`maintenanceGuard`)**: Redirección automática de visitantes no autenticados a `/mantenimiento` cuando la web está en mantenimiento, permitiendo el acceso irrestricto a usuarios autenticados.
- **Página de Mantenimiento (`MantenimientoComponent` en `/mantenimiento`)**: Vista institucional de aviso de mantenimiento con botón de inicio de sesión para organizadores y comprobador de estado en tiempo real.
- **Endpoint de Configuración (`api/configuracion.php`)**: Consulta pública del estado de mantenimiento (`GET`) y actualización autorizada (`POST`) con registro en `enmi_logs`.
- **Control desde el Panel de Administración**: Botones interactivos de activación/desactivación de mantenimiento en `AdminDashboardComponent` e indicador en la cabecera `NavbarComponent`.
- **Protección en API de Inscripciones (`api/inscribir.php`)**: Rechazo automático (503) de inscripciones públicas cuando el mantenimiento está activo.

### v2.8.0
- **Tabla de Configuración de la Web (`enmi_configuracion`)**: Creación de la tabla clave-valor de texto para gestión dinámica de parámetros en MariaDB.
- **Parámetro de Mantenimiento (`mantenimiento = "1"`)**: Incorporación del flag de control del estado de mantenimiento web en base de datos.
- **Centralización de Configuración SMTP y Correo**: Traslado de las credenciales, host, puertos, remitentes y lista de correos de notificación (`notification_emails` separados por comas) desde los archivos de entorno hacia `enmi_configuracion`.
- **Capa de Abstracción en API PHP (`api/config.php`)**: Nuevas funciones `getDbConfig()`, `getConfigValue()`, `isMaintenanceMode()` y adaptación retrocompatible de `getSmtpConfig()` y `getNotificationEmails()` con caché estática por petición.
- **Migración 008 (`008_create_enmi_configuracion.sql`)**: Script incremental y actualización del esquema consolidado (`db/schema.sql`).

### v2.7.0
- **Panel Exclusivo para Asistentes (`PanelAsistenteComponent` en `/asistente`)**: Módulo operativo para control de acceso, búsqueda predictiva de participantes y fichas completas de acreditación.
- **Restricción del Panel de Administración (`/admin`)**: Exclusivo para Superadministrador y Supervisor.
- **Sistema de Control de Acceso por Roles (RBAC)**: Implementación de perfiles `superadministrador`, `supervisor` y `asistente`.
- **Niveles de Seguridad por Página**: Asignación granular de permisos en rutas con `roleGuard` y vista informativa `AccesoDenegadoComponent`.
- **Panel de Gestión de Usuarios (`AdminUsuariosComponent`)**: Módulo para Superadministrador que permite crear usuarios, alternar roles, bloquear/desbloquear y resetear contraseñas.
- **Panel de Auditoría de Logs (`AdminLogsComponent`)**: Visor en tiempo real con estadísticas y filtros para Superadministrador y Supervisor.
- **Barra de Navegación y Dashboard Adaptativos**: Badges dinámicos de perfil y enlaces condicionados por privilegios de seguridad.
- **Migración 007 de Base de Datos**: Adición del campo `rol` en `enmi_usuarios` y cuentas semilla de prueba.
- **Nuevos Endpoints REST en PHP**: `api/usuarios.php` y `api/logs.php`.

### v2.6.0
- **Ampliación Integral del Formulario de Inscripción**: Inclusión de campos para nombre artístico, NIF/CIF/Pasaporte, email, teléfono, lugar de residencia, asociación, quiero participar, consentimiento de imagen y comentarios.
- **Modales de Información y RGPD**: Modal de desglose de participación y modal de texto legal de protección de datos.
- **Diseño Ancho y Adaptable**: Rejilla responsive de 2 columnas (`max-w-4xl`) con microinteracciones y secciones visuales.
- **Migración 005 (`005_add_fields_to_enmi_inscripciones.sql`)**: Modificación del esquema de MariaDB.
- **Actualización de API y Notificaciones**: Adaptación de `inscribir.php`, `inscripciones.php` y plantillas de correo en `mailer.php`.
- **Panel de Administración Enriquecido**: Ficha detallada con datos artísticos, residencia, contacto y exportación CSV completa.
