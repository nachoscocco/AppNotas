import os
import json
import datetime
import mimetypes
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, inspect

db = SQLAlchemy()


class GrupoFamiliar(db.Model):
    __tablename__ = "grupos_familiares"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nombre = db.Column(db.String(80), nullable=False)
    codigo_invitacion = db.Column(db.String(12), unique=True, nullable=False)
    lider_username = db.Column(
        db.String(50), db.ForeignKey("usuarios.username"), nullable=False
    )
    fecha_creacion = db.Column(db.String(40), nullable=True)

    def to_dict(self, include_members=True):
        data = {
            "id": self.id,
            "nombre": self.nombre,
            "codigo_invitacion": self.codigo_invitacion,
            "lider": self.lider_username,
            "fecha_creacion": self.fecha_creacion,
        }
        if include_members:
            miembros_objs = (
                Usuario.query.filter_by(grupo_id=self.id)
                .order_by(Usuario.username)
                .all()
            )
            notas_grupo = Nota.query.filter(
                Nota.grupo_id == self.id, Nota.fecha_baja.is_(None)
            ).all()
            miembros_list = []
            for m in miembros_objs:
                asignadas = [
                    n for n in notas_grupo if n.asignado_a == m.username
                ]
                pend = sum(
                    1
                    for n in asignadas
                    if (n.estado_tarea or "Pendiente") == "Pendiente"
                    and not n.completada
                )
                prog = sum(
                    1
                    for n in asignadas
                    if n.estado_tarea == "En progreso" and not n.completada
                )
                comp = sum(
                    1
                    for n in asignadas
                    if n.completada or n.estado_tarea == "Completada"
                )
                miembros_list.append(
                    {
                        "username": m.username,
                        "nombre": m.nombre or m.username,
                        "apellido": m.apellido or "",
                        "email": m.email or "",
                        "rol_grupo": "lider"
                        if m.username == self.lider_username
                        else (m.rol_grupo or "miembro"),
                        "metricas": {
                            "pendientes": pend,
                            "en_progreso": prog,
                            "completadas": comp,
                            "total": len(asignadas),
                        },
                    }
                )
            data["miembros"] = miembros_list
        return data


class Usuario(db.Model):
    __tablename__ = "usuarios"

    username = db.Column(db.String(50), primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    apellido = db.Column(db.String(100), default="")
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user")
    activo = db.Column(db.Boolean, default=True)
    verificado = db.Column(db.Boolean, default=False)
    codigo_verificacion = db.Column(db.String(10), nullable=True)
    codigo_recuperacion = db.Column(db.String(10), nullable=True)
    fecha_alta = db.Column(db.String(40), nullable=True)
    fecha_modificacion = db.Column(db.String(40), nullable=True)
    grupo_id = db.Column(
        db.Integer,
        db.ForeignKey("grupos_familiares.id", ondelete="SET NULL"),
        nullable=True,
    )
    rol_grupo = db.Column(db.String(20), nullable=True)

    notas = db.relationship(
        "Nota",
        backref="autor_rel",
        lazy=True,
        foreign_keys="Nota.usuario_username",
    )

    def to_dict(self):
        return {
            "username": self.username,
            "nombre": self.nombre or self.username,
            "apellido": self.apellido or "",
            "email": self.email or "",
            "role": self.role or "user",
            "activo": bool(self.activo),
            "verificado": bool(self.verificado),
            "fecha_alta": self.fecha_alta,
            "fecha_modificacion": self.fecha_modificacion,
            "grupo_id": self.grupo_id,
            "rol_grupo": self.rol_grupo,
        }


class Nota(db.Model):
    __tablename__ = "notas"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    titulo = db.Column(db.String(60), nullable=False)
    descripcion = db.Column(db.String(500), default="")
    prioridad = db.Column(db.String(20), default="Media")
    categoria = db.Column(db.String(30), default="Personal")
    fijada = db.Column(db.Boolean, default=False)
    fecha_vencimiento = db.Column(db.String(20), nullable=True)
    completada = db.Column(db.Boolean, default=False)
    estado_tarea = db.Column(db.String(20), default="Pendiente")
    fecha_creacion = db.Column(db.String(40), nullable=True)
    fecha_modificacion = db.Column(db.String(40), nullable=True)
    fecha_baja = db.Column(db.String(40), nullable=True)
    usuario_username = db.Column(
        db.String(50), db.ForeignKey("usuarios.username"), nullable=False
    )
    grupo_id = db.Column(
        db.Integer,
        db.ForeignKey("grupos_familiares.id", ondelete="CASCADE"),
        nullable=True,
    )
    asignado_a = db.Column(
        db.String(50), db.ForeignKey("usuarios.username"), nullable=True
    )

    subtareas = db.relationship(
        "Subtarea",
        backref="nota",
        cascade="all, delete-orphan",
        order_by="Subtarea.orden_local",
        lazy="selectin",
    )
    adjuntos = db.relationship(
        "Adjunto",
        backref="nota",
        cascade="all, delete-orphan",
        order_by="Adjunto.id",
        lazy="selectin",
    )

    def to_dict(self):
        estado = self.estado_tarea or (
            "Completada" if self.completada else "Pendiente"
        )
        return {
            "id": self.id,
            "titulo": self.titulo,
            "descripcion": self.descripcion or "",
            "prioridad": self.prioridad or "Media",
            "categoria": self.categoria or "Personal",
            "fijada": bool(self.fijada),
            "fecha_vencimiento": self.fecha_vencimiento,
            "subtareas": [s.to_dict() for s in self.subtareas],
            "adjuntos": [a.to_dict() for a in self.adjuntos],
            "fecha_creacion": self.fecha_creacion,
            "fecha_modificacion": self.fecha_modificacion,
            "fecha_baja": self.fecha_baja,
            "usuario": self.usuario_username,
            "completada": bool(self.completada),
            "grupo_id": self.grupo_id,
            "asignado_a": self.asignado_a,
            "estado_tarea": estado,
        }


class Subtarea(db.Model):
    __tablename__ = "subtareas"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nota_id = db.Column(
        db.Integer, db.ForeignKey("notas.id", ondelete="CASCADE"), nullable=False
    )
    orden_local = db.Column(db.Integer, nullable=False, default=1)
    texto = db.Column(db.String(200), nullable=False)
    hecha = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.orden_local,
            "texto": self.texto,
            "hecha": bool(self.hecha),
        }


class Adjunto(db.Model):
    __tablename__ = "adjuntos"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nota_id = db.Column(
        db.Integer, db.ForeignKey("notas.id", ondelete="CASCADE"), nullable=False
    )
    nombre = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), unique=True, nullable=False)
    url = db.Column(db.String(300), nullable=False)
    extension = db.Column(db.String(10), nullable=False)
    tamano = db.Column(db.Integer, default=0)
    mime_type = db.Column(db.String(100), nullable=True)
    datos_binarios = db.Column(db.LargeBinary, nullable=True)
    fecha = db.Column(db.String(40), nullable=True)

    def to_dict(self):
        return {
            "nombre": self.nombre,
            "filename": self.filename,
            "url": self.url,
            "extension": self.extension,
            "tamano": self.tamano,
            "fecha": self.fecha,
        }


class Notificacion(db.Model):
    __tablename__ = "notificaciones"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    destinatario_username = db.Column(
        db.String(50),
        db.ForeignKey("usuarios.username", ondelete="CASCADE"),
        nullable=False,
    )
    emisor_username = db.Column(
        db.String(50),
        db.ForeignKey("usuarios.username", ondelete="SET NULL"),
        nullable=True,
    )
    nota_id = db.Column(
        db.Integer,
        db.ForeignKey("notas.id", ondelete="CASCADE"),
        nullable=True,
    )
    tipo = db.Column(db.String(30), nullable=False)
    mensaje = db.Column(db.String(300), nullable=False)
    leida = db.Column(db.Boolean, default=False)
    fecha = db.Column(db.String(40), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "destinatario": self.destinatario_username,
            "emisor": self.emisor_username,
            "nota_id": self.nota_id,
            "tipo": self.tipo,
            "mensaje": self.mensaje,
            "leida": bool(self.leida),
            "fecha": self.fecha,
        }


def asegurar_columnas_spec02():
    """Garantiza que las columnas de Spec 02 existan si la base fue creada en Spec 01."""
    insp = inspect(db.engine)
    if "usuarios" in insp.get_table_names():
        cols_u = {c["name"] for c in insp.get_columns("usuarios")}
        if "grupo_id" not in cols_u:
            db.session.execute(
                text("ALTER TABLE usuarios ADD COLUMN grupo_id INTEGER NULL")
            )
        if "rol_grupo" not in cols_u:
            db.session.execute(
                text("ALTER TABLE usuarios ADD COLUMN rol_grupo VARCHAR(20) NULL")
            )
    if "notas" in insp.get_table_names():
        cols_n = {c["name"] for c in insp.get_columns("notas")}
        if "grupo_id" not in cols_n:
            db.session.execute(
                text("ALTER TABLE notas ADD COLUMN grupo_id INTEGER NULL")
            )
        if "asignado_a" not in cols_n:
            db.session.execute(
                text("ALTER TABLE notas ADD COLUMN asignado_a VARCHAR(50) NULL")
            )
        if "estado_tarea" not in cols_n:
            db.session.execute(
                text(
                    "ALTER TABLE notas ADD COLUMN estado_tarea VARCHAR(20) DEFAULT 'Pendiente'"
                )
            )
    db.session.commit()


def inicializar_y_migrar_db(app, base_dir):
    """Crea las tablas SQL e importa automáticamente los datos semilla de users.json, cards.json y grupo familiar demo."""
    with app.app_context():
        db.create_all()
        asegurar_columnas_spec02()

        archivo_usuarios = os.path.join(base_dir, "data", "users.json")
        archivo_notas = os.path.join(base_dir, "data", "cards.json")
        upload_folder = app.config.get("UPLOAD_FOLDER")

        # 1. Migrar usuarios si la tabla está vacía
        if Usuario.query.count() == 0 and os.path.exists(archivo_usuarios):
            try:
                with open(archivo_usuarios, "r", encoding="utf-8") as f:
                    usuarios_json = json.load(f)
                for uname, udata in usuarios_json.items():
                    nuevo_usuario = Usuario(
                        username=uname,
                        nombre=udata.get("nombre") or uname,
                        apellido=udata.get("apellido") or "",
                        email=udata.get("email") or f"{uname}@appnotas.local",
                        password=udata.get("password", ""),
                        role=udata.get("role", "user"),
                        activo=bool(udata.get("activo", True)),
                        verificado=bool(udata.get("verificado", True)),
                        codigo_verificacion=udata.get("codigo_verificacion"),
                        codigo_recuperacion=udata.get("codigo_recuperacion"),
                        fecha_alta=udata.get("fecha_alta"),
                        fecha_modificacion=udata.get("fecha_modificacion"),
                    )
                    db.session.add(nuevo_usuario)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"[AppNotas DB] Error al migrar usuarios iniciales: {e}")

        # 2. Migrar notas si la tabla está vacía
        if Nota.query.count() == 0 and os.path.exists(archivo_notas):
            try:
                with open(archivo_notas, "r", encoding="utf-8") as f:
                    notas_json = json.load(f)
                for ndata in notas_json:
                    autor = ndata.get("usuario", "nacho")
                    if not db.session.get(Usuario, autor):
                        continue
                    comp = bool(ndata.get("completada", False))
                    nota_obj = Nota(
                        id=ndata.get("id"),
                        titulo=(ndata.get("titulo") or "Sin título")[:60],
                        descripcion=(ndata.get("descripcion") or "")[:500],
                        prioridad=ndata.get("prioridad") or "Media",
                        categoria=ndata.get("categoria") or "Personal",
                        fijada=bool(ndata.get("fijada", False)),
                        fecha_vencimiento=ndata.get("fecha_vencimiento"),
                        completada=comp,
                        estado_tarea="Completada" if comp else "Pendiente",
                        fecha_creacion=ndata.get("fecha_creacion"),
                        fecha_modificacion=ndata.get("fecha_modificacion"),
                        fecha_baja=ndata.get("fecha_baja"),
                        usuario_username=autor,
                    )
                    db.session.add(nota_obj)
                    db.session.flush()

                    for idx, st in enumerate(ndata.get("subtareas") or [], start=1):
                        texto_st = str(st.get("texto") or "").strip()
                        if texto_st:
                            db.session.add(
                                Subtarea(
                                    nota_id=nota_obj.id,
                                    orden_local=st.get("id") or idx,
                                    texto=texto_st[:200],
                                    hecha=bool(st.get("hecha", False)),
                                )
                            )

                    for adj in ndata.get("adjuntos") or []:
                        fname = adj.get("filename")
                        if not fname:
                            continue
                        bin_data = None
                        if upload_folder:
                            fpath = os.path.join(upload_folder, fname)
                            if os.path.exists(fpath):
                                try:
                                    with open(fpath, "rb") as bf:
                                        bin_data = bf.read()
                                except Exception:
                                    pass
                        mime_guess, _ = mimetypes.guess_type(fname)
                        db.session.add(
                            Adjunto(
                                nota_id=nota_obj.id,
                                nombre=adj.get("nombre") or fname,
                                filename=fname,
                                url=adj.get("url") or f"/uploads/{fname}",
                                extension=adj.get("extension") or "BIN",
                                tamano=adj.get("tamano") or 0,
                                mime_type=mime_guess or "application/octet-stream",
                                datos_binarios=bin_data,
                                fecha=adj.get("fecha"),
                            )
                        )

                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"[AppNotas DB] Error al migrar notas iniciales: {e}")

        # 3. Crear Grupo Familiar de demostración (Familia Scocco - FAM-2026) si aún no hay grupos
        if GrupoFamiliar.query.count() == 0:
            try:
                u_nacho = db.session.get(Usuario, "nacho")
                u_alicia = db.session.get(Usuario, "alicia")
                u_bruno = db.session.get(Usuario, "bruno")

                if u_nacho and u_alicia and u_bruno:
                    ahora = datetime.datetime.now().isoformat()
                    grupo_demo = GrupoFamiliar(
                        nombre="Familia Scocco",
                        codigo_invitacion="FAM-2026",
                        lider_username="nacho",
                        fecha_creacion=ahora,
                    )
                    db.session.add(grupo_demo)
                    db.session.flush()

                    u_nacho.grupo_id = grupo_demo.id
                    u_nacho.rol_grupo = "lider"
                    u_alicia.grupo_id = grupo_demo.id
                    u_alicia.rol_grupo = "miembro"
                    u_bruno.grupo_id = grupo_demo.id
                    u_bruno.rol_grupo = "miembro"

                    t1 = Nota(
                        titulo="Ordenar el cuarto y preparar mochila",
                        descripcion="Separar los cuadernos del martes y dejar el escritorio despejado.",
                        prioridad="Media",
                        categoria="Casa",
                        fijada=True,
                        fecha_vencimiento="2026-11-15",
                        completada=False,
                        estado_tarea="Pendiente",
                        fecha_creacion=ahora,
                        usuario_username="nacho",
                        grupo_id=grupo_demo.id,
                        asignado_a="alicia",
                    )
                    t2 = Nota(
                        titulo="Sacar la basura y pasear a Rocco",
                        descripcion="Acordate de llevar la correa verde y bolsas antes de las 19hs.",
                        prioridad="Urgente",
                        categoria="Casa",
                        fijada=False,
                        fecha_vencimiento="2026-11-12",
                        completada=False,
                        estado_tarea="En progreso",
                        fecha_creacion=ahora,
                        fecha_modificacion=ahora,
                        usuario_username="nacho",
                        grupo_id=grupo_demo.id,
                        asignado_a="bruno",
                    )
                    t3 = Nota(
                        titulo="Comprar pan y leche para la merienda",
                        descripcion="Pasar por la panadería de la esquina al volver de la escuela.",
                        prioridad="Baja",
                        categoria="Casa",
                        fijada=False,
                        fecha_vencimiento="2026-11-10",
                        completada=True,
                        estado_tarea="Completada",
                        fecha_creacion=ahora,
                        fecha_modificacion=ahora,
                        usuario_username="nacho",
                        grupo_id=grupo_demo.id,
                        asignado_a="alicia",
                    )
                    db.session.add_all([t1, t2, t3])
                    db.session.flush()

                    t1.subtareas.append(
                        Subtarea(
                            orden_local=1,
                            texto="Guardar útiles en la cartuchera",
                            hecha=True,
                        )
                    )
                    t1.subtareas.append(
                        Subtarea(
                            orden_local=2,
                            texto="Tender la cama",
                            hecha=False,
                        )
                    )
                    t2.subtareas.append(
                        Subtarea(
                            orden_local=1,
                            texto="Sacar bolsas al contenedor",
                            hecha=True,
                        )
                    )
                    t2.subtareas.append(
                        Subtarea(
                            orden_local=2,
                            texto="Dar vuelta a la plaza con Rocco",
                            hecha=False,
                        )
                    )

                    db.session.add_all(
                        [
                            Notificacion(
                                destinatario_username="nacho",
                                emisor_username="alicia",
                                nota_id=t3.id,
                                tipo="tarea_completada",
                                mensaje="✅ Alicia completó la tarea «Comprar pan y leche para la merienda»",
                                leida=False,
                                fecha=ahora,
                            ),
                            Notificacion(
                                destinatario_username="nacho",
                                emisor_username="bruno",
                                nota_id=t2.id,
                                tipo="tarea_en_progreso",
                                mensaje="🔄 Bruno puso en progreso «Sacar la basura y pasear a Rocco»",
                                leida=False,
                                fecha=ahora,
                            ),
                            Notificacion(
                                destinatario_username="alicia",
                                emisor_username="nacho",
                                nota_id=t1.id,
                                tipo="tarea_asignada",
                                mensaje="📌 Nacho te asignó la tarea «Ordenar el cuarto y preparar mochila»",
                                leida=False,
                                fecha=ahora,
                            ),
                        ]
                    )
                    db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"[AppNotas DB] Error al crear grupo familiar semilla: {e}")

        # Sincronizar secuencia de IDs en PostgreSQL si corresponde
        if db.engine.dialect.name == "postgresql":
            try:
                db.session.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence('notas', 'id'), COALESCE((SELECT MAX(id) FROM notas), 1));"
                    )
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
