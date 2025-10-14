function alta_nota(e)
{
    e.preventDefault();

    // Recuperar el token JWT
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Esta página es solamente para usuarios");
        window.location.href = "/";
        return;
    }

    // Guardamos en constantes los datos ingresados en el formulario
    const titulo = document.querySelector('#titulo').value;
    const descripcion = document.querySelector('#descripcion').value;
    const prioridad = document.querySelector('#prioridad').value;
    var req =  JSON.stringify({titulo, descripcion, prioridad});
    console.log("request post: ",req )

    // Hacemos fetch por POST, con autenticación y los datos en body:
    fetch ('/api/v1/grilla', {
        "method": "POST",
        "headers": {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${token}`
        },
        "body": JSON.stringify({titulo, descripcion, prioridad})
    })
    .then( respuesta => {
        if (!respuesta.ok) {
            return respuesta.json().then(errorData => {
                throw new Error(`HTTP ${respuesta.status}: ${errorData.message || 'Error desconocido'}`);
            });
        }
        return respuesta.json();
    })
    .then(datos => {
        console.log('Nota creada exitosamente:', datos);
        alert('¡Nota creada exitosamente!');
        // Redirigir a la grilla
        window.location.href = '/grilla';
    })
    .catch( e => { 
        console.error('Error al crear la nota:', e);
        alert(`Error al crear la nota: ${e.message}`);
    });
}