export function updateInvitado({ invitadoIdToUpdate, asistencia, numero_de_invitados }) {
    const apiUrl = import.meta.env.VITE_API_URL;
    return fetch('/api/updateInvitados', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            invitadoIdToUpdate: Number(invitadoIdToUpdate),
            asistencia: asistencia,
            numero_de_invitados: Number(numero_de_invitados)
        }),
    })
        .then(response => {
            console.log(response); // Imprime la respuesta completa
            return response.text(); // Devuelve el cuerpo de la respuesta como texto
        })
        .then(text => {
            console.log(text); // Imprime el cuerpo de la respuesta
            return JSON.parse(text); // Intenta convertir el cuerpo de la respuesta en JSON
        })
        .catch((error) => {
            return 'Error: ' + error;
        });
}