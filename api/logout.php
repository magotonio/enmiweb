<?php

require_once __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    sendJsonResponse(['success' => false, 'message' => 'Método no permitido.'], 405);
}

requireApiCsrfToken();
clearApiSession();
sendJsonResponse(['success' => true, 'message' => 'Sesión cerrada.']);