# Spec 01 — Migración del Modelo de Datos de JSON a Base de Datos SQL (PostgreSQL + SQLite)

- **Proyecto**: AppNotas (Esc. Superior N°49 "Cap. Gral. J.J. Urquiza" — Prácticas Profesionalizantes I)
- **Estado**: Propuesto para Revisión
- **Fecha**: 2026-11-10
- **Dependencias**: Base para Spec 02 (Grupos Familiares)

---

## 1. Objetivo y Motivación

Actualmente, **AppNotas** almacena usuarios y tarjetas en archivos planos (`data/users.json` y `data/cards.json`) y guarda archivos adjuntos únicamente en la carpeta local `uploads/`. Esta arquitectura presenta dos limitaciones críticas:

1. **Persistencia en el Deploy (Cloud PaaS)**: En plataformas de hosting como **Render**, **Railway** o **Koyeb**, el sistema de archivos del contenedor es **efímero**. Cada reinicio o redespliegue borra cualquier cambio escrito en archivos `.json` o en la carpeta `uploads/`.
2. **Integridad Relacional y Concurrencia**: La escritura simultánea de archivos JSON puede corromper datos y dificulta modelar relaciones complejas (como Grupos Familiares, asignaciones cruzadas y notificaciones).

Esta especificación define la migración transparente hacia **Flask-SQLAlchemy** con soporte nativo para **PostgreSQL en la nube** (ej. **Neon.tech** o **Supabase** vía `DATABASE_URL`) para producción, y **SQLite** (`data/appnotas.db`) como fallback automático para desarrollo local sin configuración.

---

## 2. Arquitectura de Persistencia Dual (Cloud + Local)

```mermaid
flowchart LR
    subgraph Backend["Flask API (app.py)"]
        ORM["Flask-SQLAlchemy (models.py)"]
        Auth["resources/auth.py"]
        Grilla["resources/grilla.py"]
        Seeder["seed_from_json()"]
    end

    Auth --> ORM
    Grilla --> ORM
    Seeder --> ORM

    ORM -->|"DATABASE_URL presente (Deploy)"| PG[("PostgreSQL Cloud\n(Neon / Supabase)")]
    ORM -->|"Sin DATABASE_URL (Local)"| SQLite[("SQLite Local\n(data/appnotas.db)")]
```

### 2.1. Resolución de `SQLALCHEMY_DATABASE_URI` en `app.py`
1. Se lee la variable de entorno `DATABASE_URL`.
2. Si comienza con `postgres://` (formato clásico de Heroku/Render), se normaliza automáticamente a `postgresql://` para compatibilidad con SQLAlchemy 2.x y `psycopg2-binary`.
3. Si `DATABASE_URL` no está definida o está vacía, se utiliza `sqlite:///<BASE_DIR>/data/appnotas.db`.
4. Se configura `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}` para reconectar automáticamente conexiones SSL inactivas en PostgreSQL Serverless (Neon/Supabase).

### 2.2. Persistencia de Archivos Adjuntos en Entornos Efímeros
Para evitar que los archivos adjuntos (`PDF`, `DOCX`, `JPG`, `PNG` hasta 10 MB) se pierdan cuando el contenedor de Render/Railway se reinicia:
- La tabla `adjuntos` almacenará los metadatos **y opcionalmente el binario (`datos_binarios` en `LargeBinary` / `BYTEA` + `mime_type`)**.
- Cuando se solicita `GET /uploads/<filename>`:
  1. Si el archivo existe en la carpeta local `uploads/`, se sirve directamente desde disco.
  2. Si el contenedor se reinició y el archivo no está en disco, se recupera de la columna `datos_binarios` de la tabla `adjuntos`, se reconstruye en caché y se devuelve al navegador con su `mime_type` original.

---

## 3. Modelo Entidad-Relación (Fase 1: Core Migrado)

```mermaid
erDiagram
    USUARIO ||--o{ NOTA : "es autor de"
    NOTA ||--o{ SUBTAREA : "contiene"
    NOTA ||--o{ ADJUNTO : "adjunta"

    USUARIO {
        string username PK "VARCHAR(50)"
        string nombre "VARCHAR(100)"
        string apellido "VARCHAR(100)"
        string email UK "VARCHAR(120)"
        string password "VARCHAR(255) bcrypt hash"
        string role "VARCHAR(20) user|estudiante|docente|admin"
        boolean activo "DEFAULT true"
        boolean verificado "DEFAULT false"
        string codigo_verificacion "VARCHAR(10) NULL"
        string codigo_recuperacion "VARCHAR(10) NULL"
        string fecha_alta "VARCHAR(40) ISO-8601"
        string fecha_modificacion "VARCHAR(40) NULL"
    }

    NOTA {
        int id PK "SERIAL / INTEGER AUTOINCREMENT"
        string titulo "VARCHAR(60) NOT NULL"
        string descripcion "VARCHAR(500)"
        string prioridad "VARCHAR(20) Urgente|Media|Baja"
        string categoria "VARCHAR(30) Trabajo|Casa|Personal|Estudio"
        boolean fijada "DEFAULT false"
        string fecha_vencimiento "VARCHAR(20) YYYY-MM-DD NULL"
        boolean completada "DEFAULT false"
        string fecha_creacion "VARCHAR(40) ISO-8601"
        string fecha_modificacion "VARCHAR(40) NULL"
        string fecha_baja "VARCHAR(40) NULL (Papelera)"
        string usuario_username FK "VARCHAR(50) -> usuarios.username"
    }

    SUBTAREA {
        int id PK "SERIAL / INTEGER AUTOINCREMENT"
        int nota_id FK "INTEGER -> notas.id ON DELETE CASCADE"
        int orden_local "INTEGER (id interno 1..N para el frontend)"
        string texto "VARCHAR(200) NOT NULL"
        boolean hecha "DEFAULT false"
    }

    ADJUNTO {
        int id PK "SERIAL / INTEGER AUTOINCREMENT"
        int nota_id FK "INTEGER -> notas.id ON DELETE CASCADE"
        string nombre "VARCHAR(255) nombre original"
        string filename UK "VARCHAR(255) nombre almacenado"
        string url "VARCHAR(300) /uploads/<filename>"
        string extension "VARCHAR(10) PDF|DOCX|JPG|PNG"
        int tamano "INTEGER bytes"
        string mime_type "VARCHAR(100)"
        blob datos_binarios "LargeBinary (persistencia cloud)"
        string fecha "VARCHAR(40) ISO-8601"
    }
```

---

## 4. Diseño de Componentes y Archivos

### 4.1. Nuevo archivo `models.py`
Contendrá la instancia `db = SQLAlchemy()` y las clases modelo:
- `Usuario(db.Model)` (`__tablename__ = "usuarios"`):
  - Método `to_dict()` que serializa exactamente la estructura que hoy consume el frontend.
- `Nota(db.Model)` (`__tablename__ = "notas"`):
  - Relaciones `subtareas` y `adjuntos` con `cascade="all, delete-orphan"`.
  - Método `to_dict()` que devuelve exactamente el mismo JSON que el antiguo `cards.json` (`id`, `titulo`, `descripcion`, `prioridad`, `categoria`, `fijada`, `fecha_vencimiento`, `subtareas`, `adjuntos`, `fecha_creacion`, `fecha_modificacion`, `fecha_baja`, `usuario`, `completada`), garantizando **0 cambios de contrato** con el frontend actual.
- `Subtarea(db.Model)` (`__tablename__ = "subtareas"`):
  - Serializa `{"id": self.orden_local, "texto": self.texto, "hecha": self.hecha}`.
- `Adjunto(db.Model)` (`__tablename__ = "adjuntos"`):
  - Serializa `{"nombre": ..., "filename": ..., "url": ..., "extension": ..., "tamano": ..., "fecha": ...}` (sin exponer `datos_binarios` en el JSON de listado).

### 4.2. Migración Automática de Datos Iniciales (`seed_db.py` / Auto-seed al iniciar)
Al iniciar la aplicación (`with app.app_context(): db.create_all()`):
1. Si la tabla `usuarios` está vacía y existe `data/users.json`, importa automáticamente todos los usuarios (`docente1`, `docente2`, `alicia`, `bruno`, `nacho`, `nacho2`) conservando sus hashes `bcrypt` y fechas originales.
2. Si la tabla `notas` está vacía y existe `data/cards.json`, importa las 9 notas existentes con sus subtareas y metadatos, ajustando la secuencia de IDs de PostgreSQL (`setval`) para que la próxima nota creada reciba el `id = 10` sin colisión de clave primaria.

### 4.3. Refactorización de `resources/auth.py` y `resources/grilla.py`
- **`resources/auth.py`**:
  - Reemplaza `cargar_usuarios()` y `guardar_usuarios()` por consultas SQLAlchemy (`Usuario.query.filter_by(...)`, `db.session.add(...)`, `db.session.commit()`).
- **`resources/grilla.py`**:
  - Reemplaza la lectura/escritura de `cards.json` por queries SQL filtradas y ordenadas (`Nota.query.filter(...)`).
  - Al actualizar `subtareas` en `PUT /api/v1/grilla/<id>`, reemplaza la colección `nota.subtareas` dentro de la misma transacción.
  - Al subir un archivo en `POST /api/v1/grilla/<id>/adjuntos`, guarda tanto el archivo en `uploads/` como el registro `Adjunto` con `datos_binarios` en la base de datos.

### 4.4. Dependencias y Configuración de Deploy
- **`requirements.txt`**:
  - Agregar `Flask-SQLAlchemy==3.1.1`, `SQLAlchemy==2.0.36`, `psycopg2-binary==2.9.10` y `gunicorn==23.0.0` (necesario para ejecutar en producción en Render/Railway).
- **`.env.example`**:
  - Documentar `DATABASE_URL=postgresql://usuario:password@host/dbname?sslmode=require` (comentado por defecto para que en local use SQLite si no se configura).

---

## 5. Criterios de Aceptación y Pruebas (Fase 1)

1. **Arranque en frío (Zero-config local)**: Al borrar `data/appnotas.db` y ejecutar `py app.py`, se crean todas las tablas y se importan automáticamente los 6 usuarios y 9 notas de los archivos `.json` semilla.
2. **Compatibilidad con PostgreSQL**: Al configurar `DATABASE_URL` apuntando a una instancia PostgreSQL, `db.create_all()` crea el esquema sin errores de tipos ni secuencias.
3. **100% Retrocompatibilidad de API**: Todos los endpoints actuales (`/api/v1/auth/*`, `/api/v1/usuarios`, `/api/v1/grilla/*`) devuelven exactamente los mismos códigos HTTP y estructuras JSON que en la versión basada en archivos.
4. **Persistencia de Adjuntos**: Si un archivo subido es borrado de la carpeta `uploads/` (simulando reinicio de contenedor en Render), `GET /uploads/<filename>` sigue devolviendo el archivo desde la columna `datos_binarios` de SQL.
