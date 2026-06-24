import json
import bcrypt
import re
import random
import string
from flask import request
from flask_restful import Resource
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_mail import Message

archivo_de_usuarios = "data/users.json"


def cargar_usuarios():
    with open(archivo_de_usuarios, "r") as f:
        return json.load(f)


def guardar_usuarios(usuarios):
    with open(archivo_de_usuarios, "w") as f:
        json.dump(usuarios, f, indent=4, ensure_ascii=False)


def verificar_password(password, hashed):
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def encriptar_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def generar_codigo_alfanumerico(longitud=6):
    caracteres = string.ascii_uppercase + string.digits
    return ''.join(random.choice(caracteres) for _ in range(longitud))


def enviar_correo_verificacion(username, email, codigo):
    from app import mail

    msg = Message(
        "Código de verificación - App Notas",
        recipients=[email]
    )
    msg.body = f"Hola {username},\n\nTu código de verificación es:\n\n   {codigo}\n\nIngresalo en la aplicación para activar tu cuenta."
    mail.send(msg)


class Registro(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        confirm_password = data.get("confirm_password")
        role = "user"

        if not username or not email or not password or not confirm_password:
            return {"message": "Todos los campos son obligatorios"}, 400

        if password != confirm_password:
            return {"message": "Las contraseñas no coinciden"}, 400

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return {"message": "El formato del correo no es válido"}, 400

        usuarios = cargar_usuarios()
        if username in usuarios:
            return {"message": "El nombre de usuario ya existe"}, 400

        codigo_seguridad = generar_codigo_alfanumerico()

        usuarios[username] = {
            "email": email,
            "password": encriptar_password(password),
            "role": role,
            "verificado": False,
            "codigo_verificacion": codigo_seguridad
        }

        try:
            enviar_correo_verificacion(username, email, codigo_seguridad)
            guardar_usuarios(usuarios)
            return {"message": f"Usuario {username} registrado. Ingresá el código enviado a tu correo."}, 201
        except Exception as e:
            return {"message": f"Error al enviar el correo de activación: {str(e)}"}, 500


class Login(Resource):
    @jwt_required(optional=True)
    def post(self):
        usuario = get_jwt_identity()
        if usuario:
            return {"message": "El usuario ya está logueado"}, 400

        data = request.get_json() or {}
        username = data.get("username")
        password = data.get("password")

        usuarios = cargar_usuarios()
        usuario_data = usuarios.get(username)

        if not usuario_data or not verificar_password(password, usuario_data["password"]):
            return {"message": "Credenciales inválidas"}, 401

        if not usuario_data.get("verificado", True):
            return {"message": "Tu cuenta aún no ha sido verificada. Ingresá el código enviado a tu correo."}, 403

        access_token = create_access_token(identity={"username": username})
        return {"access_token": access_token}, 200


class VerificarCodigo(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username")
        codigo_ingresado = data.get("codigo")

        if not username or not codigo_ingresado:
            return {"message": "Faltan datos requeridos."}, 400

        usuarios = cargar_usuarios()
        usuario_data = usuarios.get(username)

        if not usuario_data:
            return {"message": "Usuario no encontrado."}, 404

        codigo_guardado = usuario_data.get("codigo_verificacion")
        if not codigo_guardado or codigo_guardado.upper() != codigo_ingresado.upper():
            return {"message": "El código de verificación es incorrecto."}, 400

        usuario_data["verificado"] = True
        if "codigo_verificacion" in usuario_data:
            del usuario_data["codigo_verificacion"]

        guardar_usuarios(usuarios)

        access_token = create_access_token(identity={"username": username})
        return {
            "message": "¡Cuenta verificada con éxito!",
            "access_token": access_token
        }, 200