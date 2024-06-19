import { useState } from 'react'
import Countdown from 'react-countdown'
import Lovestory from './components/lovestory'
import render from './components/counter'
import Collage from './components/collage'
import Evento from './components/evento'
import Topics from './components/topics'
import Regalo from './components/regalo'
import RSVP from './components/rsvp'
import monogramaNegro from '/src/images/monograma_negro.png';
import instagram from '/src/images/icons/instagram.png';

import './css/App.css'
import InvitadosPanel from './components/invitadosPanel'
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <header>
        <nav className='menu'>
          <ul>
            <li><a href="#">Inicio</a></li>
            <li><a href="#">Servicios</a></li>
            <li><a href="#">Contacto</a></li>
          </ul>
        </nav>
        <div className="header-monograma">
          <img src={monogramaNegro} alt="monograma" className="monogra" />
        </div>
        <div className="header-text">
          {/* {<h1>Nora & Mitch</h1>} */}
          <h2>We are getting married</h2>
        </div>
      </header>
      <main>
        <section className="counter">
          <h3 className="title-date">16 Noviembre 2024</h3>
          <Countdown
            date={'2024-11-16T16:30:00'}
            renderer={render}
          />
        </section>
        <section className="welcome-message">
          <p>Tenemos el honor de invitarlos al evento, que sin duda, será uno de los más<br />
            importantes de nuestras vidas. Queremos que nos acompañen para vivir y <br />
            recordar juntos este día, ya que no sería lo mismo sin nuestros seres queridos.<br />< br />
            ¡Los esperamos para darlo todo!<br /></p>
          <span className="welcome-message--span"></span>
        </section>
        <Lovestory />
        <Collage />
        <Evento />
        <Topics />
        <Regalo />
        <RSVP />
        <section className="goodbye-container evento-container container-secondary">
          <div className="goodbye-message">
            <h3>No podemos esperar para festejar nuestra Boda con ustedes</h3>
            <h3>¡Nos vemos en Noviembre!</h3>
          </div>
        </section>
      </main >
      <footer>
        <p>Design and powered by youareinvite.com<br />
          ¡Creamos la invitación para tu evento!</p>
        <img src={instagram} alt="instagram" />

      </footer>
    </>
  )
}

export default App
