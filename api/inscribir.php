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

// Comprobar si la petición proviene de un operador/usuario autenticado
$operatorId    = isset($data['operator_id']) ? (int)$data['operator_id'] : null;
$operatorLogin = isset($data['operator_login']) ? trim((string)$data['operator_login']) : null;
$operatorEmail = isset($data['operator_email']) ? trim((string)$data['operator_email']) : null;
$isAuthorizedOperator = false;
$op = null;

if ($operatorId || !empty($operatorLogin) || !empty($operatorEmail)) {
    try {
        $pdoCheck = getDbConnection();
        $stmtOp = $pdoCheck->prepare("
            SELECT id, login, email, rol, bloqueado 
            FROM `enmi_usuarios` 
            WHERE (id = :id OR login = :login OR email = :email) 
              AND bloqueado = 0 
            LIMIT 1
        ");
        $stmtOp->execute([
            ':id'    => $operatorId,
            ':login' => $operatorLogin,
            ':email' => $operatorEmail ?: $operatorLogin
        ]);
        $op = $stmtOp->fetch(PDO::FETCH_ASSOC);
        if ($op && (int)$op['bloqueado'] === 0) {
            $isAuthorizedOperator = true;
        }
    } catch (Throwable $e) {
        $isAuthorizedOperator = false;
    }
}

// Comprobar si la web se encuentra en modo mantenimiento
if (isMaintenanceMode()) {
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

// Conexión a MariaDB
$pdo = getDbConnection();

// =====================================================================
// VERIFICACIÓN DE DUPLICADOS EN BASE DE DATOS (NIF, CORREO, TELÉFONO)
// =====================================================================
$nifNormalized   = strtoupper(trim($nifPasaporte));
$emailNormalized = strtolower(trim($email));
$phoneClean      = preg_replace('/[\s\-\.\+\(\)]/', '', $telefono);
$phoneDigits     = preg_replace('/[^0-9]/', '', $telefono);
$phoneLast9      = (strlen($phoneDigits) >= 9) ? substr($phoneDigits, -9) : $phoneDigits;

try {
    $stmtCheck = $pdo->prepare("
        SELECT id, nombre, apellidos, nif_pasaporte, email, telefono, estado 
        FROM `enmi_inscripciones` 
        WHERE (
            UPPER(TRIM(nif_pasaporte)) = :nif
            OR LOWER(TRIM(email)) = :email
            OR TRIM(telefono) = :telefono_raw
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '.', ''), '+', ''), '(', ''), ')', '') = :telefono_clean
            OR (
                CHAR_LENGTH(:telefono_last9_len) >= 9 
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '.', ''), '+', ''), '(', ''), ')', ''), 9) = :telefono_last9
            )
        )
        AND (estado NOT IN ('cancelado', 'cancelada') OR estado IS NULL)
    ");

    $stmtCheck->execute([
        ':nif'                => $nifNormalized,
        ':email'              => $emailNormalized,
        ':telefono_raw'       => $telefono,
        ':telefono_clean'     => $phoneClean,
        ':telefono_last9_len' => $phoneLast9,
        ':telefono_last9'     => $phoneLast9
    ]);

    $existingRows = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($existingRows)) {
        $duplicateErrors = [];

        foreach ($existingRows as $row) {
            $rowNif         = strtoupper(trim($row['nif_pasaporte'] ?? ''));
            $rowEmail       = strtolower(trim($row['email'] ?? ''));
            $rowPhoneRaw    = trim($row['telefono'] ?? '');
            $rowPhoneClean  = preg_replace('/[\s\-\.\+\(\)]/', '', $rowPhoneRaw);
            $rowPhoneDigits = preg_replace('/[^0-9]/', '', $rowPhoneRaw);
            $rowPhoneLast9  = (strlen($rowPhoneDigits) >= 9) ? substr($rowPhoneDigits, -9) : $rowPhoneDigits;

            // 1. Verificación de NIF duplicado
            if (!empty($nifNormalized) && $rowNif === $nifNormalized) {
                $duplicateErrors['nif_pasaporte'] = 'Ya existe una inscripción registrada con este NIF / CIF / Pasaporte.';
            }

            // 2. Verificación de Correo electrónico duplicado
            if (!empty($emailNormalized) && $rowEmail === $emailNormalized) {
                $duplicateErrors['email'] = 'Ya existe una inscripción registrada con este correo electrónico.';
            }

            // 3. Verificación de Teléfono móvil duplicado
            $phoneMatched = false;
            if (!empty($telefono)) {
                if ($rowPhoneRaw === $telefono || (!empty($phoneClean) && $rowPhoneClean === $phoneClean)) {
                    $phoneMatched = true;
                } elseif (!empty($phoneDigits) && !empty($rowPhoneDigits) && $phoneDigits === $rowPhoneDigits) {
                    $phoneMatched = true;
                } elseif (strlen($phoneLast9) >= 9 && strlen($rowPhoneLast9) >= 9 && $phoneLast9 === $rowPhoneLast9) {
                    $phoneMatched = true;
                }
            }

            if ($phoneMatched) {
                $duplicateErrors['telefono'] = 'Ya existe una inscripción registrada con este número de teléfono móvil.';
            }
        }

        if (!empty($duplicateErrors)) {
            $dupLabels = [];
            if (isset($duplicateErrors['nif_pasaporte'])) $dupLabels[] = 'NIF/Pasaporte';
            if (isset($duplicateErrors['email']))         $dupLabels[] = 'correo electrónico';
            if (isset($duplicateErrors['telefono']))      $dupLabels[] = 'número de móvil';

            $summaryMsg = 'Ya existe una inscripción registrada en el sistema con el mismo ' . implode(', ', $dupLabels) . '. Si necesitas consultar o modificar tu inscripción, ponte en contacto con la organización.';

            // Registrar aviso en el log de auditoría
            logWarning('inscripciones', 'registro_duplicado', "Intento de inscripción duplicada para {$nombre} {$apellidos}: " . implode(', ', $dupLabels), [
                'nombre'            => $nombre,
                'apellidos'         => $apellidos,
                'nif_pasaporte'     => $nifPasaporte,
                'email'             => $email,
                'telefono'          => $telefono,
                'campos_duplicados' => array_keys($duplicateErrors),
                'ip'                => $ipRegistro
            ], $isAuthorizedOperator ? (int)($op['id'] ?? null) : null);

            sendJsonResponse([
                'success'   => false,
                'duplicado' => true,
                'message'   => $summaryMsg,
                'errors'    => $duplicateErrors
            ], 409);
        }
    }
} catch (PDOException $e) {
    logError('inscripciones', 'error_bd_check_duplicados', $e->getMessage(), [
        'nif'   => $nifNormalized,
        'email' => $emailNormalized
    ]);
    sendJsonResponse([
        'success' => false,
        'message' => 'Error interno al verificar datos existentes. Por favor, inténtalo de nuevo más tarde.'
    ], 500);
}

// =====================================================================
// INSERCIÓN DE LA INSCRIPCIÓN EN MARIADB
// =====================================================================
try {
    $stmt = $pdo->prepare("
        INSERT INTO `enmi_inscripciones` 
            (`nombre`, `apellidos`, `nombre_artistico`, `nif_pasaporte`, `email`, `telefono`, `origen`, `asociacion`, `quiero_participar`, `acepta_privacidad`, `consentimiento_imagen`, `comentarios`, `estado`, `ip_registro`, `fecha_creacion`) 
        VALUES 
            (:nombre, :apellidos, :nombre_artistico, :nif_pasaporte, :email, :telefono, :origen, :asociacion, :quiero_participar, :acepta_privacidad, :consentimiento_imagen, :comentarios, 'iniciada', :ip_registro, NOW())
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

    $logMsg = "Nueva inscripción ID #{$insertedId} registrada para {$nombre} {$apellidos} [Estado: iniciada]";
    if ($nombreArtistico) {
        $logMsg .= " ({$nombreArtistico})";
    }
    if ($isAuthorizedOperator && !empty($op['login'])) {
        $logMsg .= " [Registrado por operador: {$op['login']} ({$op['rol']})]";
    }

    // Registrar log de nueva inscripción
    logInfo('inscripciones', 'registro_creado', $logMsg, [
        'id'                => $insertedId,
        'nombre'            => $nombre,
        'apellidos'         => $apellidos,
        'nombre_artistico'  => $nombreArtistico,
        'email'             => $email,
        'estado'            => 'iniciada',
        'quiero_participar' => $quieroParticipar,
        'operador'          => $isAuthorizedOperator ? ($op['login'] ?? null) : null
    ], $isAuthorizedOperator ? (int)($op['id'] ?? null) : null);

    $emailPayload = [
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
        'estado'                => 'iniciada',
        'ip_registro'           => $ipRegistro,
        'fecha'                 => date('d/m/Y H:i:s')
    ];

    // 1. Notificación a administradores de inscripción iniciada
    $adminEmailResult = sendRegistrationNotification($emailPayload);

    // Registrar log del resultado del envío a los administradores
    logNotification(
        'notificacion_inscripcion_admin',
        $adminEmailResult['message'] ?? 'Envío de correo de notificación a administradores',
        ['inscripcion_id' => $insertedId, 'detalle' => $adminEmailResult],
        $adminEmailResult['success'] ?? false
    );

    sendJsonResponse([
        'success'            => true,
        'message'            => 'Inscripción iniciada correctamente. Procede a seleccionar la modalidad de pago.',
        'id'                 => $insertedId,
        'estado'             => 'iniciada',
        'data'               => [
            'id'                => $insertedId,
            'nombre'            => $nombre,
            'apellidos'         => $apellidos,
            'nombre_artistico'  => $nombreArtistico,
            'email'             => $email,
            'estado'            => 'iniciada',
            'quiero_participar' => (bool)$quieroParticipar
        ],
        'notificacion_admin' => [
            'enviada' => $adminEmailResult['success'] ?? false,
            'mensaje' => $adminEmailResult['message'] ?? ''
        ]
    ], 201);

} catch (PDOException $e) {
    // Si la BD devuelve error de clave duplicada (código 23000 / 1062)
    if ($e->getCode() === '23000' || $e->getCode() === 23000 || ($e->errorInfo[1] ?? 0) === 1062) {
        logWarning('inscripciones', 'registro_duplicado_bd', $e->getMessage(), [
            'nombre'    => $nombre,
            'apellidos' => $apellidos,
            'email'     => $email
        ]);
        sendJsonResponse([
            'success'   => false,
            'duplicado' => true,
            'message'   => 'Ya existe una inscripción registrada en el sistema con estos datos identificativos (NIF, email o teléfono).',
            'errors'    => [
                'nif_pasaporte' => 'Verifica si ya te has registrado con este NIF / CIF / Pasaporte.',
                'email'         => 'Verifica si ya te has registrado con esta dirección de email.',
                'telefono'      => 'Verifica si ya te has registrado con este teléfono.'
            ]
        ], 409);
    }

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


