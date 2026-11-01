<?php

function clasificarRegistroPago(array $pago): array {
    $datos = $pago['datos_transaccion'] ?? null;
    if (is_string($datos) && trim($datos) !== '') {
        $datos = json_decode($datos, true, 512, JSON_THROW_ON_ERROR);
    }
    $datos = is_array($datos) ? $datos : [];
    $referencia = (string)($pago['referencia'] ?? '');
    $estadoPagado = in_array($pago['estado'] ?? '', ['pagado', 'pagada'], true);

    // Los registros anteriores ya guardaban el origen en los datos de auditoria.
    if (($datos['tipo_registro'] ?? '') === 'manual_administracion' || str_starts_with($referencia, 'ENMI-MAN-')) {
        $tipo = 'manual_administracion';
    } elseif (!empty($datos['simulador']) || str_starts_with($referencia, 'SIM-')) {
        $tipo = 'simulacion';
    } elseif (($datos['tipo_registro'] ?? '') === 'promesa' || ($datos['origen'] ?? '') === 'confirmar_modalidad') {
        $tipo = 'promesa';
    } elseif (($pago['modalidad_pago'] ?? '') === 'redsys') {
        $tipo = 'redsys';
    } elseif (!$estadoPagado && in_array($pago['modalidad_pago'] ?? '', ['bizum', 'transferencia', 'otras'], true)) {
        $tipo = 'promesa';
    } else {
        $tipo = 'desconocido';
    }

    return [
        'tipo_registro' => $tipo,
        'pago_confirmado' => $estadoPagado && in_array($tipo, ['manual_administracion', 'redsys'], true)
    ];
}
