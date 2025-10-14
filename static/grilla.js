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

    // Limpiar las tarjetas existentes antes de cargar las nuevas
    const listaNotas = document.querySelector('#lista-notas');
    if (listaNotas) {
        listaNotas.innerHTML = '';
    }

    const listaNotasCompletadas = document.querySelector('#lista-notas-completadas');
    if (listaNotasCompletadas) {
        listaNotasCompletadas.innerHTML = '';
    }

    // Traemos la grilla de PENDIENTES
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
        crear_tarjetas(datos, true); 
    })
    .catch(error => { 
        console.error('Error al cargar la grilla:', error);
        alert(`Error al cargar las notas: ${error.message}`);
    });

    //traemos las COMPLETADAS
    fetch('/api/v1/grilla/completadas', {
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
        crear_tarjetas(datos, false); 
    })
    .catch(error => { 
        console.error('Error al cargar la grilla:', error);
        alert(`Error al cargar las notas: ${error.message}`);
    });


}


function crear_tarjetas(datos, editable) {
    
    // Verificar si hay notas
    if (datos.notas && datos.notas.length > 0) {
        
        datos.notas.forEach(nota => {
            crear_tarjeta(nota,editable);
        });
    } else {
        console.log('No hay notas disponibles');
        // TODO: Mostrar mensaje de "No hay notas"
    }
}

function crear_tarjeta(nota, editable) {
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('card');
    tarjeta.classList.add('mb-4');


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
            <small class="text-muted">Editada: ${nota.fecha_modificacion ?? "-"}</small>
        </div>
    `;

    // Crear el div para los botones y agregar clases correctamente
    let div_botones = document.createElement('div');
    div_botones.classList.add('card-footer', 'bg-white', 'text-end');
   
    if(editable)
    {
        let borrar = obtener_boton_borrar(nota.id);
        let completar = obtener_boton_completar(nota.id);
        div_botones.append(borrar);
        div_botones.append(completar);
    
        tarjeta.appendChild(div_botones);
        document.querySelector('#lista-notas').appendChild(tarjeta);
    }
    else
    {
        document.querySelector('#lista-notas-completadas').appendChild(tarjeta);
    }
   

}

function obtener_boton_borrar(id) {
    const boton = document.createElement('button');
    boton.classList.add('btn', 'btn-danger', 'btn-sm', 'ms-2');
    boton.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
    boton.onclick = () => eliminar_nota(id);
    return boton;
}

function obtener_boton_completar(id) {
    const boton = document.createElement('button');
    boton.classList.add('btn', 'btn-success', 'btn-sm');
    boton.innerHTML = '<i class="bi bi-check-lg"></i> Completar';
    boton.onclick = () => completar_nota(id);
    return boton;
}

function eliminar_nota(id) {
    // Recuperar el token JWT
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Esta página es solamente para usuarios");
        window.location.href = "/";
        return;
    }

    if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
        //baja logica 
        fetch(`/api/v1/grilla/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(respuesta => {
            if (!respuesta.ok) {
                return respuesta.json().then(errorData => {
                    throw new Error(`HTTP ${respuesta.status}: ${errorData.message || 'Error desconocido'}`);
                });
            }
            return respuesta.json();
        })
        .then(datos => {
            console.log('Nota eliminada exitosamente:', datos);
            alert('¡Nota eliminada exitosamente!');
            cargar_grilla();
        })
        .catch(e => {
            console.error('Error al eliminar la nota:', e);
            alert(`Error al eliminar la nota: ${e.message}`);
        });
    }
}

function completar_nota(id) {
    // Recuperar el token JWT
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Esta página es solamente para usuarios");
        window.location.href = "/";
        return;
    }

    if (confirm('¿Marcar esta nota como completada?')) {
        //C ompleta la tarea  -> cambia campo completada = tru y fecha_modificacion = actual
        fetch(`/api/v1/grilla/${id}/completar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(respuesta => {
            if (!respuesta.ok) {
                return respuesta.json().then(errorData => {
                    throw new Error(`HTTP ${respuesta.status}: ${errorData.message || 'Error desconocido'}`);
                });
            }
            return respuesta.json();
        })
        .then(datos => {
            console.log('Nota completada exitosamente:', datos);
            alert('¡Nota completada exitosamente!');
            cargar_grilla();
        })
        .catch(e => {
            console.error('Error al completar la nota:', e);
            alert(`Error al completar la nota: ${e.message}`);
        });
    }
}

