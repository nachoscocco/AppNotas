import bcrypt
import json

usuarios = {
        "docente1": {"password": "docente1", "role": "docente"},
        "docente2": {"password": "docente2", "role": "docente"},
        "alicia": {"password": "password123", "role": "estudiante"},
        "bruno": {"password": "qwerty", "role": "estudiante"},
}

for usuario in usuarios:
    clave_sin_encriptar = usuarios[usuario]["password"]
    clave_encriptada = bcrypt.hashpw(clave_sin_encriptar.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    usuarios[usuario]["password"] = clave_encriptada

with open("users.json", "w") as archivo:
    json.dump(usuarios, archivo, indent=4, ensure_ascii = False)