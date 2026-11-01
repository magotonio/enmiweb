<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/pago-registro.php';

$casos = [
    'promesa nueva' => [
        ['modalidad_pago' => 'bizum', 'estado' => 'no-pagado', 'datos_transaccion' => ['tipo_registro' => 'promesa']],
        'promesa', false
    ],
    'promesa historica' => [
        ['modalidad_pago' => 'transferencia', 'estado' => 'no-pagado', 'datos_transaccion' => '{"origen":"confirmar_modalidad"}'],
        'promesa', false
    ],
    'otras sin metadatos' => [
        ['modalidad_pago' => 'otras', 'estado' => 'no-pagado'],
        'promesa', false
    ],
    'metadatos vacios historicos' => [
        ['modalidad_pago' => 'transferencia', 'estado' => 'no-pagado', 'datos_transaccion' => ''],
        'promesa', false
    ],
    'promesa no acredita cobro aunque cambie su estado' => [
        ['modalidad_pago' => 'bizum', 'estado' => 'pagado', 'datos_transaccion' => ['tipo_registro' => 'promesa']],
        'promesa', false
    ],
    'cobro manual' => [
        ['modalidad_pago' => 'transferencia', 'estado' => 'pagado', 'datos_transaccion' => '{"tipo_registro":"manual_administracion","admin_rol":"supervisor"}'],
        'manual_administracion', true
    ],
    'cobro manual por referencia historica' => [
        ['modalidad_pago' => 'efectivo', 'estado' => 'pagado', 'referencia' => 'ENMI-MAN-EFE-42-ABC123'],
        'manual_administracion', true
    ],
    'tarjeta anotada por administracion no es validacion de pasarela' => [
        ['modalidad_pago' => 'redsys', 'estado' => 'pagado', 'datos_transaccion' => ['tipo_registro' => 'manual_administracion']],
        'manual_administracion', true
    ],
    'manual no pagado' => [
        ['modalidad_pago' => 'transferencia', 'estado' => 'no-pagado', 'datos_transaccion' => ['tipo_registro' => 'manual_administracion']],
        'manual_administracion', false
    ],
    'tarjeta validada' => [
        ['modalidad_pago' => 'redsys', 'estado' => 'pagado'],
        'redsys', true
    ],
    'tarjeta pendiente o fallida' => [
        ['modalidad_pago' => 'redsys', 'estado' => 'no-pagado'],
        'redsys', false
    ],
    'antigua seleccion redsys no es validacion' => [
        ['modalidad_pago' => 'redsys', 'estado' => 'no-pagado', 'datos_transaccion' => ['origen' => 'confirmar_modalidad']],
        'promesa', false
    ],
    'simulacion exitosa' => [
        ['modalidad_pago' => 'redsys', 'estado' => 'pagado', 'datos_transaccion' => ['simulador' => true]],
        'simulacion', false
    ],
    'simulacion historica' => [
        ['modalidad_pago' => 'redsys', 'estado' => 'pagado', 'referencia' => 'SIM-261101000042-ABCD'],
        'simulacion', false
    ],
    'origen desconocido no acredita cobro' => [
        ['modalidad_pago' => 'otras', 'estado' => 'pagado'],
        'desconocido', false
    ]
];

foreach ($casos as $nombre => [$registro, $tipo, $confirmado]) {
    $resultado = clasificarRegistroPago($registro);
    if ($resultado !== ['tipo_registro' => $tipo, 'pago_confirmado' => $confirmado]) {
        throw new RuntimeException("Fallo en {$nombre}: " . json_encode($resultado));
    }
}

try {
    clasificarRegistroPago(['datos_transaccion' => '{JSON invalido']);
    throw new RuntimeException('Los metadatos corruptos deben provocar un error explicito.');
} catch (JsonException $e) {
    // El endpoint registra el error y responde sin acreditar el cobro.
}

echo count($casos) . " clasificaciones y rechazo de JSON invalido: OK\n";
