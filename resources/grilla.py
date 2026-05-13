import json
from flask import request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
import datetime

archivo_de_usuarios = "data/users.json"
archivo_de_notas = "data/cards.json"
prioridad_orden = {"Urgente": 1, "Media": 2, "Baja": 3}

def cargar_archivo(archivo):
    with open(archivo, "r") as f:
        return json.load(f)

def guardar_notas(notas):
    with open(archivo_de_notas, "w") as f:
        json.dump(notas, f, indent=4, ensure_ascii=False)

def obtener_siguiente_id(notas):
    ids = [e.get("id") for e in notas]
    return max(ids) + 1 if ids else 1

def puede_modificar_nota(nota, usuario):
    return usuario.get("username") == nota.get("usuario")

def obtener_notas_usuario(nombre_usuario):
    notas_totales = cargar_archivo(archivo_de_notas)
    notas_filtradas = [
        nota for nota in notas_totales
        if nota.get("usuario") == nombre_usuario
        and nota.get("fecha_baja") is None
        and nota.get("completada") == False
    ]
    return sorted(notas_filtradas, key=lambda n: prioridad_orden.get(n.get("prioridad"), 99))

def obtener_notas_completadas_usuario(nombre_usuario):
    notas_totales = cargar_archivo(archivo_de_notas)
    notas_filtradas = [
        nota for nota in notas_totales
        if nota.get("usuario") == nombre_usuario
        and nota.get("completada") == True
        and nota.get("fecha_baja") is None
    ]
    return sorted(notas_filtradas, key=lambda n: n.get("fecha_modificacion") or n.get("fecha_creacion"), reverse=True)

def obtener_notas_archivadas_usuario(nombre_usuario):
    notas_totales = cargar_archivo(archivo_de_notas)
    notas_filtradas = [
        nota for nota in notas_totales
        if nota.get("usuario") == nombre_usuario
        and nota.get("fecha_baja") is not None
    ]
    return sorted(notas_filtradas, key=lambda n: n.get("fecha_baja") or n.get("fecha_creacion"), reverse=True)


class Grilla(Resource):
    @jwt_required()
    def get(self, id_nota=None):
        try:
            usuario_logueado = get_jwt_identity()
            if not usuario_logueado:
                return {"message": "Token inválido o expirado"}, 401
            nombre_usuario = usuario_logueado.get("username")

            if request.path.endswith("/completadas"):
                notas = obtener_notas_completadas_usuario(nombre_usuario)
            elif request.path.endswith("/archivadas"):
                notas = obtener_notas_archivadas_usuario(nombre_usuario)
            else:
                notas = obtener_notas_usuario(nombre_usuario)

            return {"notas": notas}, 200
        except Exception as e:
            return {"message": f"Error al procesar la solicitud: {str(e)}"}, 500

    @jwt_required()
    def post(self):
        data = request.get_json()
        titulo = data.get("titulo")
        descripcion = data.get("descripcion")
        prioridad = data.get("prioridad")

        if not titulo:
            return {"message": "Debe incluir título"}, 400

        usuario_logueado = get_jwt_identity()
        autor = usuario_logueado.get("username")

        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        siguiente_id = obtener_siguiente_id(notas)
        notas.append({
            "id": siguiente_id,
            "titulo": titulo,
            "descripcion": descripcion,
            "prioridad": prioridad,
            "fecha_creacion": datetime.datetime.now().isoformat(),
            "fecha_baja": None,
            "fecha_modificacion": None,
            "usuario": autor,
            "completada": False,
        })

        try:
            guardar_notas(notas)
            return {"message": "nota creada", "id": siguiente_id}, 201
        except:
            return {"message": "Error al escribir el archivo de notas"}, 500

    @jwt_required()
    def delete(self, id_nota):
        current_user = get_jwt_identity()
        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        nota = next((n for n in notas if n.get("id") == id_nota), None)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not puede_modificar_nota(nota, current_user):
            return {"message": "No tiene permiso para eliminar la nota"}, 403

        nota["fecha_baja"] = datetime.datetime.now().isoformat()
        try:
            guardar_notas(notas)
            return {"message": "nota eliminada"}, 200
        except:
            return {"message": "Error al escribir el archivo de notas"}, 500

    @jwt_required()
    def put(self, id_nota):
        current_user = get_jwt_identity()
        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        nota = next((n for n in notas if n.get("id") == id_nota), None)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not puede_modificar_nota(nota, current_user):
            return {"message": "No tiene permiso"}, 403

        data = request.get_json() or {}
        # Si viene "completada" en el body usamos ese valor, si no, por defecto True
        if "completada" in data:
            nota["completada"] = bool(data["completada"])
        else:
            nota["completada"] = True
        nota["fecha_modificacion"] = datetime.datetime.now().isoformat()

        try:
            guardar_notas(notas)
            return {"message": "nota actualizada"}, 200
        except:
            return {"message": "Error al escribir el archivo de notas"}, 500


class GrillaRestore(Resource):
    @jwt_required()
    def post(self, id_nota):
        current_user = get_jwt_identity()
        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        nota = next((n for n in notas if n.get("id") == id_nota), None)
        if not nota:
            return {"message": "No se encontró la nota"}, 404
        if not puede_modificar_nota(nota, current_user):
            return {"message": "No tiene permiso"}, 403

        nota["fecha_baja"] = None
        nota["fecha_modificacion"] = datetime.datetime.now().isoformat()
        try:
            guardar_notas(notas)
            return {"message": "nota restaurada"}, 200
        except:
            return {"message": "Error al escribir el archivo de notas"}, 500
