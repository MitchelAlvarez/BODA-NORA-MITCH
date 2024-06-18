import { useState, useEffect } from 'react';
import invitadosList from '/public/assets/moks/invitadosList.json';
import '../css/title.css'
import '../css/rsvpContainer.css';
import '../css/rsvp.css';
import { useInvitado } from '../hooks/useInvitado';
import { debounce, set } from 'lodash';
import portada2 from '/src/images/portada2.webp';

export default function RSVP() {
    const { respnseCall, updateInvitados } = useInvitado()

    const [nombre, setNombre] = useState('')
    const [invitadosFiltrados, setInvitadosFiltrados] = useState([])
    const [invitado_id, setInvitado_id] = useState(0)
    const [invitadoNumero, setInvitadoNumero] = useState(0)
    const [invitadosList, setInvitadosList] = useState([]) // Nuevo estado para almacenar la lista de invitados


    const [disableBtnSum, setDisableBtnSum] = useState(true)
    const [disableBtnRest, setDisableBtnRest] = useState(true)
    const [disableNumInvitados, setDisableNumInvitados] = useState(true)

    useEffect(() => {
        if (nombre !== '') {
            document.getElementsByClassName('mostrar-invitados')[0].classList.add('show-list');

            //     const invitadosListaFiltrada = invitadosList.invitados.filter(invitado =>
            //         invitado.nombre.toLowerCase().includes(nombre.toLowerCase())
            //     );
            //     setInvitadosFiltrados(invitadosListaFiltrada);
            //     console.log(invitadosFiltrados); // Para ver los resultados en la consola
            // } else {
            //     document.getElementsByClassName('mostrar-invitados')[0].classList.remove('show-list');
            // }
            // Llamada a la API para obtener la lista de invitados
            fetch('api/data?num_invitados=0')
                .then(response => response.json())
                .then(data => {
                    const invitados = data.invitados.map(mapInvitadoData);
                    setInvitadosList(invitados);
                    const invitadosListaFiltrada = invitados.filter(invitado =>
                        invitado.nombre.toLowerCase().includes(nombre.toLowerCase())
                    );
                    setInvitadosFiltrados(invitadosListaFiltrada);
                    console.log(invitadosFiltrados); // Para ver los resultados en la consola
                })
                .catch(error => {
                    console.error('Error fetching data: ', error);
                });
        } else {
            document.getElementsByClassName('mostrar-invitados')[0].classList.remove('show-list');
        }

    }, [nombre])

    useEffect(() => {
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleNombre = debounce((e) => {
        const name = e.target.value
        setNombre(name)
    }, 500)

    const handleSelectInvitado = (e) => {
        //setNombre(e.target.innerText)
        document.getElementById('inputNombre').value = e.target.innerText;
        document.getElementsByClassName('mostrar-invitados')[0].classList.remove('show-list');
        invitadosFiltrados.map(invitado => {
            if (invitado.nombre === e.target.innerText) {
                document.getElementById('numInvitados').value = invitado.numero_de_invitados_max;
                setInvitadoNumero(invitado.numero_de_invitados_max);
                setInvitado_id(invitado.invitado_id);
            }
        })
        setDisableBtnRest(false)
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setDisableNumInvitados(false)
        await new Promise(resolve => setTimeout(resolve, 0))
        const dataFields = Object.fromEntries(new FormData(document.querySelector('form')))
        const nombre = dataFields.nombre
        const asistencia = dataFields.asistencia
        const numero_de_invitados = dataFields.numInvitados
        console.log(nombre, asistencia, numero_de_invitados)
        if (numero_de_invitados === '' || typeof asistencia === 'undefined' || nombre === '') {
            alert('Por favor llena todos los campos')
        } else {
            const responseUpdate = await updateInvitados({ invitadoIdToUpdate: invitado_id, asistencia, numero_de_invitados })
            if (responseUpdate.message === 'Invitados updated successfully') {
                alert('Confirmacion enviada')
            } else {
                alert('Error al actualizar, intente mas tarde')
            }
        }
        setDisableNumInvitados(true)
        document.querySelector('form').reset();
        setDisableBtnRest(true)
        setDisableBtnSum(true)
        setNombre('')
        setInvitado_id(0)
        setInvitadoNumero(0)
        setInvitadosFiltrados([])

    }

    const handleClickNoAsistire = () => {
        document.getElementById('numInvitados').value = 0;
        setDisableBtnRest(true)
        setDisableBtnSum(true)
    }

    const handleClickAsistire = () => {
        document.getElementById('numInvitados').value = invitadoNumero;
        setDisableBtnRest(false)
        setDisableBtnSum(true)
    }

    const handleSumRest = (accion) => {
        const numInvitados = document.getElementById('numInvitados');
        if (accion === 'sum') {
            setDisableBtnRest(false)
            numInvitados.value = Number(numInvitados.value) + 1;
            if (Number(numInvitados.value) === invitadoNumero) {
                setDisableBtnSum(true)
            }
        } else {
            setDisableBtnSum(false)
            if (Number(numInvitados.value) > 0) {
                numInvitados.value = Number(numInvitados.value) - 1;
            } else {
                setDisableBtnRest(true)
            }
        }
    }

    const handleClickOutside = (event) => {
        const inputElement = document.getElementById('inputNombre');
        const listElement = document.getElementsByClassName('mostrar-invitados')[0];

        if (inputElement && !inputElement.contains(event.target) && !listElement.contains(event.target)) {
            listElement.classList.remove('show-list');
        }
    }

    function mapInvitadoData(invitadoData) {
        return {
            id: invitadoData.invitado_id,
            nombre: invitadoData.nombre_invitado,
        };
    }

    return (
        <section className="rsvp">
            <div className="title-rsvp">
                <h2>Confirmación de Asistencia</h2>
                <span className='tittle-divider divider-secondary'></span>
            </div>
            <div className="rsvp-container">
                <div className="rsvp-imagen--container">
                    <div className="rsvp-imagen">
                        <img src={portada2} alt="rsvp" className="rsvp-img" />
                    </div>
                </div>
                <div className="rsvp-form">
                    <div className="form-message">
                        <h3>¡Ven a celebrar con nosotros!</h3>
                        <p>Por favor ayúdanos <strong>confirmando tu asistencia</strong> antes del <strong>31 de agosto del 2024</strong>.</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="label-nombre-container">
                            <label className="label">
                                <input id='inputNombre' type="text" placeholder=" " className="input" name='nombre' onChange={handleNombre} />
                                <span className='label_input nombre'>Ingresa Nombre</span>
                            </label>
                            <div className="mostrar-invitados">
                                {
                                    invitadosFiltrados.map(invitado => (
                                        <ul key={invitado.id}>
                                            <li onClick={handleSelectInvitado}>{invitado.nombre}</li>
                                        </ul>
                                    ))
                                }
                            </div>
                        </div>

                        <div className="radio label">
                            <label><input type="radio" value="SI" name="asistencia" onClick={() => handleClickAsistire()} /> Asistire</label>
                            <label><input type="radio" value="NO" name="asistencia" onClick={() => handleClickNoAsistire()} /> No Asistire</label>
                        </div>
                        <div className="numero-de-invitados">
                            <button type="button" className="rest-invitado btn-calc" disabled={disableBtnRest} onClick={() => handleSumRest('rest')}>-</button>
                            <label className="label">
                                <input id='numInvitados' type="number" placeholder=" " name='numInvitados' disabled={disableNumInvitados} className="input" />
                                <span className='label_input invitados'>Numero de asistentes</span>
                            </label>
                            <button type="button" className="rest-invitado btn-calc" disabled={disableBtnSum} onClick={() => handleSumRest('sum')}>+</button>
                        </div>
                        <input type="submit" value="Submit" className='submit btn' />
                    </form>

                </div>
            </div>
        </section>
    )
}

