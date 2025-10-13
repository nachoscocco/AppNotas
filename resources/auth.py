import json
import bcrypt
from flask import request
from flask_restful import Resource
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

# En un proyecto real, esto estaría en una base de datos
archivo_de_usuarios = "data/users.json"

# Funciones auxiliares, no corresponden a resources:
def cargar_usuarios():
    with open(archivo_de_usuarios, "r") as f:
        return json.load(f)

def guardar_usuarios(usuarios):
    with open(archivo_de_usuarios, "w") as f:
        json.dump(usuarios, f, indent=4, ensure_ascii = False)

def verificar_password(password, hashed):
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def encriptar_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# Recursos:
class Registro(Resource):
    def post(self):
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        # role = data.get("role", "basico")  # por defecto "estudiante"
        role = "usuarioBase"

        if not username or not password:
            return {"message": "Faltan datos"}, 400

        usuarios = cargar_usuarios()
        if username in usuarios:
            return {"message": "Usuario ya existe"}, 400

        usuarios[username] = {
            "password": encriptar_password(password),
            "role": role
        }
        guardar_usuarios(usuarios)
        return {"message": f"Usuario {username} registrado con éxito"}, 201


class Login(Resource):
    @jwt_required(optional=True)
    def post(self):
        
        # Si el usuario ya está logueado (el request llega con token),
        # retornamos un status code 400:
        usuario = get_jwt_identity() # Si no hay token, será None
        if usuario:
            return {"message": "El usuario ya está logueado"}, 400

        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        usuarios = cargar_usuarios()
        usuario = usuarios.get(username)

        if not usuario or not verificar_password(password, usuario["password"]):
            return {"message": "Credenciales inválidas"}, 401

        # Creamos el token JWT y se lo retornamos al usuario
        access_token = create_access_token(identity={"username": username})
        return {"access_token": access_token}, 200