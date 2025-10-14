from flask import Flask, send_from_directory, jsonify 
from flask_restful import Api
from flask_jwt_extended import JWTManager
from datetime import timedelta
import os

# Importamos los resources:
from resources.auth import Registro, Login
from resources.grilla import Grilla

app = Flask(__name__)

# Configuración de la aplicación
app.config["JWT_SECRET_KEY"] = "supersecreto"  # En producción usar variables de entorno
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=30)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
app.config['JWT_VERIFY_SUB'] = False

# Inicializar JWT
jwt = JWTManager(app)

# Configurar API RESTful
api = Api(app, prefix='/api/v1')

# ==================== RUTAS API ====================
# Autenticación
api.add_resource(Registro, "/auth/registro")
api.add_resource(Login, "/auth/login")

# Recursos principales
api.add_resource(Grilla, "/grilla", "/grilla/<int:id_nota>", "/grilla/<int:id_nota>/completar", "/grilla/completadas")


# ==================== RUTAS ESTÁTICAS ====================
@app.route("/")
def index():
    """Login"""
    return send_from_directory("static", "login.html")

@app.route("/grilla")
def grilla_page():
    """Página de grilla de tareas"""
    return send_from_directory("static", "grilla.html")

@app.route("/alta-nota")
def alta_nota_page():
    """Página para crear nueva nota"""
    return send_from_directory("static", "alta_nota.html")


# archivos estáticos
@app.route("/static/<path:filename>")
def serve_static(filename):
    """Servir archivos estáticos"""
    return send_from_directory("static", filename)

# ==================== MANEJO DE ERRORES ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint no encontrado"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Error interno del servidor"}), 500

#TODO: Ruta especifica para admins para ver notas x usuario
#TODO: Ruta para ver notas borradas



if __name__ == "__main__":
    app.run(debug=True)