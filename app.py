from flask import Flask, jsonify, send_from_directory, Response, abort
from flask_restful import Api
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

from models import db, Adjunto, inicializar_y_migrar_db
from resources.auth import (
    Registro,
    Login,
    VerificarCodigo,
    ReenviarCodigo,
    RecuperarPassword,
    ResetPassword,
    PerfilUsuario,
    ListaUsuarios,
)
from resources.grilla import (
    Grilla,
    GrillaRestore,
    GrillaVaciarPapelera,
    GrillaAdjuntos,
)
from resources.familia import (
    FamiliaResource,
    FamiliaUnirseResource,
    FamiliaMiembrosResource,
    NotificacionesResource,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
DATA_FOLDER = os.path.join(BASE_DIR, "data")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

app = Flask(__name__)

# Límite máximo de archivo adjunto: 10 MB (según especificación RF01.6)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ── Configuración de Base de Datos SQL (PostgreSQL Cloud + Fallback SQLite Local) ──
raw_db_url = os.environ.get("DATABASE_URL", "").strip()
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

default_sqlite_path = os.path.join(DATA_FOLDER, "appnotas.db").replace("\\", "/")
app.config["SQLALCHEMY_DATABASE_URI"] = (
    raw_db_url if raw_db_url else f"sqlite:///{default_sqlite_path}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}

app.config["JWT_SECRET_KEY"] = os.environ.get(
    "JWT_SECRET_KEY", "appnotas_urquiza_jwt_secret_key_2026_segura_32bytes"
)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
app.config["JWT_VERIFY_SUB"] = False

app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
app.config["MAIL_USE_SSL"] = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")
app.config["MAIL_DEFAULT_SENDER"] = (
    os.environ.get("MAIL_SENDER_NAME", "App Notas"),
    app.config["MAIL_USERNAME"],
)

db.init_app(app)
mail = Mail(app)
jwt = JWTManager(app)


@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    return jsonify({"message": "Sesión inválida, volvé a iniciar sesión", "error": error_string}), 401


@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"message": "Tu sesión expiró, volvé a iniciar sesión"}), 401


@jwt.unauthorized_loader
def missing_token_callback(error_string):
    return jsonify({"message": "Falta token de autenticación"}), 401

# Crear tablas e importar datos semilla si la base está vacía
inicializar_y_migrar_db(app, BASE_DIR)

api = Api(app, prefix="/api/v1")

# ── Auth & Perfil ──────────────────────────────────────────────────
api.add_resource(Registro, "/auth/registro")
api.add_resource(Login, "/auth/login")
api.add_resource(VerificarCodigo, "/auth/verificar-codigo")
api.add_resource(ReenviarCodigo, "/auth/reenviar-codigo")
api.add_resource(RecuperarPassword, "/auth/recuperar-password")
api.add_resource(ResetPassword, "/auth/reset-password")
api.add_resource(PerfilUsuario, "/auth/perfil")
api.add_resource(ListaUsuarios, "/usuarios")

# ── Notas, Papelera y Adjuntos ─────────────────────────────────────
api.add_resource(
    Grilla,
    "/grilla",
    "/grilla/completadas",
    "/grilla/archivadas",
    "/grilla/<int:id_nota>",
    "/grilla/<int:id_nota>/completar",
    "/grilla/<int:id_nota>/estado",
)
api.add_resource(GrillaRestore, "/grilla/<int:id_nota>/restaurar")
api.add_resource(GrillaVaciarPapelera, "/grilla/papelera/vaciar")
api.add_resource(
    GrillaAdjuntos,
    "/grilla/<int:id_nota>/adjuntos",
    "/grilla/<int:id_nota>/adjuntos/<string:filename>",
)

# ── Grupo Familiar y Notificaciones (Spec 02) ──────────────────────
api.add_resource(FamiliaResource, "/familia")
api.add_resource(FamiliaUnirseResource, "/familia/unirse")
api.add_resource(
    FamiliaMiembrosResource,
    "/familia/miembros",
    "/familia/miembros/<string:target_username>",
)
api.add_resource(
    NotificacionesResource,
    "/notificaciones",
    "/notificaciones/leer",
)


# ── Archivos subidos (con recuperación desde BD para contenedores efímeros) ──
@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    local_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(local_path):
        return send_from_directory(UPLOAD_FOLDER, filename)

    adj = Adjunto.query.filter_by(filename=filename).first()
    if adj and adj.datos_binarios:
        try:
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            with open(local_path, "wb") as f_cache:
                f_cache.write(adj.datos_binarios)
        except Exception:
            pass
        return Response(
            adj.datos_binarios,
            mimetype=adj.mime_type or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="{adj.nombre}"'},
        )
    abort(404)


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


# ── Error handlers ─────────────────────────────────────────────────
@app.errorhandler(413)
def request_entity_too_large(error):
    return (
        jsonify({"message": "El archivo excede el tamaño máximo permitido (10 MB)"}),
        413,
    )


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint no encontrado"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Error interno del servidor"}), 500


if __name__ == "__main__":
    app.run(debug=True)
