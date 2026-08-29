<?php
/**
 * Endpoint de Registro de Inscripciones
 * Método: POST
 * Payload esperado: JSON { "nombre": "...", "apellidos": "..." }
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

// Verificar que el método sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método no permitido. Utilice POST.'
    ], 405);
}

// Leer cuerpo de la petición (JSON)
$inputRaw = file_get_contents('php://input');
$data = json_decode($inputRaw, true);

if (!is_array($data)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Cuerpo de la petición inválido. Se espera formato JSON.'
    ], 400);
}

// Comprobar si la web se encuentra en modo mantenimiento
if (isMaintenanceMode()) {
    $operatorId = isset($data['operator_id']) ? (int)$data['operator_id'] : null;
    $operatorLogin = isset($data['operator_login']) ? trim((string)$data['operator_login']) : null;
    $isAuthorizedOperator = false;

    if ($operatorId || !empty($operatorLogin)) {
        try {
            $pdoCheck = getDbConnection();
            $stmtOp = $pdoCheck->prepare("SELECT id, rol, bloqueado FROM `enmi_usuarios` WHERE (id = :id OR login = :login) AND bloqueado = 0 LIMIT 1");
            $stmtOp->execute([':id' => $operatorId, ':login' => $operatorLogin]);
            $op = $stmtOp->fetch();
            if ($op) {
                $isAuthorizedOperator = true;
            }
        } catch (Throwable $e) {
            $isAuthorizedOperator = false;
        }
    }

    if (!$isAuthorizedOperator) {
        sendJsonResponse([
            'success'       => false,
            'mantenimiento' => true,
            'message'       => 'La web se encuentra actualmente en modo mantenimiento. Las inscripciones públicas están temporalmente cerradas.'
        ], 503);
    }
}

// Extraer y sanitizar campos
$nombre               = isset($data['nombre']) ? trim((string)$data['nombre']) : '';
$apellidos            = isset($data['apellidos']) ? trim((string)$data['apellidos']) : '';
$nombreArtistico      = isset($data['nombre_artistico']) ? trim((string)$data['nombre_artistico']) : null;
$nifPasaporte         = isset($data['nif_pasaporte']) ? strtoupper(trim((string)$data['nif_pasaporte'])) : '';
$email                = isset($data['email']) ? strtolower(trim((string)$data['email'])) : '';
$telefono             = isset($data['telefono']) ? trim((string)$data['telefono']) : '';
$origen               = isset($data['origen']) ? trim((string)$data['origen']) : '';
$asociacion           = isset($data['asociacion']) ? trim((string)$data['asociacion']) : null;
$quieroParticipar     = !empty($data['quiero_participar']) ? 1 : 0;
$aceptaPrivacidad     = !empty($data['acepta_privacidad']) ? 1 : 0;
$consentimientoImagen = !empty($data['consentimiento_imagen']) ? 1 : 0;
$comentarios          = isset($data['comentarios']) ? trim((string)$data['comentarios']) : null;

// Si los campos opcionales vienen vacíos, guardarlos como NULL
if ($nombreArtistico === '') $nombreArtistico = null;
if ($asociacion === '') $asociacion = null;
if ($comentarios === '') $comentarios = null;

// Validaciones de negocio
$errors = [];

if (empty($nombre)) {
    $errors['nombre'] = 'El nombre es obligatorio.';
} elseif (mb_strlen($nombre) < 2) {
    $errors['nombre'] = 'El nombre debe tener al menos 2 caracteres.';
} elseif (mb_strlen($nombre) > 100) {
    $errors['nombre'] = 'El nombre no puede superar los 100 caracteres.';
}

if (empty($apellidos)) {
    $errors['apellidos'] = 'Los apellidos son obligatorios.';
} elseif (mb_strlen($apellidos) < 2) {
    $errors['apellidos'] = 'Los apellidos deben tener al menos 2 caracteres.';
} elseif (mb_strlen($apellidos) > 150) {
    $errors['apellidos'] = 'Los apellidos no pueden superar los 150 caracteres.';
}

if ($nombreArtistico !== null && mb_strlen($nombreArtistico) > 100) {
    $errors['nombre_artistico'] = 'El nombre artístico no puede superar los 100 caracteres.';
}

if (empty($nifPasaporte)) {
    $errors['nif_pasaporte'] = 'El NIF / CIF / Pasaporte es obligatorio.';
} elseif (mb_strlen($nifPasaporte) < 3 || mb_strlen($nifPasaporte) > 30) {
    $errors['nif_pasaporte'] = 'Introduce un documento de identidad válido.';
}

if (empty($email)) {
    $errors['email'] = 'El correo electrónico es obligatorio.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Introduce una dirección de correo electrónico válida.';
} elseif (mb_strlen($email) > 255) {
    $errors['email'] = 'El correo electrónico no puede superar los 255 caracteres.';
}

if (empty($telefono)) {
    $errors['telefono'] = 'El teléfono móvil es obligatorio.';
} elseif (mb_strlen($telefono) < 6 || mb_strlen($telefono) > 30) {
    $errors['telefono'] = 'Introduce un número de teléfono válido.';
}

if (empty($origen)) {
    $errors['origen'] = 'La localidad, provincia o país de residencia es obligatorio.';
} elseif (mb_strlen($origen) < 2 || mb_strlen($origen) > 150) {
    $errors['origen'] = 'El campo de residencia debe tener entre 2 y 150 caracteres.';
}

if ($asociacion !== null && mb_strlen($asociacion) > 150) {
    $errors['asociacion'] = 'La asociación no puede superar los 150 caracteres.';
}

if (!$aceptaPrivacidad) {
    $errors['acepta_privacidad'] = 'Debes aceptar la Política de Privacidad y RGPD para poder inscribirte.';
}

if (!empty($errors)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Errores de validación en el formulario.',
        'errors'  => $errors
    ], 400);
}

// Obtener IP del cliente
$ipRegistro = getClientIp();

// Insertar en la base de datos MariaDB
$pdo = getDbConnection();

try {
    $stmt = $pdo->prepare("
        INSERT INTO `enmi_inscripciones` 
            (`nombre`, `apellidos`, `nombre_artistico`, `nif_pasaporte`, `email`, `telefono`, `origen`, `asociacion`, `quiero_participar`, `acepta_privacidad`, `consentimiento_imagen`, `comentarios`, `estado`, `ip_registro`, `fecha_creacion`) 
        VALUES 
            (:nombre, :apellidos, :nombre_artistico, :nif_pasaporte, :email, :telefono, :origen, :asociacion, :quiero_participar, :acepta_privacidad, :consentimiento_imagen, :comentarios, 'activo', :ip_registro, NOW())
    ");

    $stmt->execute([
        ':nombre'                => $nombre,
        ':apellidos'             => $apellidos,
        ':nombre_artistico'      => $nombreArtistico,
        ':nif_pasaporte'         => $nifPasaporte,
        ':email'                 => $email,
        ':telefono'              => $telefono,
        ':origen'                => $origen,
        ':asociacion'            => $asociacion,
        ':quiero_participar'     => $quieroParticipar,
        ':acepta_privacidad'     => $aceptaPrivacidad,
        ':consentimiento_imagen' => $consentimientoImagen,
        ':comentarios'           => $comentarios,
        ':ip_registro'           => $ipRegistro
    ]);

    $insertedId = (int)$pdo->lastInsertId();

    $logMsg = "Nueva inscripción ID #{$insertedId} registrada para {$nombre} {$apellidos}";
    if ($nombreArtistico) {
        $logMsg .= " ({$nombreArtistico})";
    }

    // Registrar log de nueva inscripción
    logInfo('inscripciones', 'registro_creado', $logMsg, [
        'id'                => $insertedId,
        'nombre'            => $nombre,
        'apellidos'         => $apellidos,
        'nombre_artistico'  => $nombreArtistico,
        'email'             => $email,
        'quiero_participar' => $quieroParticipar
    ]);

    // Enviar notificación por correo electrónico a los administradores
    $emailResult = sendRegistrationNotification([
        'id'                    => $insertedId,
        'nombre'                => $nombre,
        'apellidos'             => $apellidos,
        'nombre_artistico'      => $nombreArtistico,
        'nif_pasaporte'         => $nifPasaporte,
        'email'                 => $email,
        'telefono'              => $telefono,
        'origen'                => $origen,
        'asociacion'            => $asociacion,
        'quiero_participar'     => $quieroParticipar,
        'consentimiento_imagen' => $consentimientoImagen,
        'comentarios'           => $comentarios,
        'ip_registro'           => $ipRegistro,
        'fecha'                 => date('d/m/Y H:i:s')
    ]);

    // Registrar log del resultado del envío de notificación
    logNotification(
        'notificacion_inscripcion',
        $emailResult['message'] ?? 'Envío de correo de notificación',
        ['inscripcion_id' => $insertedId, 'detalle' => $emailResult],
        $emailResult['success'] ?? false
    );

    sendJsonResponse([
        'success'      => true,
        'message'      => 'Inscripción guardada correctamente.',
        'id'           => $insertedId,
        'data'         => [
            'nombre'            => $nombre,
            'apellidos'         => $apellidos,
            'nombre_artistico'  => $nombreArtistico,
            'email'             => $email,
            'quiero_participar' => (bool)$quieroParticipar
        ],
        'notificacion' => [
            'enviada' => $emailResult['success'] ?? false,
            'mensaje' => $emailResult['message'] ?? ''
        ]
    ], 201);

} catch (PDOException $e) {
    logError('inscripciones', 'error_bd_inscripcion', $e->getMessage(), [
        'nombre'    => $nombre,
        'apellidos' => $apellidos,
        'email'     => $email
    ]);
    sendJsonResponse([
        'success' => false,
        'message' => 'Error al registrar la inscripción en la base de datos: ' . $e->getMessage()
    ], 500);
}

