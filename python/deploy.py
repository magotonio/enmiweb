#!/usr/bin/env python3
"""
Script de Despliegue Automatizado a Producción (PRO)
===================================================
1. Compila el frontend Angular para producción (npm run build).
2. Conecta por FTP al servidor remoto.
3. Sube los archivos compilados del frontend a la raíz remota configurada.
4. Sube la carpeta 'api/' al servidor remoto, renombrando 'config.env.pro.php' a 'config.env.php'.

Uso:
    python python/deploy.py                # Despliegue completo (compilar + subir)
    python python/deploy.py --skip-build   # Subir sin compilar el frontend
    python python/deploy.py --test-conn    # Solo verificar credenciales y conexión FTP
    python python/deploy.py --dry-run      # Simular el proceso sin subir archivos
"""

import os
import sys
import time
import ftplib
import argparse
import subprocess
from pathlib import Path

# Asegurar codificación utf-8 si la terminal lo soporta
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ==============================================================================
# CONFIGURACIÓN DEL SERVIDOR FTP (PRODUCCIÓN)
# Ajusta estos valores según los datos de tu hosting (ej. Dinahosting / VPS)
# ==============================================================================
FTP_HOST = os.getenv("FTP_HOST", "eutikea-com.espacioseguro.com")
FTP_PORT = int(os.getenv("FTP_PORT", 21))
FTP_USER = os.getenv("FTP_USER", "eutikea")
FTP_PASS = os.getenv("FTP_PASS", "euTik3a$5202")

# Ruta remota donde se alojará la web (ej. '/httpdocs', '/public_html' o subcarpeta '/httpdocs/enmi')
FTP_REMOTE_DIR = os.getenv("FTP_REMOTE_DIR", "/www/webs/enmi")

# True si el servidor requiere FTPS (FTP sobre TLS/SSL), False para FTP estándar
USE_TLS = False

# Timeout de conexión en segundos
FTP_TIMEOUT = 30
# ==============================================================================


class Deployer:
    def __init__(self, project_root: Path, dry_run: bool = False):
        self.project_root = project_root
        self.dry_run = dry_run
        self.ftp = None

    def log(self, message: str, prefix: str = "[INFO]"):
        print(f"{prefix} {message}")

    def run_build(self) -> bool:
        """Ejecuta la compilación de Angular para producción."""
        self.log("=" * 60)
        self.log("PASO 1: Compilando Frontend Angular (npm run build)...")
        self.log("=" * 60)

        cmd = "npm run build"
        start_time = time.time()

        try:
            # En Windows usamos shell=True para invocar npm correctamente
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                shell=True,
                check=False,
                text=True
            )
            if result.returncode != 0:
                self.log(f"Error durante la compilación de Angular (código {result.returncode}).", "[ERROR]")
                return False

            elapsed = round(time.time() - start_time, 2)
            self.log(f"Compilación finalizada con éxito en {elapsed}s.\n", "[OK]")
            return True

        except Exception as e:
            self.log(f"Excepción al ejecutar '{cmd}': {e}", "[ERROR]")
            return False

    def connect_ftp(self) -> bool:
        """Establece la conexión con el servidor FTP."""
        self.log("=" * 60)
        self.log(f"PASO 2: Conectando a FTP {FTP_HOST}:{FTP_PORT} (Usuario: {FTP_USER})...")
        self.log("=" * 60)

        if self.dry_run:
            self.log("[DRY-RUN] Simulación de conexión FTP establecida.", "[OK]")
            return True

        try:
            if USE_TLS:
                self.ftp = ftplib.FTP_TLS(timeout=FTP_TIMEOUT)
                self.ftp.connect(FTP_HOST, FTP_PORT)
                self.ftp.login(FTP_USER, FTP_PASS)
                self.ftp.prot_p()  # Proteger canal de datos con TLS
            else:
                self.ftp = ftplib.FTP(timeout=FTP_TIMEOUT)
                self.ftp.connect(FTP_HOST, FTP_PORT)
                self.ftp.login(FTP_USER, FTP_PASS)

            self.ftp.encoding = "utf-8"
            welcome_msg = self.ftp.getwelcome()
            self.log(f"Conexión FTP exitosa:\n{welcome_msg.strip()}\n", "[OK]")
            return True

        except Exception as e:
            self.log(f"No se pudo conectar al servidor FTP: {e}", "[ERROR]")
            return False

    def ensure_remote_dir(self, remote_path: str):
        """Crea recursivamente la jerarquía de directorios remota si no existe."""
        if self.dry_run or not self.ftp:
            return

        parts = [p for p in remote_path.replace("\\", "/").split("/") if p]
        current = ""
        if remote_path.startswith("/"):
            current = "/"

        for part in parts:
            current = f"{current.rstrip('/')}/{part}"
            try:
                self.ftp.cwd(current)
            except ftplib.error_perm:
                try:
                    self.ftp.mkd(current)
                    self.ftp.cwd(current)
                except ftplib.error_perm:
                    pass

    def upload_file(self, local_file_path: Path, remote_file_name: str) -> bool:
        """Sube un archivo individual al directorio de trabajo remoto actual."""
        if self.dry_run:
            self.log(f"[DRY-RUN] Subir {local_file_path.name} -> {remote_file_name}")
            return True

        try:
            with open(local_file_path, "rb") as f:
                self.ftp.storbinary(f"STOR {remote_file_name}", f)
            return True
        except Exception as e:
            self.log(f"Error subiendo {local_file_path.name}: {e}", "[ERROR]")
            return False

    def upload_directory_tree(
        self,
        local_dir: Path,
        remote_base_dir: str,
        exclude_filenames: set = None,
        rename_filenames: dict = None
    ) -> int:
        """Recorre un directorio local y sube todos sus archivos y subcarpetas."""
        exclude_filenames = exclude_filenames or set()
        rename_filenames = rename_filenames or {}
        uploaded_count = 0

        for root, dirs, files in os.walk(local_dir):
            rel_path = Path(root).relative_to(local_dir)
            if str(rel_path) == ".":
                target_remote_dir = remote_base_dir
            else:
                target_remote_dir = f"{remote_base_dir.rstrip('/')}/{rel_path.as_posix()}"

            self.ensure_remote_dir(target_remote_dir)
            if not self.dry_run and self.ftp:
                self.ftp.cwd(target_remote_dir)

            for filename in files:
                if filename in exclude_filenames:
                    self.log(f"  - Omitido: {filename}")
                    continue

                dest_filename = rename_filenames.get(filename, filename)
                local_file_path = Path(root) / filename

                if dest_filename != filename:
                    self.log(f"  + Subiendo y renombrando: {filename} -> {dest_filename}")
                else:
                    self.log(f"  + Subiendo: {rel_path.as_posix()}/{filename}" if str(rel_path) != "." else f"  + Subiendo: {filename}")

                if self.upload_file(local_file_path, dest_filename):
                    uploaded_count += 1

        return uploaded_count

    def deploy_frontend(self) -> bool:
        """Localiza y sube la compilación del frontend a FTP_REMOTE_DIR."""
        self.log("=" * 60)
        self.log("PASO 3: Subiendo Frontend Compilado a Producción...")
        self.log("=" * 60)

        dist_browser = self.project_root / "dist" / "enmi" / "browser"
        dist_enmi = self.project_root / "dist" / "enmi"

        if dist_browser.is_dir():
            dist_source = dist_browser
        elif dist_enmi.is_dir():
            dist_source = dist_enmi
        else:
            self.log(f"No se encontró la carpeta compilada en '{dist_browser}' ni en '{dist_enmi}'.", "[ERROR]")
            return False

        self.log(f"Directorio local de origen: {dist_source}")
        self.log(f"Directorio remoto destino: {FTP_REMOTE_DIR}")

        count = self.upload_directory_tree(
            local_dir=dist_source,
            remote_base_dir=FTP_REMOTE_DIR
        )
        self.log(f"Total archivos frontend subidos: {count}\n", "[OK]")
        return True

    def deploy_api(self) -> bool:
        """Sube la carpeta api/ aplicando la configuración de producción."""
        self.log("=" * 60)
        self.log("PASO 4: Subiendo Backend API (con configuración PRO)...")
        self.log("=" * 60)

        api_source = self.project_root / "api"
        if not api_source.is_dir():
            self.log(f"No se encontró la carpeta 'api' en '{api_source}'.", "[ERROR]")
            return False

        remote_api_dir = f"{FTP_REMOTE_DIR.rstrip('/')}/api"
        self.log(f"Directorio local de origen: {api_source}")
        self.log(f"Directorio remoto destino: {remote_api_dir}")

        pro_config_file = api_source / "config.env.pro.php"
        if not pro_config_file.is_file():
            self.log("ADVERTENCIA: 'api/config.env.pro.php' no existe. Asegúrate de configurarlo.", "[WARN]")

        # Excluimos config.env.local.php y config.env.php local (si existiera)
        exclude_files = {
            "config.env.local.php",
            "config.env.example.php",
            "config.env.php"
        }

        # Mapeamos config.env.pro.php -> config.env.php en el servidor remoto
        rename_files = {
            "config.env.pro.php": "config.env.php"
        }

        count = self.upload_directory_tree(
            local_dir=api_source,
            remote_base_dir=remote_api_dir,
            exclude_filenames=exclude_files,
            rename_filenames=rename_files
        )
        self.log(f"Total archivos API subidos: {count}\n", "[OK]")
        return True

    def close(self):
        """Cierra la conexión FTP."""
        if self.ftp:
            try:
                self.ftp.quit()
            except Exception:
                self.ftp.close()
            self.log("Conexión FTP finalizada.", "[INFO]")


def main():
    parser = argparse.ArgumentParser(description="Despliegue automatizado de Angular y PHP API por FTP a Producción.")
    parser.add_argument("--skip-build", action="store_true", help="Omitir el paso de compilación de Angular (npm run build).")
    parser.add_argument("--test-conn", action="store_true", help="Solo probar la conexión FTP con el servidor y salir.")
    parser.add_argument("--dry-run", action="store_true", help="Simular el proceso sin conectar ni subir archivos.")

    args = parser.parse_args()

    # Raíz del proyecto (un nivel arriba del directorio python/)
    project_root = Path(__file__).resolve().parent.parent

    deployer = Deployer(project_root=project_root, dry_run=args.dry_run)
    total_start = time.time()

    print("\n" + "=" * 60)
    print("      [DESPLIEGUE A PRODUCCION - ENMI]")
    print("=" * 60 + "\n")

    if args.test_conn:
        if deployer.connect_ftp():
            deployer.close()
            print("[OK] Prueba de conexión FTP exitosa.")
            sys.exit(0)
        else:
            print("[ERROR] Falló la prueba de conexión FTP.")
            sys.exit(1)

    # 1. Compilación
    if not args.skip_build:
        if not deployer.run_build():
            print("[ERROR] Despliegue cancelado debido a errores de compilación.")
            sys.exit(1)
    else:
        print("[INFO] Saltando compilación de frontend (--skip-build activo).\n")

    # 2. Conexión FTP
    if not deployer.connect_ftp():
        print("[ERROR] Despliegue cancelado: no se pudo establecer conexión FTP.")
        sys.exit(1)

    try:
        # 3. Subir Frontend
        if not deployer.deploy_frontend():
            print("[ERROR] Error al subir el frontend.")
            sys.exit(1)

        # 4. Subir API
        if not deployer.deploy_api():
            print("[ERROR] Error al subir la API.")
            sys.exit(1)

    finally:
        deployer.close()

    total_time = round(time.time() - total_start, 2)
    print("\n" + "=" * 60)
    print(f"  [EXITO] DESPLIEGUE COMPLETADO EN {total_time}s")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
