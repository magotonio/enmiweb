<?php
/**
 * Endpoint de Registro de Inscripciones
 * Método: POST
 * Payload esperado: JSON { "nombre": "...", "apellidos": "..." }
 */

require_once __DIR__ . '/config.php';

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

// Extraer y sanitizar campos
$nombre = isset($data['nombre']) ? trim((string)$data['nombre']) : '';
$apellidos = isset($data['apellidos']) ? trim((string)$data['apellidos']) : '';

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

if (!empty($errors)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Errores de validación en el formulario.',
        'errors' => $errors
    ], 400);
}

// Obtener IP del cliente
$ipRegistro = getClientIp();

// Insertar en la base de datos MariaDB
$pdo = getDbConnection();

try {
    $stmt = $pdo->prepare("
        INSERT INTO `enmi_inscripciones` 
            (`nombre`, `apellidos`, `estado`, `ip_registro`, `fecha_creacion`) 
        VALUES 
            (:nombre, :apellidos, 'activo', :ip_registro, NOW())
    ");

    $stmt->execute([
        ':nombre'      => $nombre,
        ':apellidos'   => $apellidos,
        ':ip_registro' => $ipRegistro
    ]);

    $insertedId = (int)$pdo->lastInsertId();

    sendJsonResponse([
        'success' => true,
        'message' => 'Inscripción guardada correctamente.',
        'id'      => $insertedId,
        'data'    => [
            'nombre'    => $nombre,
            'apellidos' => $apellidos
        ]
    ], 201);

} catch (PDOException $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error al registrar la inscripción en la base de datos: ' . $e->getMessage()
    ], 500);
}
