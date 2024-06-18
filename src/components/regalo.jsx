import { useState } from 'react';
import '../css/title.css'
import '../css/cards.css';
import '../css/regalo.css';
import tin from '/public/assets/icons/tinder.png';

export default function Regalo() {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleClickFlip = () => {
        setIsFlipped(!isFlipped);
    }
    return (
        <section className="regalo-container container-secondary">
            {/*<div className="evento-title">
                <h2>Mesa de Regalo</h2>
                <span className='tittle-divider divider-secondary'></span>
            </div> */}

            <div className="cards-container--regalo cards-container--evento">
                <div className="card card-regalo">
                    <div className="card-tittle"><h3>Regalo de Boda</h3></div>
                    <hr className="card-hr" />
                    <div className="card-regalo--message">
                        <p>En todo momento este evento fue planeado para disfrutarlo con ustedes, así que el mayor regalo es que estén ahí con nosotros disfrutando y dando el 110%</p><br />
                        <p>Al ya vivir juntos desde hace un par de años tenemos casi todo lo necesario para nuestro hogar,
                            así que si de todas formas desean darnos un regalo, les agradeceríamos puedan cooperar con nuestro
                            <strong> Honeymoon Fund</strong> (fondo para nuestra luna de miel) esto puede ser en sobre el día
                            de la boda o en transferencia bancaria a la siguiente cuenta: </p><br />
                    </div>
                </div>
                <div className={`card card-regalo flip-card ${isFlipped ? 'flipped' : ''}`} onClick={handleClickFlip}>
                    <div className="card-regalo--message flip-card-front">
                        <div className="front-container">
                            <img src={tin} alt="tin" /><br />
                            <p>Datos bancarios </p>
                        </div>
                    </div>
                    <div className="card-regalo--cuenta card-regalo--message flip-card-back">
                        <div className="back-container">
                            <p> Nombre: <strong>Jose Luis</strong><br />
                                Apellido: <strong>Alvarez</strong><br />
                                Banco: <strong>BBVA</strong><br />
                                Numero tarjeta: <strong>0123456789</strong><br />
                                Clabe: <strong>0123456789</strong></p>
                        </div>

                    </div>

                </div>
            </div>
        </ section>
    )
}