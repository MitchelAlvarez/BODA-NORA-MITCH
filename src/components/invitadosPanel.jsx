import { useState } from 'react';
import '../css/invitadopanel.css'
import invitadosList from '/public/assets/moks/invitadosList.json';

export default function InvitadosPanel() {
    const [filter, setFilter] = useState('');
    const [data, setData] = useState(invitadosList.invitados);
    const [to, setTo] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState('');

    function getHeadings(data) {
        if (data.length === 0) return null;
        return (
            <tr>
                {Object.keys(data[0]).map((key, index) => {
                    return (
                        <th key={index}>
                            {key}
                            <input
                                type="text"
                                placeholder={`Filtrar ${key}`}
                                onChange={(e) => handleFilter(e, key)}
                            />
                        </th>
                    );
                })}
            </tr>
        );
    }

    function getRows(data) {
        return data.map((obj, index) => {
            return <tr key={index}>{getCells(obj)}</tr>;
        });
    }

    function getCells(obj) {
        return Object.values(obj).map((value, index) => {
            return <td key={index}>{value}</td>;
        });
    }

    function handleFilter(e, key) {
        const value = e.target.value.toLowerCase();
        const filteredData = invitadosList.invitados.filter(invitado =>
            invitado[key].toString().toLowerCase().includes(value)
        );
        setData(filteredData);
    }

    function InvitadosTable({ data }) {
        if (data.length === 0) {
            return <p>No hay resultados para mostrar. Favor de refrescar la pagina</p>;
        }
        return (
            <table>
                <thead>{getHeadings(data)}</thead>
                <tbody>{getRows(data)}</tbody>
            </table>
        );
    }

    const sendMessage = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ to, body })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            setStatus(`Message sent with SID: ${data}`);
        } catch (error) {
            console.error('Error sending message:', error);
            setStatus('Failed to send message');
        }
    };

    function handleClickInvitacion() {
        setTo('recipient_phone_number');  // Reemplaza con el número de teléfono del destinatario
        setBody('This is the body of the message');  // Reemplaza con el cuerpo del mensaje
        sendMessage();
    }

    return (
        <section className="invitado-dashboard">
            <div className="buttons-container">
                <button className='send-invitation btn' onClick={handleClickInvitacion}>Enviar<br /> invitacion</button>
                <button className='send-reminder1 btn'>Enviar recordatorio</button>
                <button className='send-reminder2 btn'>Enviar recordatorio2</button>
            </div>
            <InvitadosTable data={data} />
            <p>{status}</p> {/* Mostrar el estado del mensaje */}
        </section>
    )
}
