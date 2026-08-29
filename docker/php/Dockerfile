FROM php:8.2-apache

# Instalar extensiones necesarias de PHP para MariaDB / MySQL
RUN docker-php-ext-install pdo pdo_mysql

# Instalar Xdebug para depuración paso a paso desde VS Code
RUN pecl install xdebug && docker-php-ext-enable xdebug

# Copiar configuración personalizada de Xdebug
COPY docker/php/xdebug.ini /usr/local/etc/php/conf.d/99-xdebug.ini

# Habilitar módulos de Apache útiles para APIs REST (reescritura y cabeceras)
RUN a2enmod rewrite headers

# Configuración de Apache para permitir .htaccess y enrutamiento
RUN sed -ri -e 's!/var/www/html!/var/www/html!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

EXPOSE 80


