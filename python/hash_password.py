#!/usr/bin/env python3
"""
Generador y Verificador de Contraseñas Encriptadas para ENMI Web
================================================================
Genera hashes Bcrypt (compatibles 100% con password_hash() de PHP)
y proporciona sentencias SQL listas para actualizar en la base de datos MariaDB.

Uso:
    py python/hash_password.py
    py python/hash_password.py MiPassword123
    py python/hash_password.py --password "Admin.123"
    py python/hash_password.py --verify "Admin.123" "$2y$10$..."
    py python/hash_password.py "MiPassword123" --user "admin"
"""

import sys
import getpass
import argparse

# Asegurar compatibilidad de codificación UTF-8 en consola de Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

try:
    import bcrypt
except ImportError:
    print("\n[!] El modulo 'bcrypt' no esta instalado en este interprete de Python.")
    print("    Para instalarlo, ejecuta en tu terminal:")
    print("    pip install bcrypt\n")
    sys.exit(1)


def generate_bcrypt_hash(password: str, cost: int = 10) -> dict:
    """
    Genera un hash Bcrypt compatible con PHP PASSWORD_BCRYPT ($2y$).
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=cost, prefix=b'2b')
    raw_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    
    # PHP usa tradicionalmente el prefijo $2y$, mientras que bcrypt de Python usa $2b$.
    # Ambos son compatibles con password_verify() de PHP.
    php_hash = raw_hash.replace('$2b$', '$2y$', 1)
    
    return {
        'php_hash': php_hash,
        'raw_hash': raw_hash,
        'cost': cost
    }


def verify_password(password: str, hash_str: str) -> bool:
    """
    Comprueba si una contraseña coincide con un hash Bcrypt ($2y$ o $2b$ o $2a$).
    """
    password_bytes = password.encode('utf-8')
    # Normalizar $2y$ a $2b$ para la librería bcrypt de Python
    normalized_hash = hash_str.replace('$2y$', '$2b$', 1).encode('utf-8')
    try:
        return bcrypt.checkpw(password_bytes, normalized_hash)
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generador y Verificador de Contraseñas Bcrypt para ENMI Web"
    )
    parser.add_argument('plain_password', nargs='?', help='Contraseña en texto plano a encriptar')
    parser.add_argument('-p', '--password', dest='flag_password', help='Contraseña a encriptar')
    parser.add_argument('-v', '--verify', nargs=2, metavar=('PASSWORD', 'HASH'), help='Verifica si una contraseña coincide con un hash')
    parser.add_argument('-u', '--user', dest='username', help='Nombre de usuario para generar la sentencia SQL (ej: admin)')
    parser.add_argument('-c', '--cost', type=int, default=10, help='Coste computacional de Bcrypt (por defecto 10)')

    args = parser.parse_args()

    # Modo 1: Verificación de contraseña contra hash
    if args.verify:
        pwd_to_test, hash_to_test = args.verify
        is_valid = verify_password(pwd_to_test, hash_to_test)
        print("\n" + "=" * 65)
        print(" VERIFICACION DE CONTRASEÑA ENCRIPTADA")
        print("=" * 65)
        print(f" Contraseña probada : {pwd_to_test}")
        print(f" Hash evaluado      : {hash_to_test}")
        print("-" * 65)
        if is_valid:
            print(" [OK] RESULTADO: ¡La contraseña es CORRECTA y coincide con el hash!")
        else:
            print(" [FAIL] RESULTADO: La contraseña NO coincide con el hash proporcionado.")
        print("=" * 65 + "\n")
        return

    # Modo 2: Obtener contraseña a encriptar
    pwd = args.flag_password or args.plain_password

    if not pwd:
        print("\n" + "=" * 65)
        print(" ENCRIPTADOR DE CONTRASEÑAS PARA ENMI WEB (Bcrypt / PHP)")
        print("=" * 65)
        try:
            pwd = getpass.getpass(" Introduce la contraseña a encriptar (oculta): ")
            if not pwd:
                pwd = input(" Introduce la contraseña (visible): ")
        except (KeyboardInterrupt, EOFError):
            print("\nOperación cancelada.")
            return

    pwd = pwd.strip()
    if not pwd:
        print("\n[!] Error: La contraseña no puede estar vacía.\n")
        return

    # Generar hash
    result = generate_bcrypt_hash(pwd, cost=args.cost)
    php_hash = result['php_hash']
    username = args.username or "admin"

    # Verificar que el hash generado sea 100% válido
    verification_ok = verify_password(pwd, php_hash)

    print("\n" + "=" * 65)
    print(" RESULTADO DE ENCRIPTACION DE CONTRASEÑA")
    print("=" * 65)
    print(f" Contraseña en texto plano : {pwd}")
    print(f" Algoritmo                  : BCRYPT (coste {result['cost']})")
    print(f" Compatibilidad             : PHP password_hash() / MariaDB")
    print(f" Verificación interna       : {'CORRECTA [OK]' if verification_ok else 'FALLIDA [FAIL]'}")
    print("-" * 65)
    print(" HASH ENCRIPTADO PARA LA WEB / BASE DE DATOS:")
    print(f"\n   {php_hash}\n")
    print("-" * 65)
    print(" SENTENCIA SQL PARA ACTUALIZAR EN MARIADB (phpMyAdmin):")
    print(f"\n   UPDATE `enmi_usuarios`")
    print(f"   SET `password_hash` = '{php_hash}', `bloqueado` = 0, `intentos_fallidos` = 0")
    print(f"   WHERE `login` = '{username}';\n")
    print("=" * 65 + "\n")


if __name__ == '__main__':
    main()
