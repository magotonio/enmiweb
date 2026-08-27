# Especificaciones del Proyecto: Formulario de Inscripción

Documento de especificaciones funcionales y técnicas del sistema de inscripción. Este archivo se mantendrá actualizado a medida que se incorporen nuevos campos, reglas de negocio o integraciones.

---

## 1. Visión General
Aplicación web moderna, accesible y modular construida con **Angular 21** conectada a un backend ligero en **PHP 8** y base de datos **MariaDB**, diseñada para la captación y registro de participantes con persistencia de datos segura.

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
│   ├── inscribir.php                            # Endpoint POST para registrar inscripciones
│   └── test_db.php                              # Endpoint de diagnóstico y salud de la base de datos
├── public/                                      # Activos estáticos públicos (favicon, etc.)
├── src/                                         # Código fuente de la aplicación Angular
│   ├── index.html                               # Plantilla HTML raíz
│   ├── main.ts                                  # Punto de entrada de la aplicación
│   ├── styles.css                               # Sistema de diseño, variables CSS y estilos globales
│   └── app/
│       ├── app.config.ts                        # Proveedores globales (HttpClient con fetch, detección de cambios)
│       ├── app.component.ts/.html/.css          # Componente principal contenedor
│       ├── models/
│       │   └── inscripcion.model.ts             # Interfaces TypeScript (datos y respuestas de API)
│       ├── services/
│       │   └── inscripcion.service.ts           # Servicio HTTP para comunicación con la API PHP
│       └── components/
│           └── registration-form/               # Componente Standalone del Formulario
│               ├── registration-form.component.ts
│               ├── registration-form.component.html
│               └── registration-form.component.css
└── db/                                          # Gestión de base de datos y versiones
    ├── schema.sql                               # Esquema completo consolidado actual (MariaDB)
    └── migrations/                              # Scripts incrementales versionados
        └── 001_create_enmi_inscripciones.sql
```

---

## 3. Stack Tecnológico e Infraestructura
- **Frontend**:
  - **Framework**: **Angular 21** (Standalone Components, Signals, Control Flow moderno `@if`/`@else`).
  - **Formularios**: **Reactive Forms** (`ReactiveFormsModule`, `FormBuilder`, `Validators`).
  - **Comunicación HTTP**: `@angular/common/http` (`provideHttpClient(withFetch())`).
  - **Lenguaje**: **TypeScript 5.9+** (Modo estricto).
  - **Estilos**: **Tailwind CSS v4** (`@tailwindcss/postcss`, clases de utilidad modernas, diseño responsive, microinteracciones y estados dinámicos).
  - **Tipografía**: *Plus Jakarta Sans* (Google Fonts).
  - **Accesibilidad**: Atributos `aria-*`, alertas `role="alert"`, navegación completa por teclado y autofoco inteligente.
- **Backend**:
  - **Lenguaje/Entorno**: **PHP 8.2+** sin dependencias externas pesadas (despliegue directo en hosting compartido).
  - **Persistencia**: **PDO (PHP Data Objects)** con juego de caracteres `utf8mb4` y sentencias preparadas contra inyecciones SQL.
  - **Servicio de Email**: Configuración SMTP compatible con Dinahosting (puerto 465 SSL / 587 TLS) cargada dinámicamente mediante cascada de entornos (`config.env.php` > `config.env.local.php` > `getenv()`).
  - **Formato de Comunicación**: JSON REST con cabeceras CORS y códigos de estado HTTP estándar (201, 400, 405, 500).
- **Infraestructura y Hosting**:
  - **Entorno Local**: **Docker Compose** con 3 servicios:
    - `api`: PHP 8.2 Apache en `http://localhost:8000`.
    - `db`: MariaDB 10.11 en `localhost:3306` (inicializado automáticamente con `db/schema.sql`).
    - `phpmyadmin`: Administrador visual de BD en `http://localhost:8080`.
  - **Producción (Hosting Privado / Dinahosting)**:
    - Despliegue de los archivos de `dist/enmi/browser/` en la raíz pública del dominio.
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
- **Respuesta de Error (HTTP 400 / 500)**:
  ```json
  {
    "success": false,
    "message": "Errores de validación en el formulario.",
    "errors": {
      "nombre": "El nombre debe tener al menos 2 caracteres."
    }
  }
  ```

### `POST /api/login.php`
Autentica un usuario contra la base de datos `enmi_usuarios`.

- **Cabeceras**: `Content-Type: application/json`
- **Cuerpo (JSON)**:
  ```json
  {
    "login": "admin",
    "password": "miPasswordSeguro"
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
- **Respuesta de Error (HTTP 401 Unauthorized / 403 Forbidden)**:
  ```json
  {
    "success": false,
    "message": "Usuario o contraseña incorrectos."
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

### 6.3. Tabla de Recuperación de Contraseñas: `enmi_recuperacion_passwords`

```sql
CREATE TABLE IF NOT EXISTS `enmi_recuperacion_passwords` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL COMMENT 'Hash SHA-256 del token seguro enviado por email',
  `expira_en` DATETIME NOT NULL COMMENT 'Fecha y hora de expiración del enlace (ej. 30 o 60 min)',
  `utilizado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Pendiente / No utilizado, 1: Ya utilizado',
  `ip_solicitud` VARCHAR(45) DEFAULT NULL COMMENT 'Dirección IP desde la que se solicitó el restablecimiento',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_utilizacion` DATETIME DEFAULT NULL COMMENT 'Fecha y hora en que se canjeó el token',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_recuperacion_token` (`token_hash`),
  INDEX `idx_enmi_recuperacion_usuario` (`usuario_id`),
  INDEX `idx_enmi_recuperacion_email` (`email`),
  INDEX `idx_enmi_recuperacion_expira` (`expira_en`),
  CONSTRAINT `fk_enmi_recuperacion_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `enmi_usuarios` (`id`) 
    ON DELETE CASCADE 
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

---

## 8. Registro de Cambios (Changelog)

### v2.2.0 (Actual)
- **Infraestructura Docker Compose**: Configuración completa con servicios MariaDB 10.11, PHP 8.2 Apache y phpMyAdmin.
- **Backend API REST en PHP**: Creación de endpoints `api/config.php`, `api/inscribir.php` (inserción con PDO parametrizada) y `api/test_db.php`.
- **Integración HTTP en Angular**: Implementación de `InscripcionService`, `provideHttpClient(withFetch())`, configuración de proxy `proxy.conf.json`.
- **UX del Formulario**: Gestión de estados de carga (`isLoading`), banner de errores del servidor (`serverError`), spinner y botones deshabilitados reactivamente.

### v2.1.0
- Actualización a **Angular 21** (`@angular/core@21.2.20`, `@angular/cli@21.2.21`) y **TypeScript 5.9**.
- Verificación y compilación de producción optimizada.

### v2.0.0
- Migración a arquitectura Standalone Components en Angular.

---

## 9. Backlog / Próximas Mejoras Propuestas
- [ ] Incorporación de campos adicionales (Correo electrónico, Teléfono, Fecha de nacimiento).
- [ ] Envío de correo de confirmación automático (vía PHPMailer / SMTP).
- [ ] Panel de administración protegido para consultar listado de inscritos y exportar a CSV/Excel.
- [ ] Modo oscuro / selector de tema.
