<?php
/**
 * Servicio de Envío de Correos Electrónicos vía SMTP (Nativo PHP 8.2+)
 * Sin dependencias externas pesadas, compatible con hosting compartido (Dinahosting) y Docker.
 */

require_once __DIR__ . '/config.php';

/**
 * Envía un correo electrónico a uno o más destinatarios a través de un servidor SMTP con autenticación.
 *
 * @param array  $smtpConfig Configuración SMTP (host, port, secure, auth, user, pass, from_email, from_name)
 * @param array  $toEmails   Array de direcciones de correo de destino
 * @param string $subject    Asunto del mensaje
 * @param string $htmlBody   Cuerpo en formato HTML
 * @param string $textBody   Cuerpo alternativo en texto plano
 * @return array ['success' => bool, 'message' => string, 'details' => array]
 */
function sendSmtpEmail(
    array $smtpConfig,
    array $toEmails,
    string $subject,
    string $htmlBody,
    string $textBody = ''
): array {
    $toEmails = array_values(array_filter(array_map('trim', $toEmails)));
    if (empty($toEmails)) {
        return [
            'success' => false,
            'message' => 'No se especificaron direcciones de correo de destino.'
        ];
    }

    $host = (string)($smtpConfig['host'] ?? 'localhost');
    $port = (int)($smtpConfig['port'] ?? 465);
    $secure = strtolower((string)($smtpConfig['secure'] ?? 'ssl'));
    $timeout = 15; // segundos

    // Determinar esquema de conexión según protocolo de seguridad y puerto
    if ($secure === 'ssl' || $port === 465) {
        $protocol = 'ssl://';
    } else {
        $protocol = 'tcp://';
    }

    $target = $protocol . $host . ':' . $port;

    $context = stream_context_create([
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true
        ]
    ]);

    $socket = @stream_socket_client($target, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        return [
            'success' => false,
            'message' => "Error al conectar con el servidor SMTP ({$host}:{$port}): [{$errno}] {$errstr}"
        ];
    }

    stream_set_timeout($socket, $timeout);

    // Función auxiliar para leer la respuesta multilínea del servidor SMTP
    $readResponse = function() use ($socket): string {
        $response = '';
        while (!feof($socket)) {
            $line = fgets($socket, 1024);
            if ($line === false) {
                break;
            }
            $response .= $line;
            // Si el cuarto caracter es espacio o no hay guión, es la última línea de respuesta
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
            if (strlen(trim($line)) < 4) {
                break;
            }
        }
        return trim($response);
    };

    // Función auxiliar para enviar un comando SMTP y comprobar el código de respuesta esperado
    $sendCommand = function(string $command, array $expectedCodes) use ($socket, $readResponse): array {
        fwrite($socket, $command . "\r\n");
        $res = $readResponse();
        $code = (int)substr($res, 0, 3);
        $ok = in_array($code, $expectedCodes, true);
        return [
            'ok'       => $ok,
            'code'     => $code,
            'response' => $res
        ];
    };

    try {
        // 1. Saludo inicial del servidor
        $greeting = $readResponse();
        if ((int)substr($greeting, 0, 3) !== 220) {
            throw new RuntimeException("Respuesta inesperada al conectar con SMTP: " . $greeting);
        }

        // 2. Comando EHLO
        $clientHost = gethostname() ?: 'localhost';
        $ehloRes = $sendCommand("EHLO " . $clientHost, [250]);
        if (!$ehloRes['ok']) {
            // Intentar HELO de respaldo
            $heloRes = $sendCommand("HELO " . $clientHost, [250]);
            if (!$heloRes['ok']) {
                throw new RuntimeException("Error en EHLO/HELO: " . $ehloRes['response']);
            }
        }

        // 3. Soporte STARTTLS si se requiere y no se conectó por SSL directo
        if ($secure === 'tls' && $protocol === 'tcp://') {
            $tlsRes = $sendCommand("STARTTLS", [220]);
            if (!$tlsRes['ok']) {
                throw new RuntimeException("Error al iniciar STARTTLS: " . $tlsRes['response']);
            }
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException("Fallo al negociar cifrado TLS en el socket SMTP.");
            }
            // Repetir EHLO tras establecer TLS
            $sendCommand("EHLO " . $clientHost, [250]);
        }

        // 4. Autenticación SMTP (AUTH LOGIN)
        if (!empty($smtpConfig['auth'])) {
            $authRes = $sendCommand("AUTH LOGIN", [334]);
            if (!$authRes['ok']) {
                throw new RuntimeException("El servidor rechazó AUTH LOGIN: " . $authRes['response']);
            }

            $user64 = base64_encode((string)$smtpConfig['user']);
            $userRes = $sendCommand($user64, [334]);
            if (!$userRes['ok']) {
                throw new RuntimeException("Error enviando usuario SMTP: " . $userRes['response']);
            }

            $pass64 = base64_encode((string)$smtpConfig['pass']);
            $passRes = $sendCommand($pass64, [235]);
            if (!$passRes['ok']) {
                throw new RuntimeException("Fallo de autenticación SMTP: " . $passRes['response']);
            }
        }

        // 5. MAIL FROM
        $fromEmail = (string)($smtpConfig['from_email'] ?? $smtpConfig['user'] ?? 'no-reply@enmi.es');
        $fromName  = (string)($smtpConfig['from_name'] ?? 'Eutikea - ENMI');
        $mailFromRes = $sendCommand("MAIL FROM:<{$fromEmail}>", [250]);
        if (!$mailFromRes['ok']) {
            throw new RuntimeException("Error en MAIL FROM: " . $mailFromRes['response']);
        }

        // 6. RCPT TO (para cada destinatario)
        $validRecipients = 0;
        foreach ($toEmails as $recipient) {
            $rcptRes = $sendCommand("RCPT TO:<{$recipient}>", [250, 251]);
            if ($rcptRes['ok']) {
                $validRecipients++;
            }
        }

        if ($validRecipients === 0) {
            throw new RuntimeException("Ningún destinatario fue aceptado por el servidor SMTP.");
        }

        // 7. DATA
        $dataRes = $sendCommand("DATA", [354]);
        if (!$dataRes['ok']) {
            throw new RuntimeException("Error al iniciar bloque DATA: " . $dataRes['response']);
        }

        // 8. Construir Cabeceras y Cuerpo MIME Multipart
        $boundary = '=_enmi_boundary_' . md5(uniqid((string)mt_rand(), true));
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedFromName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
        $toList = implode(', ', $toEmails);
        $dateStr = date(DATE_RFC2822);
        $messageId = sprintf("<%s.%s@%s>", bin2hex(random_bytes(8)), time(), parse_url('https://' . $host, PHP_URL_HOST) ?: 'enmi.es');

        if (empty($textBody)) {
            $textBody = strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>'], "\n", $htmlBody));
        }

        $headers = [];
        $headers[] = "Date: {$dateStr}";
        $headers[] = "From: {$encodedFromName} <{$fromEmail}>";
        $headers[] = "To: {$toList}";
        $headers[] = "Subject: {$encodedSubject}";
        $headers[] = "Message-ID: {$messageId}";
        $headers[] = "MIME-Version: 1.0";
        $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";
        $headers[] = "X-Mailer: ENMI-Mailer-PHP8";

        $bodyLines = [];
        $bodyLines[] = "--{$boundary}";
        $bodyLines[] = "Content-Type: text/plain; charset=UTF-8";
        $bodyLines[] = "Content-Transfer-Encoding: 8bit";
        $bodyLines[] = "";
        $bodyLines[] = $textBody;
        $bodyLines[] = "";
        $bodyLines[] = "--{$boundary}";
        $bodyLines[] = "Content-Type: text/html; charset=UTF-8";
        $bodyLines[] = "Content-Transfer-Encoding: 8bit";
        $bodyLines[] = "";
        $bodyLines[] = $htmlBody;
        $bodyLines[] = "";
        $bodyLines[] = "--{$boundary}--";

        $fullPayload = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $bodyLines);

        // Dot-stuffing (escapar líneas que comiencen con punto único)
        $fullPayload = preg_replace('/^\./m', '..', $fullPayload);

        // Enviar contenido terminado con "\r\n.\r\n"
        fwrite($socket, $fullPayload . "\r\n.\r\n");
        $endDataRes = $readResponse();
        $endCode = (int)substr($endDataRes, 0, 3);
        if ($endCode !== 250) {
            throw new RuntimeException("El servidor rechazó el contenido del mensaje: " . $endDataRes);
        }

        // 9. Cerrar sesión amablemente
        $sendCommand("QUIT", [221]);
        @fclose($socket);

        return [
            'success'    => true,
            'message'    => 'Correo enviado exitosamente vía SMTP.',
            'recipients' => $toEmails
        ];

    } catch (Exception $e) {
        @fclose($socket);
        return [
            'success' => false,
            'message' => $e->getMessage()
        ];
    }
}

/**
 * Construye la plantilla HTML y envía el correo de notificación de nueva inscripción.
 *
 * @param array $data Datos de la inscripción (id, nombre, apellidos, ip_registro, fecha_creacion)
 * @return array Resultado del envío
 */
function sendRegistrationNotification(array $data): array {
    $notificationEmails = getNotificationEmails();
    if (empty($notificationEmails)) {
        return [
            'success' => true,
            'skipped' => true,
            'message' => 'No hay direcciones de notificación configuradas.'
        ];
    }

    $smtpConfig = getSmtpConfig();

    $id = htmlspecialchars((string)($data['id'] ?? 'N/A'), ENT_QUOTES, 'UTF-8');
    $nombre = htmlspecialchars((string)($data['nombre'] ?? ''), ENT_QUOTES, 'UTF-8');
    $apellidos = htmlspecialchars((string)($data['apellidos'] ?? ''), ENT_QUOTES, 'UTF-8');
    $nombreArtistico = !empty($data['nombre_artistico']) ? htmlspecialchars((string)$data['nombre_artistico'], ENT_QUOTES, 'UTF-8') : '';
    $nifPasaporte = htmlspecialchars((string)($data['nif_pasaporte'] ?? 'N/D'), ENT_QUOTES, 'UTF-8');
    $email = htmlspecialchars((string)($data['email'] ?? 'N/D'), ENT_QUOTES, 'UTF-8');
    $telefono = htmlspecialchars((string)($data['telefono'] ?? 'N/D'), ENT_QUOTES, 'UTF-8');
    $origen = htmlspecialchars((string)($data['origen'] ?? 'N/D'), ENT_QUOTES, 'UTF-8');
    $asociacion = !empty($data['asociacion']) ? htmlspecialchars((string)$data['asociacion'], ENT_QUOTES, 'UTF-8') : 'Ninguna / No especificada';
    $quieroParticipar = !empty($data['quiero_participar']);
    $consentimientoImagen = !empty($data['consentimiento_imagen']);
    $comentarios = !empty($data['comentarios']) ? nl2br(htmlspecialchars((string)$data['comentarios'], ENT_QUOTES, 'UTF-8')) : '';
    $comentariosRaw = !empty($data['comentarios']) ? (string)$data['comentarios'] : 'Sin comentarios adicionales';

    $nombreCompleto = trim($nombre . ' ' . $apellidos);
    $ip = htmlspecialchars((string)($data['ip_registro'] ?? 'Desconocida'), ENT_QUOTES, 'UTF-8');
    $fecha = !empty($data['fecha']) ? (string)$data['fecha'] : date('d/m/Y H:i:s');

    $appUrl = rtrim(getAppUrl(), '/');
    $adminUrl = $appUrl . '/admin/inscritos';

    $subjectTitle = $nombreCompleto;
    if ($nombreArtistico !== '') {
        $subjectTitle .= " ({$nombreArtistico})";
    }
    $subject = "Nueva Inscripción ENMI: {$subjectTitle} (ID #{$id})";

    $participarHtml = $quieroParticipar
        ? '<span style="display: inline-block; padding: 4px 10px; background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; border-radius: 9999px; font-weight: 700; font-size: 12px;">SÍ, QUIERE PARTICIPAR ACTIVAMENTE</span>'
        : '<span style="color: #64748b; font-size: 13px;">No / Asistente regular</span>';

    $imagenHtml = $consentimientoImagen
        ? '<span style="color: #16a34a; font-weight: 600;">Consentido</span>'
        : '<span style="color: #64748b;">No otorgado</span>';

    $htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva Inscripción ENMI</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
                    <!-- Cabecera -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #001F5B 0%, #0d2c6e 100%); padding: 32px 28px; text-align: center;">
                            <div style="display: inline-block; padding: 6px 14px; background-color: rgba(212, 175, 55, 0.2); border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 9999px; margin-bottom: 12px;">
                                <span style="color: #D4AF37; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Notificación Oficial</span>
                            </div>
                            <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">¡Nueva Inscripción Recibida!</h1>
                            <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Encuentro Nacional de Magos Infantiles</p>
                        </td>
                    </tr>
                    
                    <!-- Cuerpo del contenido -->
                    <tr>
                        <td style="padding: 28px 28px 24px 28px;">
                            <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
                                Se ha registrado un nuevo participante en la plataforma web. A continuación se detallan los datos recibidos:
                            </p>
                            
                            <!-- Tarjeta de Datos -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; font-size: 14px;">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        ID de Registro
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #001F5B; font-weight: 700; font-family: monospace;">
                                        #{$id}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Nombre y Apellidos
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">
                                        {$nombre} {$apellidos}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Nombre Artístico
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #001F5B; font-weight: 700;">
                                        {$nombreArtistico}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        NIF / Pasaporte
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155; font-family: monospace;">
                                        {$nifPasaporte}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Correo Electrónico
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">
                                        <a href="mailto:{$email}" style="color: #0284c7; text-decoration: none; font-weight: 600;">{$email}</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Teléfono Móvil
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">
                                        {$telefono}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Lugar de Residencia
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">
                                        {$origen}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Círculo / Asociación
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">
                                        {$asociacion}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Participación Activa
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        {$participarHtml}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Derechos de Imagen
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">
                                        {$imagenHtml}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Comentarios / Notas
                                    </td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155; font-style: italic;">
                                        {$comentarios}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                        Fecha / IP
                                    </td>
                                    <td style="padding: 12px 16px; color: #64748b; font-size: 12px;">
                                        {$fecha} &bull; <span style="font-family: monospace;">{$ip}</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Botón de acción -->
                            <div style="text-align: center; margin: 28px 0 16px 0;">
                                <a href="{$adminUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #b38d1b 100%); color: #001F5B; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                                    Ver en Panel de Administración &rarr;
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Pie de página -->
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                                Este es un correo automático generado por el sistema de inscripciones de Eutikea.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;

    $participarText = $quieroParticipar ? 'SÍ, QUIERE PARTICIPAR ACTIVAMENTE' : 'No / Asistente regular';
    $imagenText = $consentimientoImagen ? 'Consentido' : 'No otorgado';

    $textBody = <<<TEXT
==================================================
¡NUEVA INSCRIPCIÓN RECIBIDA - ENMI!
==================================================

Se ha registrado una nueva persona en la web:

- ID de Registro: #{$id}
- Nombre y Apellidos: {$nombre} {$apellidos}
- Nombre Artístico: {$nombreArtistico}
- NIF / Pasaporte: {$nifPasaporte}
- Correo Electrónico: {$email}
- Teléfono Móvil: {$telefono}
- Lugar de Residencia: {$origen}
- Círculo / Asociación Mágica: {$asociacion}
- Quiero Participar Activamente: {$participarText}
- Consentimiento Derechos de Imagen: {$imagenText}
- Comentarios Adicionales: {$comentariosRaw}
- Fecha y Hora: {$fecha}
- IP de Registro: {$ip}

Puedes consultar y gestionar todos los registros en el Panel de Administración:
{$adminUrl}

---
Sistema de notificaciones automáticas de Eutikea.
TEXT;

    return sendSmtpEmail($smtpConfig, $notificationEmails, $subject, $htmlBody, $textBody);
}
