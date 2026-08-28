import random
import os
from datetime import datetime, timedelta

# Listas de nombres y apellidos españoles típicos
NOMBRES = [
    "Antonio", "Manuel", "José", "Francisco", "David", "Juan", "Javier", "Daniel", "Carlos", "Jesús",
    "Alejandro", "Miguel", "Rafael", "Pedro", "Ángel", "Pablo", "Fernando", "Sergio", "Luis", "Jorge",
    "Alberto", "Álvaro", "Adrián", "Diego", "Raúl", "Iván", "Enrique", "Rubén", "Óscar", "Ramón",
    "Vicente", "Andrés", "Joaquín", "Santiago", "Eduardo", "Víctor", "Roberto", "Jaime", "Ignacio", "Alfonso",
    "María", "Carmen", "Ana", "Isabel", "Laura", "Cristina", "Marta", "Lucía", "Elena", "Sara",
    "Paula", "Raquel", "Beatriz", "Patricia", "Nuria", "Silvia", "Teresa", "Rosa", "Pilar", "Rocío",
    "Alicia", "Sonia", "Alba", "Irene", "Andrea", "Natalia", "Marina", "Julia", "Eva", "Claudia",
    "Lorena", "Miriam", "Esther", "Clara", "Mónica", "Victoria", "Inés", "Belén", "Noelia", "Ángela",
    "Guillermo", "Gonzalo", "Marcos", "Hugo", "Mario", "Mateo", "Lucas", "Leo", "Martín", "Nicolás",
    "Celia", "Blanca", "Nerea", "Carla", "Ainhoa", "Berta", "Gemma", "Diana", "Lourdes", "Mercedes"
]

APELLIDOS = [
    "García", "Rodríguez", "González", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín",
    "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Alonso", "Gutiérrez",
    "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Ramírez", "Serrano", "Blanco", "Molina",
    "Morales", "Suárez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín", "Sanz", "Núñez",
    "Iglesias", "Medina", "Garrido", "Cortés", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto",
    "Méndez", "Cruz", "Calvo", "Gallego", "Vidal", "León", "Márquez", "Herrera", "Peña", "Flores",
    "Cabrera", "Campos", "Vega", "Fuentes", "Carrasco", "Diez", "Caballero", "Reyes", "Nieto", "Aguilar",
    "Pascual", "Santana", "Herrero", "Montero", "Lorenzo", "Hidalgo", "Giménez", "Ibáñez", "Ferrer", "Durán",
    "Santiago", "Benítez", "Mora", "Vicente", "Vargas", "Arias", "Carmona", "Crespo", "Roman", "Pastor",
    "Soto", "Sáez", "Velasco", "Soler", "Moya", "Esteban", "Parra", "Bravo", "Gallardo", "Rojas"
]

random.seed(42)

registros = []
usados = set()

# Fecha base (hoy = 2026-08-27)
base_date = datetime(2026, 8, 27, 20, 0, 0)

ip_pools = [
    "80.24.12.", "83.35.45.", "88.1.120.", "195.53.11.", "213.97.20.", 
    "62.83.15.", "178.139.80.", "85.50.21.", "192.168.1.", "10.0.0."
]

count = 0
while count < 200:
    nom = random.choice(NOMBRES)
    if random.random() < 0.2:
        segundo_nom = random.choice([n for n in NOMBRES if n != nom])
        nom = f"{nom} {segundo_nom}"
        
    ap1 = random.choice(APELLIDOS)
    ap2 = random.choice([a for a in APELLIDOS if a != ap1])
    apellidos = f"{ap1} {ap2}"
    
    clave = f"{nom}|{apellidos}"
    if clave in usados:
        continue
    usados.add(clave)
    
    estado = 'activo'
    ip = f"{random.choice(ip_pools)}{random.randint(2, 254)}"
    
    # 20 registros hoy, el resto en los últimos 90 días
    if count < 20:
        horas_atras = random.randint(1, 14)
        minutos = random.randint(0, 59)
        segundos = random.randint(0, 59)
        fecha_reg = base_date - timedelta(hours=horas_atras, minutes=minutos, seconds=segundos)
    else:
        dias_atras = random.randint(1, 90)
        horas = random.randint(8, 22)
        minutos = random.randint(0, 59)
        segundos = random.randint(0, 59)
        fecha_reg = (base_date - timedelta(days=dias_atras)).replace(hour=horas, minute=minutos, second=segundos)
        
    fecha_str = fecha_reg.strftime('%Y-%m-%d %H:%M:%S')
    registros.append((nom, apellidos, estado, ip, fecha_str))
    count += 1

registros.sort(key=lambda x: x[4])

sql_lines = [
    "-- =====================================================================",
    "-- SCRIPT DE PRUEBA: CARGA DE 200 INSCRIPCIONES (PROYECTO ENMI)",
    "-- Motor: MariaDB / MySQL (Dinahosting)",
    "-- Tabla: enmi_inscripciones",
    "-- =====================================================================",
    "",
    "START TRANSACTION;",
    "",
    "INSERT INTO `enmi_inscripciones` (`nombre`, `apellidos`, `estado`, `ip_registro`, `fecha_creacion`, `fecha_actualizacion`) VALUES"
]

values_clauses = []
for i, r in enumerate(registros):
    nom, ape, est, ip, fec = r
    nom_esc = nom.replace("'", "''")
    ape_esc = ape.replace("'", "''")
    values_clauses.append(f"  ('{nom_esc}', '{ape_esc}', '{est}', '{ip}', '{fec}', NULL)")

sql_lines.append(",\n".join(values_clauses) + ";")
sql_lines.append("")
sql_lines.append("COMMIT;")
sql_lines.append("")
sql_lines.append("-- =====================================================================")
sql_lines.append("-- Verificación rápida:")
sql_lines.append("-- SELECT COUNT(*) AS total_inscritos FROM `enmi_inscripciones`;")
sql_lines.append("-- SELECT * FROM `enmi_inscripciones` ORDER BY `fecha_creacion` DESC LIMIT 20;")
sql_lines.append("-- =====================================================================")

output_sql = "\n".join(sql_lines)

os.makedirs("c:/codigo/otros/enmiweb/db/seeds", exist_ok=True)
with open("c:/codigo/otros/enmiweb/db/seeds/seed_200_inscripciones.sql", "w", encoding="utf-8") as f:
    f.write(output_sql)

print("SUCCESS: 200 registros generados.")
