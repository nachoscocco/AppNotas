from flask import Flask, send_from_directory, jsonify
from flask_restful import Api
from flask_jwt_extended import JWTManager
from datetime import timedelta
import os

from resources.auth import Registro, Login
from resources.grilla import Grilla, GrillaRestore

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "supersecreto")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
app.config["JWT_VERIFY_SUB"] = False

jwt = JWTManager(app)

api = Api(app, prefix="/api/v1")

# Auth
api.add_resource(Registro, "/auth/registro")
api.add_resource(Login, "/auth/login")

# Notas
api.add_resource(
    Grilla,
    "/grilla",
    "/grilla/<int:id_nota>",
    "/grilla/<int:id_nota>/completar",
    "/grilla/completadas",
    "/grilla/archivadas",
)
api.add_resource(GrillaRestore, "/grilla/<int:id_nota>/restaurar")


# ── SPA routes ────────────────────────────────────────────────────
@app.route("/")
@app.route("/grilla")
@app.route("/alta-nota")
def index():
    return send_from_directory("static", "index.html")

@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory("static", filename)


# ── Error handlers ────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint no encontrado"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Error interno del servidor"}), 500


if __name__ == "__main__":
    app.run(debug=True)
