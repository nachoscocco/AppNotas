import json
from flask import request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import datetime

archivo_de_usuarios = "data/users.json"
archivo_de_notas = "data/cards.json"
prioridad_orden = {"Urgente": 1, "Media": 2, "Baja": 3}

# Funciones auxiliares
def cargar_archivo(archivo):
    '''Interpreta el contenido de un archivo json y lo retorna'''
    with open(archivo, "r") as f:
        return json.load(f)

def guardar_notas(notas):
    '''Escribe el contenido de los notas en el archivo'''
    with open(archivo_de_notas, "w") as f:
        json.dump(notas, f, indent=4, ensure_ascii = False)

def obtener_siguiente_id(notas):
    '''Indica cuál es el id del próximo nota a guardar (el id más grande del
    archivo más 1)'''
    ids = []
    for e in notas:
        ids.append(e.get("id"))
    return max(ids) + 1

def puede_borrar_nota(nota, usuario):
    '''Retorna True si el usuario puede borrar en nota, False si no puede. Un
    usuario puede borrar un nota cuando es el autor, o cuando tiene rol admin'''
    if usuario.get('username') == nota.get('usuario'):
        return True
    else:
        return False
    
def obtener_notas_usuario(nombre_usuario):
    notas_totales = cargar_archivo(archivo_de_notas)
    #Notas sin completar del usuario
    notas_filtradas = [
        nota for nota in notas_totales 
        if nota.get('usuario') == nombre_usuario 
        and nota.get('fecha_baja') is None 
        and nota.get('fecha-modificacion') is None 
        and nota.get('completada') == False
    ]
    notas_ordenadas = sorted(
        notas_filtradas,
        key=lambda nota: prioridad_orden.get(nota.get("prioridad"), 99)
    )
    return notas_ordenadas

def obtener_notas_completadas_usuario(nombre_usuario):
    notas_totales = cargar_archivo(archivo_de_notas)
    #notas completadas del usuario
    notas_filtradas = [
        nota for nota in notas_totales 
        if nota.get('usuario') == nombre_usuario
        and nota.get('completada') == True
        and nota.get('fecha_baja') is None
    ]
    notas_ordenadas = sorted(
        notas_filtradas,
        key=lambda nota: nota.get("fecha_modificacion") or nota.get("fecha_creacion"),
        reverse=True  # las más recientes primero
    )
    return notas_ordenadas
                                                          
# Resource Links:
class Grilla(Resource):
    @jwt_required()
    def get(self, id_nota = None):
        """Retorna una lista de las notas a mostrar"""
        try:
            usuario_logueado = get_jwt_identity()
            print(usuario_logueado)
            if not usuario_logueado:
                return {"message": "Token inválido o expirado"}, 401
                
            nombre_usuario = usuario_logueado.get("username")

            if request.path.endswith("/completadas"):
                notas_usuario = obtener_notas_completadas_usuario(nombre_usuario)            
            else:
                notas_usuario = obtener_notas_usuario(nombre_usuario)

            return {"notas": notas_usuario}, 200
        
        

        except Exception as e:
            print(f"DEBUG: Error = {str(e)}")
            return {"message": f"Error al procesar la solicitud: {str(e)}"}, 500

    @jwt_required()
    def post(self):
        '''ALTA'''

        # Recibimos el body del POST y lo guardamos en variables:
        data = request.get_json()
        titulo = data.get("titulo")
        descripcion = data.get("descripcion")
        prioridad = data.get("prioridad")

        # Validamos req, si hay nulos falla
        if not titulo:
            return {"message": "Debe incluir título"}, 400

        # Obtenemos la identidad del usuario logueado para guardar como autor:
        usuario_logueado = get_jwt_identity()
        autor = usuario_logueado.get("username")
        
        # Cargamos el archivo con los notas
        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        # Obtenemos el próximo id
        siguiente_id = obtener_siguiente_id(notas)

        # Agregamos a la lista de notas obtenida el nota recibido por POST:
        notas.append({
            "id": siguiente_id,
            "titulo": titulo,
            "descripcion": descripcion,
            "prioridad": prioridad,
            "fecha_creacion": datetime.datetime.now().isoformat(),
            "fecha_baja": None,  
            "fecha_modificacion" : None,
            "usuario": autor,
            "completada" : False
        })

        # Escribimos en el archivo de notas y retornamos el mensaje de éxito
        try:
            guardar_notas(notas)
            return {"message": "nota registrado"}, 201
        except:
            return {"message": "Error al escribir el archivo de notas"}, 500

    @jwt_required()
    def delete(self, id_nota):
        '''BAJA DE NOTA X ID'''

        # Obtenemos el nombre del usuario logueado
        current_user = get_jwt_identity()

        # Cargamos el archivo con los notas:
        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        # Buscamos cuál es el nota que se quiere eliminar:
        nota_a_eliminar = None
        for nota in notas:
            if nota.get("id") == id_nota:
                nota_a_eliminar = nota
                break
        if not nota_a_eliminar:
            return {"message": "No se encontró la nota a eliminar"}, 404

        if puede_borrar_nota(nota_a_eliminar, current_user):
            # Borrado lógico: asignar fecha_baja en lugar de eliminar
            nota_a_eliminar["fecha_baja"] = datetime.datetime.now().isoformat()
            try:
                guardar_notas(notas)
                return {"message": "nota eliminado correctamente"}, 200
            except:
                return {"message": "Error al escribir el archivo de notas"}, 500
        else:
            # Si no tenemos permiso de eliminar, retornamos 403
            return {"message": "No tiene permiso para eliminar la nota"}, 403

    @jwt_required()
    def put(self, id_nota):
        '''COMPLETAR NOTA'''
        
        # Obtenemos el nombre del usuario logueado
        current_user = get_jwt_identity()
        
        # Cargamos el archivo con los notas:
        try:
            notas = cargar_archivo(archivo_de_notas)
        except:
            return {"message": "Error al acceder al archivo de notas"}, 500

        # Buscamos cuál es el nota que se quiere completar:
        nota_a_completar = None
        for nota in notas:
            if nota.get("id") == id_nota:
                nota_a_completar = nota
                break

        # Si no encontramos el nota, indicamos el error 404
        if not nota_a_completar:
            return {"message": "No se encontró la nota a completar"}, 404

        # Validamos que el usuario pueda modificar:
        if puede_borrar_nota(nota_a_completar, current_user):
            # Marcamos la nota como completada
            nota_a_completar["completada"] = True
            nota_a_completar["fecha_modificacion"] = datetime.datetime.now().isoformat()
            
            try:
                guardar_notas(notas)
                return {"message": "nota completada correctamente"}, 200
            except:
                return {"message": "Error al escribir el archivo de notas"}, 500
        else:
            # Si no tenemos permiso de modificar, retornamos 403
            return {"message": "No tiene permiso para completar la nota"}, 403

