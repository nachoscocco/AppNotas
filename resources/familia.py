import random
import string
import datetime
from sqlalchemy import func
from flask import request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message
from models import db, Usuario, GrupoFamiliar, Nota, Notificacion


def generar_codigo_grupo():
    caracteres = string.ascii_uppercase + string.digits
    while True:
        sufijo = "".join(random.choice(caracteres) for _ in range(4))
        codigo = f"FAM-{sufijo}"
        if not GrupoFamiliar.query.filter_by(codigo_invitacion=codigo).first():
            return codigo


def crear_notificacion(destinatario, emisor, tipo, mensaje, nota_id=None):
    if not destinatario or destinatario == emisor:
        return None
    notif = Notificacion(
        destinatario_username=destinatario,
        emisor_username=emisor,
        nota_id=nota_id,
        tipo=tipo,
        mensaje=mensaje[:300],
        leida=False,
        fecha=datetime.datetime.now().isoformat(),
    )
    db.session.add(notif)
    return notif


def enviar_correo_tarea_completada(lider_user, miembro_user, nota):
    """Envía aviso por email al líder del grupo cuando un miembro completa una tarjeta asignada."""
    if not lider_user or not lider_user.email:
        return False
    try:
        from app import mail

        nombre_miembro = (
            f"{miembro_user.nombre} ({miembro_user.username})"
            if miembro_user
            else nota.asignado_a
        )
        msg = Message(
            f"✅ Tarea completada en tu Grupo Familiar: {nota.titulo}",
            recipients=[lider_user.email],
        )
        msg.body = (
            f"Hola {lider_user.nombre or lider_user.username},\n\n"
            f"¡Buenas noticias en tu Grupo Familiar!\n\n"
            f"{nombre_miembro} acaba de marcar como COMPLETADA la tarjeta:\n"
            f"  • Título: {nota.titulo}\n"
            f"  • Categoría: {nota.categoria}\n"
            f"  • Prioridad: {nota.prioridad}\n\n"
            f"Ingresá a AppNotas para ver los detalles, subtareas o archivos adjuntos.\n"
        )
        mail.send(msg)
        return True
    except Exception:
        # No bloquear la petición si el entorno local no tiene credenciales SMTP activas
        return False


class FamiliaResource(Resource):
    @jwt_required()
    def get(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u:
            return {"message": "Usuario no encontrado"}, 404

        if not u.grupo_id:
            return {"grupo": None, "rol_grupo": None}, 200

        grupo = db.session.get(GrupoFamiliar, u.grupo_id)
        if not grupo:
            u.grupo_id = None
            u.rol_grupo = None
            db.session.commit()
            return {"grupo": None, "rol_grupo": None}, 200

        rol = "lider" if grupo.lider_username == u.username else (u.rol_grupo or "miembro")
        return {
            "grupo": grupo.to_dict(include_members=True),
            "rol_grupo": rol,
        }, 200

    @jwt_required()
    def post(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u:
            return {"message": "Usuario no encontrado"}, 404

        if u.grupo_id:
            return {
                "message": "Ya pertenecés a un grupo familiar activo. Salí o disolvelo antes de crear otro."
            }, 400

        data = request.get_json() or {}
        nombre = (data.get("nombre") or "").strip()
        if not nombre:
            return {"message": "Ingresá un nombre para el Grupo Familiar (ej. Familia Roda)"}, 400
        if len(nombre) > 80:
            return {"message": "El nombre del grupo no puede superar los 80 caracteres"}, 400

        codigo = generar_codigo_grupo()
        ahora = datetime.datetime.now().isoformat()

        nuevo_grupo = GrupoFamiliar(
            nombre=nombre,
            codigo_invitacion=codigo,
            lider_username=username,
            fecha_creacion=ahora,
        )
        try:
            db.session.add(nuevo_grupo)
            db.session.flush()
            u.grupo_id = nuevo_grupo.id
            u.rol_grupo = "lider"
            db.session.commit()
            return {
                "message": f"¡Grupo familiar «{nombre}» creado con éxito! Código: {codigo}",
                "grupo": nuevo_grupo.to_dict(include_members=True),
                "rol_grupo": "lider",
            }, 201
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al crear el grupo familiar: {str(e)}"}, 500

    @jwt_required()
    def delete(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u or not u.grupo_id:
            return {"message": "No pertenecés a ningún grupo familiar"}, 400

        grupo = db.session.get(GrupoFamiliar, u.grupo_id)
        if not grupo:
            return {"message": "Grupo no encontrado"}, 404

        if grupo.lider_username != username:
            return {
                "message": "Solo el líder del grupo familiar puede disolver el grupo"
            }, 403

        try:
            miembros = Usuario.query.filter_by(grupo_id=grupo.id).all()
            for m in miembros:
                m.grupo_id = None
                m.rol_grupo = None
            Nota.query.filter_by(grupo_id=grupo.id).delete()
            db.session.delete(grupo)
            db.session.commit()
            return {"message": "Grupo familiar disuelto correctamente"}, 200
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al disolver el grupo: {str(e)}"}, 500


class FamiliaUnirseResource(Resource):
    @jwt_required()
    def post(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u:
            return {"message": "Usuario no encontrado"}, 404

        if u.grupo_id:
            return {"message": "Ya formás parte de un grupo familiar"}, 400

        data = request.get_json() or {}
        codigo = (data.get("codigo") or "").strip().upper()
        if not codigo:
            return {"message": "Ingresá el código de invitación (ej. FAM-2026)"}, 400

        grupo = GrupoFamiliar.query.filter(
            func.upper(GrupoFamiliar.codigo_invitacion) == codigo
        ).first()
        if not grupo:
            return {
                "message": "No existe ningún grupo familiar con ese código de invitación"
            }, 404

        try:
            u.grupo_id = grupo.id
            u.rol_grupo = "miembro"
            crear_notificacion(
                destinatario=grupo.lider_username,
                emisor=u.username,
                tipo="miembro_unido",
                mensaje=f"👋 {u.nombre or u.username} (@{u.username}) se unió a «{grupo.nombre}»",
            )
            db.session.commit()
            return {
                "message": f"¡Te uniste al grupo «{grupo.nombre}»!",
                "grupo": grupo.to_dict(include_members=True),
                "rol_grupo": "miembro",
            }, 200
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al unirse al grupo: {str(e)}"}, 500


class FamiliaMiembrosResource(Resource):
    @jwt_required()
    def post(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u or not u.grupo_id:
            return {"message": "No pertenecés a ningún grupo familiar"}, 400

        grupo = db.session.get(GrupoFamiliar, u.grupo_id)
        if not grupo or grupo.lider_username != username:
            return {
                "message": "Solo el líder del grupo familiar puede agregar integrantes directamente"
            }, 403

        data = request.get_json() or {}
        identificador = (data.get("identificador") or "").strip()
        if not identificador:
            return {
                "message": "Ingresá el nombre de usuario o correo electrónico del integrante"
            }, 400

        target = db.session.get(Usuario, identificador)
        if not target:
            target = Usuario.query.filter(
                func.lower(Usuario.email) == identificador.lower()
            ).first()

        if not target:
            return {
                "message": f"No se encontró ningún usuario registrado como «{identificador}»"
            }, 404

        if target.grupo_id == grupo.id:
            return {"message": f"@{target.username} ya es miembro de este grupo"}, 400

        if target.grupo_id is not None:
            return {
                "message": f"@{target.username} ya pertenece a otro grupo familiar activo"
            }, 400

        try:
            target.grupo_id = grupo.id
            target.rol_grupo = "miembro"
            crear_notificacion(
                destinatario=target.username,
                emisor=u.username,
                tipo="miembro_unido",
                mensaje=f"👨‍👩‍👧‍👦 {u.nombre or u.username} te sumó al grupo familiar «{grupo.nombre}»",
            )
            db.session.commit()
            return {
                "message": f"¡{target.nombre or target.username} (@{target.username}) fue agregado al grupo!",
                "grupo": grupo.to_dict(include_members=True),
            }, 200
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al agregar miembro: {str(e)}"}, 500

    @jwt_required()
    def delete(self, target_username):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        u = db.session.get(Usuario, username)
        if not u or not u.grupo_id:
            return {"message": "No pertenecés a ningún grupo familiar"}, 400

        grupo = db.session.get(GrupoFamiliar, u.grupo_id)
        if not grupo:
            return {"message": "Grupo no encontrado"}, 404

        es_lider = grupo.lider_username == username
        es_propio = target_username == username

        if not es_lider and not es_propio:
            return {
                "message": "No tenés permiso para remover a otros integrantes del grupo"
            }, 403

        if es_lider and es_propio:
            return {
                "message": "Sos el líder del grupo. Si querés cerrarlo, usá la opción «Disolver grupo»."
            }, 400

        target = db.session.get(Usuario, target_username)
        if not target or target.grupo_id != grupo.id:
            return {"message": "El usuario no pertenece a este grupo"}, 404

        try:
            target.grupo_id = None
            target.rol_grupo = None
            if es_propio:
                crear_notificacion(
                    destinatario=grupo.lider_username,
                    emisor=username,
                    tipo="miembro_unido",
                    mensaje=f"ℹ️ {u.nombre or username} (@{username}) salió del grupo familiar",
                )
            db.session.commit()
            return {
                "message": "Saliste del grupo familiar"
                if es_propio
                else f"@{target_username} fue removido del grupo",
                "grupo": None if es_propio else grupo.to_dict(include_members=True),
            }, 200
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al remover miembro: {str(e)}"}, 500


class NotificacionesResource(Resource):
    @jwt_required()
    def get(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        notifs = (
            Notificacion.query.filter_by(destinatario_username=username)
            .order_by(Notificacion.id.desc())
            .limit(30)
            .all()
        )
        no_leidas = Notificacion.query.filter_by(
            destinatario_username=username, leida=False
        ).count()
        return {
            "notificaciones": [n.to_dict() for n in notifs],
            "no_leidas": no_leidas,
        }, 200

    @jwt_required()
    def put(self):
        identity = get_jwt_identity() or {}
        username = identity.get("username")
        data = request.get_json() or {}
        notif_id = data.get("id")

        try:
            if notif_id:
                n = db.session.get(Notificacion, int(notif_id))
                if n and n.destinatario_username == username:
                    n.leida = True
            else:
                Notificacion.query.filter_by(
                    destinatario_username=username, leida=False
                ).update({"leida": True})
            db.session.commit()

            notifs = (
                Notificacion.query.filter_by(destinatario_username=username)
                .order_by(Notificacion.id.desc())
                .limit(30)
                .all()
            )
            no_leidas = Notificacion.query.filter_by(
                destinatario_username=username, leida=False
            ).count()
            return {
                "message": "Notificaciones actualizadas",
                "notificaciones": [n.to_dict() for n in notifs],
                "no_leidas": no_leidas,
            }, 200
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al actualizar notificaciones: {str(e)}"}, 500
