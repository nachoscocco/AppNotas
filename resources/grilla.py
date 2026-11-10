import os
import datetime
import mimetypes
from werkzeug.utils import secure_filename
from flask import request, current_app
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Usuario, GrupoFamiliar, Nota, Subtarea, Adjunto
from resources.familia import crear_notificacion, enviar_correo_tarea_completada

prioridad_orden = {"Urgente": 1, "Media": 2, "Baja": 3}
PRIORIDADES_VALIDAS = ("Urgente", "Media", "Baja")
CATEGORIAS_VALIDAS = ("Trabajo", "Casa", "Personal", "Estudio")
ESTADOS_TAREA_VALIDOS = ("Pendiente", "En progreso", "Completada")
EXTENSIONES_PERMITIDAS = {"pdf", "docx", "jpg", "jpeg", "png"}
MAX_TITULO_LEN = 60
MAX_DESC_LEN = 500


def es_admin_o_docente(usuario_identity):
    if not usuario_identity:
        return False
    role = usuario_identity.get("role")
    if role in ("docente", "admin"):
        return True
    try:
        u = db.session.get(Usuario, usuario_identity.get("username"))
        return bool(u and u.role in ("docente", "admin"))
    except Exception:
        return False


def es_lider_o_autor(nota, usuario_identity):
    """Devuelve True si el usuario es el creador/líder de la nota o es docente/admin."""
    if not usuario_identity:
        return False
    username = usuario_identity.get("username")
    if username == nota.usuario_username:
        return True
    if nota.grupo_id:
        grupo = db.session.get(GrupoFamiliar, nota.grupo_id)
        if grupo and grupo.lider_username == username:
            return True
    return es_admin_o_docente(usuario_identity)


def puede_interactuar_nota(nota, usuario_identity):
    """Devuelve True si el usuario es autor/líder, o si es el miembro asignado en una tarjeta familiar."""
    if es_lider_o_autor(nota, usuario_identity):
        return True
    if not usuario_identity:
        return False
    username = usuario_identity.get("username")
    if nota.grupo_id and nota.asignado_a == username:
        return True
    return False


def obtener_notas_filtradas(
    nombre_usuario,
    estado="pendientes",
    filtro_usuario=None,
    es_admin=False,
    contexto=None,
    asignado_a=None,
):
    if contexto == "familia":
        u = db.session.get(Usuario, nombre_usuario)
        if not u or not u.grupo_id:
            return []
        query = Nota.query.filter(Nota.grupo_id == u.grupo_id)
        if asignado_a and asignado_a != "TODOS":
            query = query.filter(Nota.asignado_a == asignado_a)
    else:
        query = Nota.query.filter(Nota.grupo_id.is_(None))
        if es_admin and filtro_usuario:
            if filtro_usuario != "TODOS":
                query = query.filter(Nota.usuario_username == filtro_usuario)
        else:
            query = query.filter(Nota.usuario_username == nombre_usuario)

    if estado == "completadas":
        notas = query.filter(
            Nota.completada.is_(True), Nota.fecha_baja.is_(None)
        ).all()
        notas_ordenadas = sorted(
            notas,
            key=lambda n: n.fecha_modificacion or n.fecha_creacion or "",
            reverse=True,
        )
    elif estado == "archivadas":
        notas = query.filter(Nota.fecha_baja.isnot(None)).all()
        notas_ordenadas = sorted(
            notas,
            key=lambda n: n.fecha_baja or n.fecha_creacion or "",
            reverse=True,
        )
    else:
        notas = query.filter(
            Nota.fecha_baja.is_(None), Nota.completada.is_(False)
        ).all()
        notas_ordenadas = sorted(
            notas,
            key=lambda n: (
                0 if n.fijada else 1,
                prioridad_orden.get(n.prioridad, 99),
            ),
        )

    return [n.to_dict() for n in notas_ordenadas]


def eliminar_archivos_fisicos(nota):
    upload_folder = current_app.config.get("UPLOAD_FOLDER")
    if not upload_folder:
        return
    for adj in nota.adjuntos or []:
        fname = adj.filename
        if fname:
            fpath = os.path.join(upload_folder, fname)
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass


def sincronizar_subtareas(nota, lista_subtareas):
    """Reemplaza la colección de subtareas de una nota a partir de una lista de dicts."""
    nota.subtareas.clear()
    db.session.flush()
    for idx, st in enumerate(lista_subtareas, start=1):
        if not isinstance(st, dict):
            continue
        texto_st = str(st.get("texto") or "").strip()
        if not texto_st:
            continue
        nota.subtareas.append(
            Subtarea(
                orden_local=st.get("id") or idx,
                texto=texto_st[:200],
                hecha=bool(st.get("hecha", False)),
            )
        )


def procesar_cambio_estado_familiar(nota, username_actor, nuevo_estado):
    """Actualiza estado_tarea y completada, y notifica al líder si se trata de una tarjeta familiar."""
    estado_anterior = nota.estado_tarea or (
        "Completada" if nota.completada else "Pendiente"
    )
    nota.estado_tarea = nuevo_estado
    nota.completada = nuevo_estado == "Completada"
    nota.fecha_modificacion = datetime.datetime.now().isoformat()

    if nota.grupo_id and estado_anterior != nuevo_estado:
        grupo = db.session.get(GrupoFamiliar, nota.grupo_id)
        u_actor = db.session.get(Usuario, username_actor)
        nombre_actor = (
            (u_actor.nombre or username_actor) if u_actor else username_actor
        )
        if grupo and grupo.lider_username != username_actor:
            if nuevo_estado == "En progreso":
                crear_notificacion(
                    destinatario=grupo.lider_username,
                    emisor=username_actor,
                    tipo="tarea_en_progreso",
                    mensaje=f"🔄 {nombre_actor} puso en progreso «{nota.titulo}»",
                    nota_id=nota.id,
                )
            elif nuevo_estado == "Completada":
                crear_notificacion(
                    destinatario=grupo.lider_username,
                    emisor=username_actor,
                    tipo="tarea_completada",
                    mensaje=f"✅ {nombre_actor} completó la tarea «{nota.titulo}»",
                    nota_id=nota.id,
                )
                lider_user = db.session.get(Usuario, grupo.lider_username)
                enviar_correo_tarea_completada(lider_user, u_actor, nota)


class Grilla(Resource):
    @jwt_required()
    def get(self, id_nota=None):
        try:
            usuario_logueado = get_jwt_identity()
            if not usuario_logueado:
                return {"message": "Token inválido o expirado"}, 401
            nombre_usuario = usuario_logueado.get("username")
            es_admin = es_admin_o_docente(usuario_logueado)
            filtro_usuario = request.args.get("usuario")
            contexto = request.args.get("contexto")
            asignado_a = request.args.get("asignado_a")

            if request.path.endswith("/completadas"):
                notas = obtener_notas_filtradas(
                    nombre_usuario,
                    "completadas",
                    filtro_usuario,
                    es_admin,
                    contexto,
                    asignado_a,
                )
            elif request.path.endswith("/archivadas"):
                notas = obtener_notas_filtradas(
                    nombre_usuario,
                    "archivadas",
                    filtro_usuario,
                    es_admin,
                    contexto,
                    asignado_a,
                )
            else:
                notas = obtener_notas_filtradas(
                    nombre_usuario,
                    "pendientes",
                    filtro_usuario,
                    es_admin,
                    contexto,
                    asignado_a,
                )

            return {"notas": notas}, 200
        except Exception as e:
            return {"message": f"Error al procesar la solicitud: {str(e)}"}, 500

    @jwt_required()
    def post(self):
        data = request.get_json() or {}
        titulo = (data.get("titulo") or "").strip()
        descripcion = (data.get("descripcion") or "").strip()
        prioridad = data.get("prioridad") or "Media"
        categoria = data.get("categoria") or "Personal"
        fecha_vencimiento = data.get("fecha_vencimiento") or None
        fijada = bool(data.get("fijada", False))
        subtareas = (
            data.get("subtareas") if isinstance(data.get("subtareas"), list) else []
        )
        es_familiar = bool(data.get("es_familiar") or data.get("grupo_id"))
        asignado_a = (data.get("asignado_a") or "").strip() or None

        if not titulo:
            return {
                "message": "Rellene este campo por favor: el título es obligatorio"
            }, 400
        if len(titulo) > MAX_TITULO_LEN:
            return {
                "message": f"El título no puede superar los {MAX_TITULO_LEN} caracteres"
            }, 400
        if len(descripcion) > MAX_DESC_LEN:
            return {
                "message": f"La descripción no puede superar los {MAX_DESC_LEN} caracteres"
            }, 400
        if prioridad not in PRIORIDADES_VALIDAS:
            return {
                "message": "Prioridad inválida (debe ser Urgente, Media o Baja)"
            }, 400
        if categoria not in CATEGORIAS_VALIDAS:
            return {
                "message": "Categoría inválida (debe ser Trabajo, Casa, Personal o Estudio)"
            }, 400

        usuario_logueado = get_jwt_identity()
        autor = usuario_logueado.get("username")
        u_autor = db.session.get(Usuario, autor)

        grupo_id = None
        if es_familiar:
            if not u_autor or not u_autor.grupo_id:
                return {
                    "message": "Debés pertenecer a un Grupo Familiar para crear tareas familiares"
                }, 400
            grupo = db.session.get(GrupoFamiliar, u_autor.grupo_id)
            if not grupo or grupo.lider_username != autor:
                return {
                    "message": "Solo el líder del grupo familiar puede crear y asignar tarjetas"
                }, 403
            grupo_id = grupo.id
            if not asignado_a:
                asignado_a = autor
            u_dest = db.session.get(Usuario, asignado_a)
            if not u_dest or u_dest.grupo_id != grupo.id:
                return {
                    "message": "El usuario asignado no pertenece a este Grupo Familiar"
                }, 400

        nueva_nota = Nota(
            titulo=titulo,
            descripcion=descripcion,
            prioridad=prioridad,
            categoria=categoria,
            fijada=fijada,
            fecha_vencimiento=fecha_vencimiento,
            completada=False,
            estado_tarea="Pendiente",
            fecha_creacion=datetime.datetime.now().isoformat(),
            fecha_baja=None,
            fecha_modificacion=None,
            usuario_username=autor,
            grupo_id=grupo_id,
            asignado_a=asignado_a,
        )

        try:
            db.session.add(nueva_nota)
            db.session.flush()
            if subtareas:
                sincronizar_subtareas(nueva_nota, subtareas)

            if grupo_id and asignado_a and asignado_a != autor:
                nombre_lider = (u_autor.nombre or autor) if u_autor else autor
                crear_notificacion(
                    destinatario=asignado_a,
                    emisor=autor,
                    tipo="tarea_asignada",
                    mensaje=f"📌 {nombre_lider} te asignó la tarea «{titulo}»",
                    nota_id=nueva_nota.id,
                )

            db.session.commit()
            return {
                "message": "¡Tarea familiar asignada exitosamente!"
                if grupo_id
                else "¡Tarea creada exitosamente!",
                "id": nueva_nota.id,
                "nota": nueva_nota.to_dict(),
            }, 201
        except Exception as e:
            db.session.rollback()
            return {"message": f"Error al guardar la nota: {str(e)}"}, 500

    @jwt_required()
    def put(self, id_nota):
        current_user = get_jwt_identity()
        username = current_user.get("username")
        nota = db.session.get(Nota, id_nota)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not puede_interactuar_nota(nota, current_user):
            return {"message": "No tiene permiso para modificar esta nota"}, 403

        es_lider = es_lider_o_autor(nota, current_user)
        data = request.get_json() or {}

        # Caso 1: Endpoint /grilla/<id>/estado (Cambio de estado de 3 niveles)
        if request.path.endswith("/estado"):
            nuevo_estado = data.get("estado_tarea")
            if nuevo_estado not in ESTADOS_TAREA_VALIDOS:
                return {
                    "message": "Estado inválido. Debe ser Pendiente, En progreso o Completada"
                }, 400
            procesar_cambio_estado_familiar(nota, username, nuevo_estado)
            try:
                db.session.commit()
                return {
                    "message": f"Estado actualizado a «{nuevo_estado}»",
                    "nota": nota.to_dict(),
                }, 200
            except Exception:
                db.session.rollback()
                return {"message": "Error al actualizar el estado de la tarea"}, 500

        # Caso 2: Endpoint /grilla/<id>/completar (Toggle de completada)
        if request.path.endswith("/completar"):
            if "completada" in data:
                comp = bool(data["completada"])
            else:
                comp = True
            nuevo_estado = "Completada" if comp else "Pendiente"
            procesar_cambio_estado_familiar(nota, username, nuevo_estado)
            try:
                db.session.commit()
                return {
                    "message": "Su tarea ha sido marcada como completada y guardada en el historial"
                    if nota.completada
                    else "Tarea reabierta y movida a pendientes",
                    "nota": nota.to_dict(),
                }, 200
            except Exception:
                db.session.rollback()
                return {"message": "Error al actualizar la nota"}, 500

        # Caso 3: Si es miembro asignado (no líder), solo puede actualizar subtareas o estado_tarea
        campos_restringidos = {
            "titulo",
            "descripcion",
            "prioridad",
            "categoria",
            "fijada",
            "fecha_vencimiento",
            "asignado_a",
        }
        if not es_lider and any(k in data for k in campos_restringidos):
            return {
                "message": "Solo el líder del grupo familiar puede modificar la consigna o prioridad de la tarea"
            }, 403

        if "titulo" in data:
            nuevo_titulo = (data.get("titulo") or "").strip()
            if not nuevo_titulo:
                return {
                    "message": "Error al modificar la nota: El título es obligatorio."
                }, 400
            if len(nuevo_titulo) > MAX_TITULO_LEN:
                return {
                    "message": f"El título no puede superar los {MAX_TITULO_LEN} caracteres"
                }, 400
            nota.titulo = nuevo_titulo

        if "descripcion" in data:
            nueva_desc = (data.get("descripcion") or "").strip()
            if len(nueva_desc) > MAX_DESC_LEN:
                return {
                    "message": f"La descripción no puede superar los {MAX_DESC_LEN} caracteres"
                }, 400
            nota.descripcion = nueva_desc

        if "prioridad" in data:
            nueva_pri = data.get("prioridad")
            if nueva_pri not in PRIORIDADES_VALIDAS:
                return {"message": "Prioridad inválida"}, 400
            nota.prioridad = nueva_pri

        if "categoria" in data:
            nueva_cat = data.get("categoria")
            if nueva_cat not in CATEGORIAS_VALIDAS:
                return {"message": "Categoría inválida"}, 400
            nota.categoria = nueva_cat

        if "fijada" in data:
            nota.fijada = bool(data.get("fijada"))

        if "fecha_vencimiento" in data:
            nota.fecha_vencimiento = data.get("fecha_vencimiento") or None

        if "asignado_a" in data and nota.grupo_id:
            nuevo_asig = (data.get("asignado_a") or "").strip()
            u_dest = db.session.get(Usuario, nuevo_asig)
            if not u_dest or u_dest.grupo_id != nota.grupo_id:
                return {
                    "message": "El usuario seleccionado no pertenece al grupo familiar"
                }, 400
            if nuevo_asig != nota.asignado_a and nuevo_asig != username:
                crear_notificacion(
                    destinatario=nuevo_asig,
                    emisor=username,
                    tipo="tarea_asignada",
                    mensaje=f"📌 Te asignaron la tarea «{nota.titulo}»",
                    nota_id=nota.id,
                )
            nota.asignado_a = nuevo_asig

        if "subtareas" in data and isinstance(data.get("subtareas"), list):
            sincronizar_subtareas(nota, data["subtareas"])

        if "estado_tarea" in data and data["estado_tarea"] in ESTADOS_TAREA_VALIDOS:
            procesar_cambio_estado_familiar(nota, username, data["estado_tarea"])
        elif "completada" in data:
            nuevo_est = "Completada" if bool(data["completada"]) else "Pendiente"
            procesar_cambio_estado_familiar(nota, username, nuevo_est)

        nota.fecha_modificacion = datetime.datetime.now().isoformat()

        try:
            db.session.commit()
            return {
                "message": "¡Tarea modificada con éxito!",
                "nota": nota.to_dict(),
            }, 200
        except Exception:
            db.session.rollback()
            return {"message": "Error al actualizar la nota"}, 500

    @jwt_required()
    def delete(self, id_nota):
        current_user = get_jwt_identity()
        nota = db.session.get(Nota, id_nota)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not es_lider_o_autor(nota, current_user):
            return {
                "message": "Solo el creador o líder del grupo familiar puede eliminar esta tarjeta"
            }, 403

        definitivo = request.args.get("definitivo", "").lower() == "true"

        if definitivo:
            eliminar_archivos_fisicos(nota)
            db.session.delete(nota)
            msg = "Nota eliminada definitivamente"
        else:
            nota.fecha_baja = datetime.datetime.now().isoformat()
            msg = "¡Tarea eliminada exitosamente!"

        try:
            db.session.commit()
            return {"message": msg}, 200
        except Exception:
            db.session.rollback()
            return {"message": "Error al eliminar la nota"}, 500


class GrillaRestore(Resource):
    @jwt_required()
    def post(self, id_nota):
        current_user = get_jwt_identity()
        nota = db.session.get(Nota, id_nota)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not es_lider_o_autor(nota, current_user):
            return {"message": "No tiene permiso"}, 403

        nota.fecha_baja = None
        nota.fecha_modificacion = datetime.datetime.now().isoformat()
        try:
            db.session.commit()
            return {
                "message": "Nota restaurada exitosamente",
                "nota": nota.to_dict(),
            }, 200
        except Exception:
            db.session.rollback()
            return {"message": "Error al restaurar la nota"}, 500


class GrillaVaciarPapelera(Resource):
    @jwt_required()
    def delete(self):
        current_user = get_jwt_identity()
        username = current_user.get("username")
        notas_papelera = Nota.query.filter(
            Nota.usuario_username == username, Nota.fecha_baja.isnot(None)
        ).all()

        eliminadas_count = len(notas_papelera)
        for n in notas_papelera:
            eliminar_archivos_fisicos(n)
            db.session.delete(n)

        try:
            db.session.commit()
            return {
                "message": f"Papelera vaciada ({eliminadas_count} notas eliminadas definitivamente)",
                "eliminadas": eliminadas_count,
            }, 200
        except Exception:
            db.session.rollback()
            return {"message": "Error al vaciar la papelera"}, 500


class GrillaAdjuntos(Resource):
    @jwt_required()
    def post(self, id_nota):
        current_user = get_jwt_identity()
        nota = db.session.get(Nota, id_nota)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not puede_interactuar_nota(nota, current_user):
            return {
                "message": "No tiene permiso para adjuntar archivos a esta nota"
            }, 403

        if "archivo" not in request.files:
            return {"message": "No se envió ningún archivo"}, 400

        file = request.files["archivo"]
        if not file or not file.filename:
            return {"message": "Nombre de archivo inválido"}, 400

        original_name = file.filename
        ext = (
            original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
        )
        if ext not in EXTENSIONES_PERMITIDAS:
            return {
                "message": "Formato no permitido. Solo se aceptan PDF, DOCX, JPG y PNG."
            }, 400

        file_bytes = file.read()
        size_bytes = len(file_bytes)
        if size_bytes > 10 * 1024 * 1024:
            return {"message": "El archivo excede el tamaño máximo (10 MB)"}, 400

        safe_base = secure_filename(original_name)
        timestamp_prefix = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        stored_filename = f"nota{id_nota}_{timestamp_prefix}_{safe_base}"
        upload_folder = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_folder, exist_ok=True)
        save_path = os.path.join(upload_folder, stored_filename)

        with open(save_path, "wb") as f_out:
            f_out.write(file_bytes)

        mime_guess, _ = mimetypes.guess_type(original_name)
        mime_type = file.mimetype or mime_guess or "application/octet-stream"

        nuevo_adj = Adjunto(
            nota_id=nota.id,
            nombre=original_name,
            filename=stored_filename,
            url=f"/uploads/{stored_filename}",
            extension=ext.upper(),
            tamano=size_bytes,
            mime_type=mime_type,
            datos_binarios=file_bytes,
            fecha=datetime.datetime.now().isoformat(),
        )
        nota.adjuntos.append(nuevo_adj)
        nota.fecha_modificacion = datetime.datetime.now().isoformat()

        try:
            db.session.commit()
            return {
                "message": "Archivo agregado correctamente",
                "adjunto": nuevo_adj.to_dict(),
                "nota": nota.to_dict(),
            }, 201
        except Exception:
            db.session.rollback()
            return {"message": "Error al guardar metadatos del archivo"}, 500

    @jwt_required()
    def delete(self, id_nota, filename):
        current_user = get_jwt_identity()
        nota = db.session.get(Nota, id_nota)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not puede_interactuar_nota(nota, current_user):
            return {"message": "No tiene permiso"}, 403

        adj = next((a for a in nota.adjuntos if a.filename == filename), None)
        if not adj:
            return {"message": "Archivo adjunto no encontrado"}, 404

        upload_folder = current_app.config["UPLOAD_FOLDER"]
        fpath = os.path.join(upload_folder, filename)
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
            except Exception:
                pass

        db.session.delete(adj)
        nota.fecha_modificacion = datetime.datetime.now().isoformat()

        try:
            db.session.commit()
            return {
                "message": "Archivo adjunto eliminado",
                "nota": nota.to_dict(),
            }, 200
        except Exception:
            db.session.rollback()
            return {"message": "Error al actualizar la nota"}, 500
