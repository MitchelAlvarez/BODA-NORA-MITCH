import { useEffect, useRef, useState } from 'react';
import reloj from '/src/images/icons/reloj.png';
import ubicacion from '/src/images/icons/ubicacion.png';
import timeLine from '/public/assets/moks/itinerario.json'
import '../css/title.css'
import '../css/evento.css';
import '../css/cards.css';


export default function Evento() {
    const [showMore, setShowMore] = useState(false);
    const info2 = useRef(null);
    const moreLink = useRef(null);
    const lessLink = useRef(null);
    const card1 = useRef(null);

    let itinerario = timeLine.itinerario;

    useEffect(() => {
        lessLink.current.style.display = 'none';
        info2.current.style.display = 'none';
    }, []);

    const handleClick = (action) => (e) => {
        e.preventDefault();
        if (action === 'more') {
            info2.current.style.display = 'block';
            lessLink.current.style.display = 'block';
            moreLink.current.style.display = 'none';
        } else {
            info2.current.style.display = 'none';
            moreLink.current.style.display = 'block';
            lessLink.current.style.display = 'none';
        }
    }

    return (
        <section className="evento-container container-secondary">
            <div className="evento-title">
                <h2>Detalles del evento</h2>
                <span className='tittle-divider divider-secondary'></span>
            </div>
            <div className="cards-container--evento">
                <div ref={card1} className={`card card1 card-event ${showMore ? 'expanded' : ''}`}>
                    <div className="card-tittle">
                        <h3>Ceremonia Religiosa</h3>
                        <hr className="card-hr" />
                    </div>
                    <div className="card-body">
                        <div className="card-body--text">
                            <p>La ceremonia será en la <strong>Capilla de la Parroquia de La Madre de Dios</strong> (templo chico)</p>
                        </div>
                        <div className="card-body--info">
                            <div className="info-date">
                                <div className="info-date--icon card-icon"><img src={reloj} alt="hora" /></div>
                                <div className="info-date--text item-body--text">
                                    <strong>4:30pm</strong>
                                </div>
                            </div>
                            <div className="info-address">
                                <div className="info-address--icon card-icon"> <img src={ubicacion} alt="ubicacion" /></div>
                                <div className="info-address--text item-body--text">
                                    <strong>Av Providencia 2958,h <br />
                                        Providencia 4a. Secc, 44639 Guadalajara, Jal.
                                    </strong>
                                </div>
                            </div>
                        </div>
                        <div className="card-body-button">
                            <button className="btn btn-primary">Ver Mapa</button>
                        </div>

                    </div>
                </div>
                <div className="card card2 card-event">
                    <div className="card-tittle">
                        <h3>Recepción</h3>
                        <hr className="card-hr" />
                    </div>
                    <div className="card-body">
                        <div className="card-body--text">
                            <p>La recepción de nuestra boda se llevará a cabo en el <strong>Salón Casa Victoria</strong></p>
                        </div>
                        <div className="card-body--info">
                            <div className="info-date">
                                <div className="info-date--icon card-icon"><img src={reloj} alt="hora" /></div>
                                <div className="info-date--text item-body--text">
                                    <strong>6:00pm</strong>
                                </div>
                            </div>
                            <div className="info-address">
                                <div className="info-address--icon card-icon"> <img src={ubicacion} alt="ubicacion" /></div>
                                <div className="info-address--text item-body--text">
                                    <strong>Calz. Central 51,<br />
                                        Cd. Granja, 45010 Zapopan, Jal.
                                    </strong>
                                </div>
                            </div>
                            <a ref={moreLink} href="" className="see-more--card" onClick={handleClick('more')}>Ver más...</a>
                        </div>
                        <div ref={info2} className="card-body--info2">
                            {
                                itinerario.map(item => {
                                    return (
                                        <div key={item.id} className={item.class}>
                                            <div className={`${item.class}--icon card-icon`}><img src={item.icon} alt={item.nombre} /></div>
                                            <div className="info-cocktail--text item-body--text itme-time-line">
                                                <p>{item.nombre}  <br />
                                                    {item.hora}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                            <a ref={lessLink} href="" className="see-more--card" onClick={handleClick('less')}>Ver menos...</a>
                        </div>
                        <div className="card-body-button">
                            <button className="btn btn-primary">Ver Mapa</button>
                            <a href=""></a>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    )
}