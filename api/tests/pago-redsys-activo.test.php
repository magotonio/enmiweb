<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$casos = [
    'info por defecto' => [null, 'info', 200],
    'info activado' => ['1', 'info', 200],
    'info desactivado' => ['0', 'info', 200],
    'inicio desactivado' => ['0', 'iniciar_redsys', 403],
    'simulador desactivado' => ['0', 'simular_redsys', 403],
    'inicio activado conserva validacion' => ['1', 'iniciar_redsys', 400],
    'inicio por defecto conserva validacion' => [null, 'iniciar_redsys', 400],
    'retorno desactivado conserva validacion' => ['0', 'redsys_retorno', 400],
    'retorno activado conserva validacion' => ['1', 'redsys_retorno', 400],
    'valor inesperado no habilita pagos' => ['invalido', 'iniciar_redsys', 403]
];

if (!isset($argv[1])) {
    foreach (array_keys($casos) as $nombre) {
        $salida = [];
        exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($nombre) . ' 2>&1', $salida, $codigo);
        if ($codigo !== 0) {
            fwrite(STDERR, implode("\n", $salida) . "\n");
            exit(1);
        }
    }
    echo count($casos) . " pruebas de activacion de Redsys: OK\n";
    exit;
}

if (!isset($casos[$argv[1]])) {
    throw new InvalidArgumentException('Caso desconocido.');
}

require_once dirname(__DIR__) . '/config.php';
restore_exception_handler();
restore_error_handler();

[$valor, $accion, $estadoEsperado] = $casos[$argv[1]];
$pdo = getDbConnection();
// La tabla temporal y la cache por peticion aislan las pruebas sin modificar configuracion real.
$pdo->exec('CREATE TEMPORARY TABLE enmi_configuracion (clave VARCHAR(100), valor TEXT)');
if ($valor !== null) {
    $stmt = $pdo->prepare('INSERT INTO enmi_configuracion (clave, valor) VALUES (?, ?)');
    $stmt->execute(['pago_redsys_activo', $valor]);
}
getDbConfig($pdo);

$_SERVER['REQUEST_METHOD'] = $accion === 'info' ? 'GET' : 'POST';
$_GET = ['accion' => $accion];
$_POST = ['accion' => $accion, 'inscripcion_id' => 0];

ob_start();
register_shutdown_function(function () use ($valor, $accion, $estadoEsperado): void {
    $respuesta = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if (http_response_code() !== $estadoEsperado) {
        throw new RuntimeException("Estado inesperado para {$accion}: " . json_encode($respuesta));
    }
    if ($accion === 'info') {
        if ($respuesta['success'] !== true || $respuesta['redsys']['activo'] !== ($valor !== '0')) {
            throw new RuntimeException('Activacion publica incorrecta.');
        }
        foreach (['bizum', 'transferencia', 'otras'] as $modalidad) {
            if (!isset($respuesta[$modalidad])) {
                throw new RuntimeException("Falta la modalidad {$modalidad}.");
            }
        }
    } elseif ($respuesta['success'] !== false) {
        throw new RuntimeException('La peticion no debe completarse con exito.');
    } elseif ($estadoEsperado === 403 && !str_contains($respuesta['message'], 'desactivado')) {
        throw new RuntimeException('El rechazo debe proceder del control de activacion.');
    } elseif ($accion === 'redsys_retorno' && $respuesta['message'] !== 'Parámetros Redsys ausentes.') {
        throw new RuntimeException('Los retornos deben seguir llegando a la validacion de Redsys.');
    }
});

require dirname(__DIR__) . '/pago.php';
