import bcrypt
import re
import random
import string
import datetime
from sqlalchemy import func
from flask import request
from flask_restful import Resource
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_mail import Message
from models import db, Usuario


def verificar_password(password, hashed):
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def encriptar_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def generar_codigo_alfanumerico(longitud=6):
    caracteres = string.ascii_uppercase + string.digits
    return "".join(random.choice(caracteres) for _ in range(longitud))


def enviar_correo_verificacion(username, email, codigo):
    from app import mail

    msg = Message(
        "Código de verificación - App Notas",
        recipients=[email],
    )
    msg.body = (
        f"Hola {username},\n\n"
        f"Tu código de verificación es:\n\n"
        f"   {codigo}\n\n"
        f"Ingresalo en la aplicación para activar tu cuenta."
    )
    mail.send(msg)


def enviar_correo_recuperacion(username, email, codigo):
    from app import mail

    msg = Message(
        "Recuperación de contraseña - App Notas",
        recipients=[email],
    )
    msg.body = (
        f"Hola {username},\n\n"
        f"Recibimos una solicitud para restablecer tu contraseña.\n"
        f"Tu código de recuperación es:\n\n"
        f"   {codigo}\n\n"
        f"Si no solicitaste este cambio, podés ignorar este mensaje."
    )
    mail.send(msg)


class Registro(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")
        nombre = data.get("nombre", "").strip()
        apellido = data.get("apellido", "").strip()

        if not username or not email or not password or not confirm_password:
            return {"message": "Todos los campos obligatorios deben completarse"}, 400

        if password != confirm_password:
            return {"message": "Las contraseñas no coinciden"}, 400

        if len(username) < 3 or len(password) < 4:
            return {"message": "Usuario (mín 3) o clave (mín 4) muy cortos"}, 400

        email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(email_regex, email):
            return {"message": "El formato del correo electrónico no es válido"}, 400

        if db.session.get(Usuario, username):
            return {"message": "El nombre de usuario ya existe"}, 400

        if Usuario.query.filter(func.lower(Usuario.email) == email.lower()).first():
            return {"message": "El correo electrónico ya está registrado"}, 400

        codigo_seguridad = generar_codigo_alfanumerico()

        nuevo_usuario = Usuario(
            username=username,
            nombre=nombre or username,
            apellido=apellido,
            email=email,
            password=encriptar_password(password),
            role="user",
            activo=True,
            verificado=False,
            codigo_verificacion=codigo_seguridad,
            fecha_alta=datetime.datetime.now().isoformat(),
            fecha_modificacion=None,
        )

        db.session.add(nuevo_usuario)
        db.session.commit()

        try:
            enviar_correo_verificacion(username, email, codigo_seguridad)
            msg_ok = "¡Registro exitoso! Te enviamos un código de 6 dígitos a tu correo para activar la cuenta."
        except Exception:
            msg_ok = f"¡Registro exitoso! Código de activación: {codigo_seguridad} (mostrado aquí porque el servidor gratuito restringe SMTP directo)."

        return {
            "message": msg_ok,
            "username": username,
            "codigo_demo": codigo_seguridad,
        }, 201


class Login(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")

        if not username or not password:
            return {"message": "Debés ingresar usuario y contraseña"}, 400

        usuario_data = db.session.get(Usuario, username)

        if not usuario_data or not verificar_password(password, usuario_data.password):
            return {"message": "Credenciales inválidas"}, 401

        if not usuario_data.activo:
            return {"message": "Esta cuenta se encuentra desactivada"}, 403

        if not usuario_data.verificado:
            return {
                "message": "Tu cuenta aún no ha sido verificada. Ingresá el código enviado a tu correo.",
                "unverified": True,
                "username": username,
            }, 403

        role = usuario_data.role or "user"
        access_token = create_access_token(
            identity={"username": username, "role": role}
        )
        return {
            "access_token": access_token,
            "username": username,
            "role": role,
            "nombre": usuario_data.nombre or username,
            "apellido": usuario_data.apellido or "",
            "email": usuario_data.email or "",
        }, 200


class VerificarCodigo(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        codigo_ingresado = data.get("codigo", "").strip().upper()

        if not username or not codigo_ingresado:
            return {"message": "Faltan datos para la verificación"}, 400

        usuario_data = db.session.get(Usuario, username)

        if not usuario_data:
            return {"message": "Usuario no encontrado"}, 404

        if usuario_data.verificado:
            return {"message": "La cuenta ya se encuentra verificada"}, 400

        if usuario_data.codigo_verificacion != codigo_ingresado:
            return {"message": "El código ingresado es incorrecto"}, 400

        usuario_data.verificado = True
        usuario_data.fecha_modificacion = datetime.datetime.now().isoformat()
        usuario_data.codigo_verificacion = None

        db.session.commit()

        role = usuario_data.role or "user"
        access_token = create_access_token(
            identity={"username": username, "role": role}
        )
        return {
            "message": "¡Cuenta verificada con éxito!",
            "access_token": access_token,
            "username": username,
            "role": role,
        }, 200


class ReenviarCodigo(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()

        if not username:
            return {"message": "Indicá el nombre de usuario"}, 400

        usuario_data = db.session.get(Usuario, username)
        if not usuario_data:
            return {"message": "Usuario no encontrado"}, 404

        if usuario_data.verificado:
            return {"message": "Esta cuenta ya está verificada"}, 400

        email = usuario_data.email
        if not email:
            return {"message": "El usuario no posee un correo registrado"}, 400

        nuevo_codigo = generar_codigo_alfanumerico()
        usuario_data.codigo_verificacion = nuevo_codigo
        db.session.commit()

        try:
            enviar_correo_verificacion(username, email, nuevo_codigo)
            msg_reenv = "Se envió un nuevo código de verificación a tu correo"
        except Exception:
            msg_reenv = f"Nuevo código de activación: {nuevo_codigo} (mostrado aquí porque el servidor gratuito restringe SMTP directo)."

        return {"message": msg_reenv, "codigo_demo": nuevo_codigo}, 200


class RecuperarPassword(Resource):
    def post(self):
        data = request.get_json() or {}
        identificador = data.get("identificador", "").strip()

        if not identificador:
            return {"message": "Ingresá tu usuario o correo electrónico"}, 400

        target_data = db.session.get(Usuario, identificador)
        if not target_data:
            target_data = Usuario.query.filter(
                func.lower(Usuario.email) == identificador.lower()
            ).first()

        if not target_data:
            return {"message": "No se encontró una cuenta con ese usuario o email"}, 404

        email = target_data.email
        if not email:
            return {"message": "La cuenta no tiene un correo electrónico asociado"}, 400

        codigo_rec = generar_codigo_alfanumerico()
        target_data.codigo_recuperacion = codigo_rec
        db.session.commit()

        try:
            enviar_correo_recuperacion(target_data.username, email, codigo_rec)
            msg_rec = "Te enviamos un código de recuperación a tu correo electrónico."
        except Exception:
            msg_rec = f"Código de recuperación: {codigo_rec} (mostrado aquí porque el servidor gratuito restringe SMTP directo)."

        return {
            "message": msg_rec,
            "username": target_data.username,
            "codigo_demo": codigo_rec,
        }, 200


class ResetPassword(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        codigo = data.get("codigo", "").strip().upper()
        new_password = data.get("new_password", "")
        confirm_password = data.get("confirm_password", "")

        if not username or not codigo or not new_password or not confirm_password:
            return {"message": "Completá todos los campos"}, 400

        if new_password != confirm_password:
            return {"message": "Las contraseñas no coinciden"}, 400

        if len(new_password) < 4:
            return {"message": "La nueva contraseña debe tener al menos 4 caracteres"}, 400

        usuario_data = db.session.get(Usuario, username)
        if not usuario_data:
            return {"message": "Usuario no encontrado"}, 404

        codigo_real = usuario_data.codigo_recuperacion
        if not codigo_real or codigo_real != codigo:
            return {"message": "El código de recuperación es inválido"}, 400

        usuario_data.password = encriptar_password(new_password)
        usuario_data.verificado = True
        usuario_data.fecha_modificacion = datetime.datetime.now().isoformat()
        usuario_data.codigo_recuperacion = None
        usuario_data.codigo_verificacion = None

        db.session.commit()
        return {"message": "¡Contraseña actualizada con éxito! Ya podés iniciar sesión."}, 200


class PerfilUsuario(Resource):
    @jwt_required()
    def get(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u:
            return {"message": "Usuario no encontrado"}, 404

        return u.to_dict(), 200

    @jwt_required()
    def put(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u:
            return {"message": "Usuario no encontrado"}, 404

        data = request.get_json() or {}
        if "nombre" in data:
            u.nombre = str(data.get("nombre") or "").strip() or username
        if "apellido" in data:
            u.apellido = str(data.get("apellido") or "").strip()
        if "email" in data:
            nuevo_email = str(data.get("email") or "").strip()
            if nuevo_email:
                email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
                if not re.match(email_regex, nuevo_email):
                    return {"message": "El formato del correo electrónico no es válido"}, 400
                existente = Usuario.query.filter(
                    Usuario.username != username,
                    func.lower(Usuario.email) == nuevo_email.lower(),
                ).first()
                if existente:
                    return {"message": "Ese correo ya está en uso por otra cuenta"}, 400
                u.email = nuevo_email

        current_pw = data.get("current_password", "")
        new_pw = data.get("new_password", "")
        if new_pw:
            if not current_pw or not verificar_password(current_pw, u.password):
                return {"message": "La contraseña actual es incorrecta"}, 400
            if len(new_pw) < 4:
                return {"message": "La nueva contraseña debe tener al menos 4 caracteres"}, 400
            u.password = encriptar_password(new_pw)

        u.fecha_modificacion = datetime.datetime.now().isoformat()
        db.session.commit()

        return {
            "message": "Perfil actualizado correctamente",
            "perfil": {
                "username": u.username,
                "nombre": u.nombre or u.username,
                "apellido": u.apellido or "",
                "email": u.email or "",
                "role": u.role or "user",
                "fecha_alta": u.fecha_alta,
                "fecha_modificacion": u.fecha_modificacion,
            },
        }, 200


class ListaUsuarios(Resource):
    @jwt_required()
    def get(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u_actual = db.session.get(Usuario, username)
        role = (u_actual.role if u_actual else None) or identity.get("role", "user")

        if role not in ("docente", "admin"):
            return {"message": "Acceso restringido a administradores / docentes"}, 403

        usuarios = Usuario.query.order_by(Usuario.username).all()
        lista = [
            {
                "username": u.username,
                "nombre": u.nombre or u.username,
                "apellido": u.apellido or "",
                "email": u.email or "",
                "role": u.role or "user",
                "verificado": bool(u.verificado),
            }
            for u in usuarios
        ]
        return {"usuarios": lista}, 200
