document.addEventListener('DOMContentLoaded', cargar_grilla);

function cargar_grilla() {
    // Recuperar el token JWT
    const token = localStorage.getItem('access_token');
    console.log("Token encontrado:", token);
    if (!token) {
        alert("Esta página es solamente para usuarios");
        window.location.href = "/";
        return;
    }

    // Hacemos fetch por GET enviando el token JWT:
    console.log("comentario nacho");
    fetch('/api/v1/grilla', {
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then(respuesta => {
        console.log('Respuesta del servidor:', respuesta.status);
        if (!respuesta.ok) {
            return respuesta.json().then(errorData => {
                throw new Error(`HTTP ${respuesta.status}: ${errorData.message || 'Error desconocido'}`);
            });
        }
        return respuesta.json();
    })
    .then(datos => { 
        console.log('Datos recibidos del servidor:', datos);
        crear_tarjetas(datos); 
    })
    .catch(error => { 
        console.error('Error al cargar la grilla:', error);
        alert(`Error al cargar las tareas: ${error.message}`);
    });
}

function crear_tarjetas(datos) {
    
    // Verificar si hay tareas
    if (datos.notas && datos.notas.length > 0) {
        
        datos.notas.forEach(nota => {
            crear_tarjeta(nota);
        });
    } else {
        console.log('No hay tareas disponibles');
        // TODO: Mostrar mensaje de "No hay tareas"
    }
}

function crear_tarjeta(nota) {
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('card');

    switch (nota.prioridad) {
        case 'Urgente':
            tarjeta.classList.add('card-header-urgent');
            break;
        case 'Media':
            tarjeta.classList.add('card-header-medium');
            break;
        case 'Baja':
            tarjeta.classList.add('card-header-low');
            break;
    }

    tarjeta.innerHTML = `
        <div class="card-header">
            <h5 class="card-title">${nota.titulo}</h5>
            <h5 class="mb-0">${nota.prioridad}</h5>
        </div>
        <div class="card-body">
            <p class="card-text">${nota.descripcion}</p>
            <small class="text-muted">Creada: ${nota.fecha_creacion}</small>
        </div>
    `;

    // Crear el div para los botones y agregar clases correctamente
    let div_botones = document.createElement('div');
    div_botones.classList.add('card-footer', 'bg-white', 'text-end');
    
    let borrar = obtenerBotonBorrar(nota.id);
    let completar = obtenerBotonCompletar(nota.id);
    div_botones.append(borrar);
    div_botones.append(completar);

    tarjeta.appendChild(div_botones);

    document.querySelector('#lista-tareas').appendChild(tarjeta);
}

function obtenerBotonBorrar(id) {
    const boton = document.createElement('button');
    boton.classList.add('btn', 'btn-danger', 'btn-sm', 'ms-2');
    boton.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
    boton.onclick = () => eliminarTarea(id);
    return boton;
}

function obtenerBotonCompletar(id) {
    const boton = document.createElement('button');
    boton.classList.add('btn', 'btn-success', 'btn-sm');
    boton.innerHTML = '<i class="bi bi-check-lg"></i> Completar';
    boton.onclick = () => completarTarea(id);
    return boton;
}

