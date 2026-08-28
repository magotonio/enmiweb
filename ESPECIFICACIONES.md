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
│   ├── logger.php                               # Servicio centralizado de registro de logs y auditoría
│   ├── mailer.php                               # Servicio SMTP nativo y plantillas de notificación por correo
│   ├── inscribir.php                            # Endpoint POST para registrar inscripciones y disparar alertas
│   ├── inscripciones.php                        # Endpoint GET para listar y auditar inscripciones con estadísticas
│   ├── login.php                                # Endpoint POST para autenticación de administradores
│   └── test_db.php                              # Endpoint de diagnóstico y salud de la base de datos
├── public/                                      # Activos estáticos públicos (favicon, etc.)
├── src/                                         # Código fuente de la aplicación Angular
│   ├── index.html                               # Plantilla HTML raíz
│   ├── main.ts                                  # Punto de entrada de la aplicación
│   ├── styles.css                               # Sistema de diseño, variables CSS y estilos globales
│   └── app/
│       ├── app.config.ts                        # Proveedores globales (HttpClient con fetch, Locale 'es')
│       ├── app.routes.ts                        # Rutas de la aplicación con guards de autenticación
│       ├── app.component.ts/.html/.css          # Componente principal contenedor
│       ├── models/
│       │   ├── inscripcion.model.ts             # Interfaces TypeScript (inscripciones, respuestas y filtros)
│       │   └── usuario.model.ts                 # Interfaces TypeScript (usuarios, login, credenciales)
│       ├── services/
│       │   ├── auth.service.ts                  # Servicio de autenticación y gestión de sesión
│       │   └── inscripcion.service.ts           # Servicio HTTP para registro, consulta y exportación CSV
│       ├── guards/
│       │   └── auth.guard.ts                    # Guard funcional para proteger rutas administrativas
│       └── components/
│           ├── navbar/                          # Barra superior con menú horizontal de administrador
│           ├── footer/                          # Pie de página institucional
│           ├── home/                            # Portada y presentación del encuentro
│           ├── login/                           # Formulario de acceso de administradores
│           ├── registration-form/               # Formulario de inscripción pública
│           └── admin-inscripciones/             # Panel de revisión, búsqueda y exportación de inscritos
└── db/                                          # Gestión de base de datos y versiones
    ├── schema.sql                               # Esquema completo consolidado actual (MariaDB)
    └── migrations/                              # Scripts incrementales versionados
        ├── 001_create_enmi_inscripciones.sql
        ├── 002_create_enmi_usuarios.sql
        ├── 003_create_enmi_recuperacion_passwords.sql
        └── 004_create_enmi_logs.sql
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
  - **Servicio de Logs, Auditoría y Niveles (`api/logger.php`)**: Filtrado inteligente por severidad (`LOG_LEVEL`: `DEBUG` [100], `INFO` [200], `NOTICE` [250], `WARNING` [300], `ERROR` [400], `CRITICAL` [500]) con descarte automático de eventos menores al umbral y captura de contexto, IP, User-Agent y origen.
  - **Manejo Global de Errores en API (`api/config.php`)**: Capturador de excepciones (`set_exception_handler`), errores de runtime (`set_error_handler`) y errores fatales (`register_shutdown_function`) con registro en `enmi_logs` y respuestas JSON 500 normalizadas con detalle de depuración condicional (`SHOW_ERROR_DETAILS`).
  - **Servicio de Email y Notificaciones**: Configuración SMTP compatible con Dinahosting (puerto 465 SSL / 587 TLS) y array de direcciones para notificaciones (`NOTIFICATION_EMAILS`), cargadas dinámicamente mediante cascada de entornos (`config.env.php` > `config.env.local.php` > `getenv()`).
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
    "apellidos": "Navarro Sánchez"
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
      "apellidos": "Navarro Sánchez"
    }
  }
  ```

### `GET /api/inscripciones.php`
Consulta y recupera el listado completo de participantes inscritos con estadísticas agregadas y parámetros opcionales de búsqueda y ordenación.

- **Parámetros URL Opcionales**:
  - `q`: Búsqueda textual por nombre o apellidos.
  - `estado`: Filtrado por estado (`activo`, etc.).
  - `sort`: Campo de ordenación (`fecha_creacion`, `nombre`, `apellidos`, `id`).
  - `order`: Sentido de ordenación (`ASC` o `DESC`).
- **Respuesta de Éxito (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "count": 2,
    "stats": {
      "total": 2,
      "hoy": 1,
      "activos": 2
    },
    "data": [
      {
        "id": 2,
        "nombre": "Carlos",
        "apellidos": "Gómez Pérez",
        "estado": "activo",
        "ip_registro": "127.0.0.1",
        "fecha_creacion": "2026-08-27 20:15:00",
        "fecha_actualizacion": null
      }
    ]
  }
  ```

### `POST /api/login.php`
Autentica un usuario contra la base de datos `enmi_usuarios`.

- **Cabeceras**: `Content-Type: application/json`
- **Cuerpo (JSON)** (Usuario por defecto creado en BD: `admin` / `Admin.123`):
  ```json
  {
    "login": "admin",
    "password": "Admin.123"
  }
  ```
- **Respuesta de Éxito (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "message": "Inicio de sesión exitoso.",
    "user": {
      "id": 1,
      "login": "admin",
      "email": "admin@enmi2027.es"
    },
    "token": "a1b2c3d4e5f6..."
  }
  ```

### `GET /api/test_db.php`
Comprueba la conectividad con MariaDB y reporta el estado y registros actuales.

---

## 6. Base de Datos, Esquema y Control de Versiones

### 6.1. Tabla Principal: `enmi_inscripciones`

```sql
CREATE TABLE IF NOT EXISTS `enmi_inscripciones` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(150) NOT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'activo',
  `ip_registro` VARCHAR(45) DEFAULT NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_inscripciones_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_inscripciones_apellidos` (`apellidos`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2. Tabla de Usuarios y Autenticación: `enmi_usuarios`

```sql
CREATE TABLE IF NOT EXISTS `enmi_usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `login` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash de contraseña encriptada (ej. BCRYPT/Argon2)',
  `ultimo_login` DATETIME DEFAULT NULL COMMENT 'Fecha y hora del último acceso exitoso',
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Activo / No bloqueado, 1: Bloqueado',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_usuarios_login` (`login`),
  UNIQUE KEY `uq_enmi_usuarios_email` (`email`),
  INDEX `idx_enmi_usuarios_bloqueado` (`bloqueado`),
  INDEX `idx_enmi_usuarios_ultimo_login` (`ultimo_login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.3. Tabla de Logs y Auditoría: `enmi_logs`

```sql
CREATE TABLE IF NOT EXISTS `enmi_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nivel` VARCHAR(20) NOT NULL DEFAULT 'INFO' COMMENT 'Nivel de severidad: DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY',
  `categoria` VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Módulo o categoría: auth, inscripciones, email, api, bd, seguridad, sistema',
  `accion` VARCHAR(100) NOT NULL COMMENT 'Identificador de la acción (ej: login_exitoso, login_fallido, registro_creado, email_enviado, error_sql)',
  `mensaje` TEXT NOT NULL COMMENT 'Descripción legible o detalle del evento',
  `contexto` JSON DEFAULT NULL COMMENT 'Datos complementarios, payload o stack trace en formato JSON',
  `usuario_id` INT UNSIGNED DEFAULT NULL COMMENT 'ID del usuario autenticado si aplica',
  `ip` VARCHAR(45) DEFAULT NULL COMMENT 'Dirección IP del cliente (IPv4 o IPv6)',
  `user_agent` VARCHAR(255) DEFAULT NULL COMMENT 'Navegador o cliente HTTP que originó la petición',
  `origen` VARCHAR(100) DEFAULT NULL COMMENT 'Fichero o endpoint de origen (ej: inscribir.php, mailer.php)',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora exacta del registro',
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_logs_nivel` (`nivel`),
  INDEX `idx_enmi_logs_categoria` (`categoria`),
  INDEX `idx_enmi_logs_accion` (`accion`),
  INDEX `idx_enmi_logs_usuario` (`usuario_id`),
  INDEX `idx_enmi_logs_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_logs_cat_fecha` (`categoria`, `fecha_creacion`),
  CONSTRAINT `fk_enmi_logs_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `enmi_usuarios` (`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 7. Requisitos Funcionales (RF)

- **RF-01: Entrada de Datos**:
  - El usuario ingresa su nombre y apellidos gestionados reactivamente por `ReactiveFormsModule`.
- **RF-02: Validación Reactiva en Cliente**:
  - Validación visual inmediata y al pulsar el botón de envío. Resalta campos con errores y dirige el foco automáticamente al primer campo inválido.
- **RF-03: Envío Asíncrono y Estado de Carga**:
  - Al enviar un formulario válido, se desactiva el botón y se muestra un indicador animado de carga (*"Guardando inscripción..."*).
- **RF-04: Gestión de Errores del Servidor**:
  - Si la API o la base de datos fallan, se muestra un banner de error accesible (`role="alert"`) manteniendo los datos introducidos para reintentar.
- **RF-05: Estado de Confirmación (Éxito)**:
  - Al completarse el registro en MariaDB, se conmuta el estado mediante Signals (`isSubmitted`) y se despliega el mensaje de éxito con el nombre registrado.
- **RF-06: Registro Continuo**:
  - Botón *"Registrar a otra persona"* que limpia el formulario y enfoca de nuevo el campo *Nombre*.
- **RF-07: Control de Acceso y Protección de Rutas Administrativas**:
  - Rutas bajo `/admin/*` protegidas por `authGuard`. Redirección al login y retorno a la ruta previa al autenticarse.
- **RF-08: Panel de Revisión de Inscritos**:
  - Interfaz de administración con métricas rápidas (KPIs), tabla con ordenación por columnas, buscador en tiempo real, paginación configurable y modal de detalle.
- **RF-09: Exportación de Datos a CSV**:
  - Generación en cliente de archivo CSV con BOM UTF-8 (\uFEFF) para compatibilidad con Microsoft Excel y caracteres en español.

---

## 8. Registro de Cambios (Changelog)

### v2.5.0 (Actual)
- **Tabla de Logs y Auditoría (`enmi_logs`)**: Creación de la migración `004_create_enmi_logs.sql` y actualización del esquema consolidado `schema.sql` para registro de eventos, errores, notificaciones y auditoría de accesos.
- **Niveles de Log Configurables**: Filtrado por nivel de severidad (`LOG_LEVEL`: `DEBUG`, `INFO`, `NOTICE`, `WARNING`, `ERROR`, `CRITICAL`) configurable en `config.env.*.php` y variables de entorno.
- **Control Global de Errores en API**: Handlers globales para excepciones, errores de ejecución PHP y errores fatales en `api/config.php` con registro automático en `enmi_logs` y modo depuración (`SHOW_ERROR_DETAILS`).
- **Servicio Centralizado de Logs (`api/logger.php`)**: Funciones PHP reutilizables (`logEvent`, `logDebug`, `logInfo`, `logNotice`, `logWarning`, `logError`, `logCritical`, `logNotification`, `logAuth`) con captura automática de IP, User-Agent y origen, almacenamiento JSON y mecanismo de fallback seguro.
- **Integración de Logs en Endpoints**: Auditoría de inicios de sesión en `login.php` e inscripciones/notificaciones en `inscribir.php`.
- **Diagnóstico en `test_db.php`**: Monitorización del estado de tablas `enmi_inscripciones`, `enmi_usuarios`, `enmi_logs` y visualización de la configuración activa de logs.

### v2.4.0
- **Servicio SMTP Nativo y Notificaciones (`api/mailer.php`)**: Implementación de cliente SMTP ligero en PHP 8.2 compatible con Dinahosting (SSL/TLS con autenticación) para envío de correos sin dependencias de terceros.
- **Notificación por Nueva Inscripción**: Envío automático de correo con plantilla HTML moderna y versión texto a las direcciones configuradas en `NOTIFICATION_EMAILS` al procesar `POST /api/inscribir.php`.
- **Configuración Multidirección de Emails**: Soporte para array de destinatarios en `config.env.*.php` y función auxiliar `getNotificationEmails()`.

### v2.3.0
- **Panel de Administración de Inscritos**: Implementación de la página `/admin/inscritos` con diseño premium en tonos azul marino y dorado.
- **Endpoint GET `/api/inscripciones.php`**: Creación del servicio PHP con filtros de búsqueda, ordenación por columnas y cálculo de métricas en tiempo real.
- **Seguridad en Rutas (AuthGuard)**: Creación de guard funcional `authGuard` en Angular para proteger el acceso a administradores autenticados.
- **Exportación CSV**: Soporte de descarga de listados filtrados con codificación UTF-8 BOM.
- **Internacionalización**: Configuración del locale en español en `app.config.ts` para visualización precisa de fechas.

### v2.2.0
- **Infraestructura Docker Compose**: Configuración completa con servicios MariaDB 10.11, PHP 8.2 Apache y phpMyAdmin.
- **Backend API REST en PHP**: Creación de endpoints `api/config.php`, `api/inscribir.php` (inserción con PDO parametrizada) y `api/test_db.php`.
- **Integración HTTP en Angular**: Implementación de `InscripcionService`, `provideHttpClient(withFetch())`, configuración de proxy `proxy.conf.json`.

---

## 9. Backlog / Próximas Mejoras Propuestas
- [ ] Incorporación de campos adicionales (Correo electrónico, Teléfono, Fecha de nacimiento).
- [ ] Envío de correo de confirmación automático (vía PHPMailer / SMTP).
- [ ] Modo oscuro / selector de tema.
