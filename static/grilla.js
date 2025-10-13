document.addEventListener('DOMContentLoaded', cargar_grilla);


function cargar_grilla() {
    // Recuperar el token JWT
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Esta página es solamente para usuarios");
        window.location.href = "/";
        return;
    }

    // Hacemos fetch por GET enviando el token JWT:
    fetch('/api/grilla', {
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then (respuesta => respuesta.json())
    .then (datos => { mostrar_respuesta(datos); })
    .catch( e => { console.log(respuesta); });
}