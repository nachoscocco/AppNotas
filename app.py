from flask import Flask, send_from_directory, jsonify
from flask_restful import Api
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

from resources.auth import Registro, Login, VerificarCodigo
from resources.grilla import Grilla, GrillaRestore

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "supersecreto")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
app.config["JWT_VERIFY_SUB"] = False

app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
app.config["MAIL_USE_SSL"] = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")
app.config["MAIL_DEFAULT_SENDER"] = (os.environ.get("MAIL_SENDER_NAME", "App Notas"), app.config["MAIL_USERNAME"])

mail = Mail(app)
jwt = JWTManager(app)

api = Api(app, prefix="/api/v1")

# Auth
api.add_resource(Registro, "/auth/registro")
api.add_resource(Login, "/auth/login")
api.add_resource(VerificarCodigo, "/auth/verificar-codigo")

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
@app.route("/login")
@app.route("/registro")
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
