# Enmi - Sistema de Formulario de Inscripción

Sistema modular y accesible de captación y registro de inscripciones, desarrollado con **Angular 21** en el frontend, un backend ligero en **PHP 8.2 (Apache)** con **PDO**, persistencia en **MariaDB 10.11** y entorno de desarrollo orquestado mediante **Docker Compose**.

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Puesta en Marcha y Pruebas con Docker Compose](#-puesta-en-marcha-y-pruebas-con-docker-compose)
  - [1. Levantar el entorno de Backend y Base de Datos](#1-levantar-el-entorno-de-backend-y-base-de-datos)
  - [2. Iniciar el Frontend de Angular](#2-iniciar-el-frontend-de-angular)
  - [3. Flujo de Verificación y Pruebas](#3-flujo-de-verificación-y-pruebas)
- [Comandos Útiles de Docker](#-comandos-útiles-de-docker)
- [Scripts de Desarrollo Frontend (NPM)](#-scripts-de-desarrollo-frontend-npm)
- [Endpoints de la API REST](#-endpoints-de-la-api-rest)
- [Compilación y Despliegue en Producción](#-compilación-y-despliegue-en-producción)
- [Documentación Adicional](#-documentación-adicional)

---

## 🚀 Características Principales

- **Frontend Reactivo**: Formulario desarrollado con Standalone Components, Signals y Reactive Forms en Angular 21.
- **Versión visible**: El pie de página muestra la versión de `package.json`, incorporada automáticamente al compilar la aplicación.
- **Pasarelas de pago opcionales**: En `/admin/configuracion` → «Pagos: pasarela Redsys», `pago_redsys_activo` permite activar (`1`) o desactivar (`0`) Redsys independientemente de las demás modalidades. Está activado por defecto. Al desactivarlo se ocultan la opción de tarjeta y su simulador, y la API rechaza nuevos intentos; Bizum, transferencia y otras modalidades siguen disponibles. Las notificaciones de pagos ya iniciados y el historial se conservan. El simulador requiere además `pago_modo_demo` y sigue limitado al entorno local. Si falla la carga de configuración, la pantalla muestra un error y permite reintentar sin habilitar pasarelas por defecto. Para bases de datos existentes, aplicar `db/migrations/018_add_pago_redsys_activo.sql` (idempotente; no sobrescribe la activación guardada). Cada futuro banco tendrá su propia clave `pago_<proveedor>_activo` y su integración de inicio/retorno; no hay un selector exclusivo de banco ni se incluye aún otra pasarela.
- **Configuración del sistema**: Página `/admin/configuracion`, exclusiva del superadministrador y accesible desde el panel y los menús de escritorio/móvil. Agrupa las claves de `enmi_configuracion` en sistema, correo SMTP, notificaciones, acceso, pagos generales, Bizum, transferencias y Redsys; las claves no reconocidas aparecen en «Otros parámetros». Cada grupo es un acordeón independiente, inicialmente contraído; cerrarlo no descarta los cambios pendientes. Permite buscar por clave/descripción, filtrar por grupo y guardar o descartar cada valor por separado. Las contraseñas y claves secretas no se muestran ni se registran en la auditoría; un campo secreto vacío conserva el valor actual. No crea ni elimina claves. El listado completo y la escritura requieren sesión de superadministrador en la API; la escritura requiere además CSRF.
- **Validaciones en Tiempo Real**: Validación inmediata en cliente con autofoco accesible al primer campo inválido.
- **Backend Ligero**: API REST en PHP 8.2 estructurada para despliegue sin dependencias complejas (compatible con hosting compartido / Dinahosting).
- **Persistencia Segura**: Consultas parametrizadas mediante PDO con MariaDB 10.11 (`utf8mb4`).
- **Entorno Listo para Usar**: Inicialización automática del esquema de base de datos (`db/schema.sql`) y phpMyAdmin preconfigurado con Docker Compose.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión / Detalle |
| :--- | :--- | :--- |
| **Frontend** | Angular | 21.x (Standalone Components, Signals, Reactive Forms) |
| **Lenguaje Frontend** | TypeScript | 5.9+ |
| **Backend** | PHP (Apache) | 8.2+ con extensiones `pdo` y `pdo_mysql` |
| **Base de Datos** | MariaDB | 10.11 LTS |
| **Gestor Visual BD** | phpMyAdmin | Latest |
| **Contenedores** | Docker & Docker Compose | Orquestación de entorno local |

---

## 📁 Estructura del Proyecto

```text
├── docker-compose.yml       # Orquestación de contenedores (MariaDB, PHP API, phpMyAdmin)
├── docker/
│   └── php/
│       └── Dockerfile       # Imagen PHP 8.2 con Apache y extensiones PDO MySQL
├── proxy.conf.json          # Proxy de Angular para redirigir /api hacia http://localhost:8000
├── package.json             # Dependencias y scripts de Angular
├── ESPECIFICACIONES.md      # Especificaciones funcionales y técnicas detalladas
├── api/                     # Backend / API REST en PHP
│   ├── config.php           # Conexión PDO a MariaDB y utilidades JSON
│   ├── inscribir.php        # Endpoint POST para registrar inscripciones
│   └── test_db.php          # Endpoint GET de salud y diagnóstico de la BD
├── db/                      # Esquema y migraciones de MariaDB
│   ├── schema.sql           # Esquema inicial (creación de enmi_inscripciones)
│   └── migrations/          # Scripts SQL incrementales versionados
└── src/                     # Código fuente de la aplicación Angular
    ├── app/
    │   ├── components/      # Componentes (registration, etc.)
    │   ├── models/          # Interfaces TypeScript del modelo
    │   └── services/        # Servicios HTTP para conectar con la API
    └── styles.css           # Sistema de diseño y variables globales CSS
```

---

## 📦 Requisitos Previos

Asegúrate de tener instalados en tu máquina:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o motor de Docker con soporte para `docker compose`).
- [Node.js](https://nodejs.org/) (versión 20 LTS o 22 LTS recomendada).
- [npm](https://www.npmjs.com/) (incluido con Node.js).
- *(Opcional)* Angular CLI instalado globalmente (`npm install -g @angular/cli@latest`).

---

## 🐳 Puesta en Marcha y Pruebas con Docker Compose

Sigue estos pasos para levantar y probar el sistema completo en tu entorno local:

### 1. Levantar el entorno de Backend y Base de Datos

En la raíz del proyecto, ejecuta:

```bash
docker compose up -d --build
```

Esto descargará/construirá e iniciará 3 contenedores:

| Servicio | Contenedor | URL / Puerto | Descripción | Credenciales por Defecto |
| :--- | :--- | :--- | :--- | :--- |
| **Base de Datos** | `enmi_mariadb` | `localhost:3306` | MariaDB 10.11 (inicializa `db/schema.sql`) | DB: `enmi_db`<br>User: `enmi_user` / Pass: `enmi_password`<br>Root Pass: `rootpassword` |
| **Backend API** | `enmi_api` | `http://localhost:8000` | Apache + PHP 8.2 con PDO MySQL | N/A |
| **phpMyAdmin** | `enmi_phpmyadmin` | `http://localhost:8080` | Gestor visual web de la base de datos | Servidor: `db`<br>Usuario: `root` o `enmi_user`<br>Contraseña: `rootpassword` o `enmi_password` |
| **Admin Web (Default)** | Angular App | `http://localhost:4200/login` | Acceso al panel administrativo | Usuario: `admin` o `admin@enmi2027.es`<br>Contraseña: `Admin.123` |

### 2. Iniciar el Frontend de Angular

1. Instala las dependencias de Node.js (solo la primera vez o tras cambios en `package.json`):
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo de Angular con el proxy configurado:
   ```bash
   npm start
   ```
   *(Este comando ejecuta internamente `ng serve --proxy-config proxy.conf.json`, redirigiendo automáticamente las llamadas a `/api/*` hacia el contenedor en el puerto `8000`).*

3. Abre tu navegador web en: **`http://localhost:4200`**

---

### 3. Flujo de Verificación y Pruebas

#### A. Verificar el estado de la Base de Datos y la API
Accede desde el navegador a cualquiera de estas dos URLs:
- **Directo a la API**: [http://localhost:8000/api/test_db.php](http://localhost:8000/api/test_db.php)
- **A través del proxy de Angular**: [http://localhost:4200/api/test_db.php](http://localhost:4200/api/test_db.php)

Debes recibir una respuesta JSON con `"status": "ok"` y `"database": "conectada"`, confirmando la conexión con MariaDB y el conteo de registros en `enmi_inscripciones`.

#### B. Probar el Formulario Web
1. Ve a [http://localhost:4200](http://localhost:4200).
2. Rellena los campos **Nombre** y **Apellidos**.
3. Haz clic en **"Confirmar Inscripción"**.
4. Observa el indicador de carga y el mensaje de confirmación con el nombre registrado.
5. Puedes pulsar en *"Registrar a otra persona"* para limpiar el formulario y registrar un nuevo participante.

#### C. Verificar los Registros en phpMyAdmin
1. Abre [http://localhost:8080](http://localhost:8080) en el navegador.
2. Inicia sesión con el usuario `root` y contraseña `rootpassword` (o usuario `enmi_user` y contraseña `enmi_password`).
3. Selecciona la base de datos **`enmi_db`** y la tabla **`enmi_inscripciones`**.
4. Comprueba que las filas enviadas desde el formulario se han guardado correctamente con su marca de tiempo e IP.

#### D. Probar la API REST mediante cURL o Postman (Opcional)
Puedes realizar una petición `POST` directa para simular el registro:

```bash
curl -X POST http://localhost:8000/api/inscribir.php \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Carlos", "apellidos": "Gómez Pérez"}'
```

Respuesta esperada (HTTP 201 Created):
```json
{
  "success": true,
  "message": "Inscripción guardada correctamente.",
  "id": 1,
  "data": {
    "nombre": "Carlos",
    "apellidos": "Gómez Pérez"
  }
}
```

#### E. Acceso al Panel de Administración
1. Navega a [http://localhost:4200/login](http://localhost:4200/login).
2. Introduce las credenciales por defecto:
   - **Usuario / Email**: `admin` (o `admin@enmi2027.es`)
   - **Contraseña**: `Admin.123`
3. Serás redirigido al panel de gestión de inscritos (`/admin/inscritos`), donde podrás auditar, buscar y exportar los registros.

---

## 🔧 Comandos Útiles de Docker

- **Ver estado de los contenedores**:
  ```bash
  docker compose ps
  ```
- **Ver logs en tiempo real**:
  ```bash
  docker compose logs -f
  ```
- **Ver logs únicamente de la API PHP**:
  ```bash
  docker compose logs -f api
  ```
- **Detener los contenedores**:
  ```bash
  docker compose down
  ```
- **Reiniciar la base de datos desde cero (borrar datos persistentes)**:
  ```bash
  docker compose down -v
  docker compose up -d
  ```

---

## 💻 Scripts de Desarrollo Frontend (NPM)

| Comando | Descripción |
| :--- | :--- |
| `npm start` | Inicia el servidor de desarrollo (`ng serve`) con proxy a `localhost:8000` |
| `npm run build` | Compila la aplicación para producción en `dist/enmi/browser/` |
| `npm run watch` | Compila en modo desarrollo y queda a la espera de cambios |
| `npm test` | Ejecuta las pruebas unitarias con Karma |

---

## 🌐 Endpoints de la API REST

### `POST /api/inscribir.php`
Registra una nueva inscripción en la tabla `enmi_inscripciones`.
- **Payload (JSON)**: `{"nombre": "Nombre", "apellidos": "Apellidos"}`
- **Respuestas**:
  - `201 Created`: Inscripción completada con éxito.
  - `400 Bad Request`: Errores de validación (campos vacíos, longitud insuficiente).
  - `405 Method Not Allowed`: Método HTTP no permitido (distinto de POST o OPTIONS).
  - `500 Internal Server Error`: Error en la base de datos o servidor.

### `GET /api/test_db.php`
Diagnóstico y verificación de conectividad con MariaDB, versión del motor y últimas 5 inscripciones.

---

## 🚢 Compilación y Despliegue en Producción

Para desplegar en un hosting compartido o servidor tradicional (ej. Dinahosting):

1. **Compilar el frontend Angular**:
   ```bash
   npm run build
   ```
2. **Subir los archivos generados**:
   - Copiar el contenido de `dist/enmi/browser/` a la carpeta pública del hosting (ej. `public_html/` o `httpdocs/`).
   - Copiar la carpeta `api/` a la raíz del hosting.
3. **Configuración de Base de Datos**:
   - Crear la base de datos e importar `db/schema.sql`.
   - Ajustar las credenciales en `api/config.php` (o mediante variables de entorno del servidor).

> **Nota sobre convención**: Todas las tablas del proyecto utilizan obligatoriamente el prefijo `enmi_`.

---

## 📖 Documentación Adicional

Para más detalles sobre especificaciones funcionales, reglas de negocio, esquema de base de datos, pruebas de pago y control de versiones, consulta:
- [ESPECIFICACIONES.md](file:///c:/codigo/otros/enmiweb/ESPECIFICACIONES.md)
- [DATOS_PRUEBA_PAGO.md](file:///c:/codigo/otros/enmiweb/DATOS_PRUEBA_PAGO.md)
