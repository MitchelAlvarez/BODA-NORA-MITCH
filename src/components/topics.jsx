import { useEffect, useRef, useState } from 'react';
import topics from '/public/assets/moks/topics.json';
import kit from '/public/assets/moks/kitcruda.json';
import '../css/title.css'
import '../css/cards.css';
import '../css/topics.css';


export default function Topics() {
    const info2 = useRef(null);
    const moreLink = useRef(null);
    const lessLink = useRef(null);

    let importantTopics = topics.items;
    let steps = kit.steps;

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
        <section className="topics">
            <div className="topic-title ">
                <h2>Informacion Importante</h2>
                <span className='tittle-divider divider-secondary'></span>
            </div>
            <div className="cards-container">
                {
                    importantTopics.map(topic => {
                        return (
                            <div className="card card-topic card-automatic" key={topic.id}>
                                <div className="card-tittle"><h3>{topic.topic}</h3>
                                    <hr className="card-hr" />
                                </div>
                                <div className="card-body">
                                    <div className="card-body--icon">
                                        <img src={topic.imagen} alt={topic.topic} />
                                    </div>
                                    <div className="card-body--text_topics">
                                        <p dangerouslySetInnerHTML={{ __html: topic.body }} />
                                        <p className='card-body2' dangerouslySetInnerHTML={{ __html: topic.body2 }} />
                                    </div>
                                </div>
                            </div>
                        )
                    })
                }
                <div className="card card-topic  card-no-automatic">
                    <div className="card-tittle">
                        <h3>Ritual Anticruda</h3>
                        <hr className="card-hr" />
                    </div>
                    <div className="card-body">
                        <div className="card-body--icon">
                            <img src="/public/assets/icons/cruda.png" alt="kit cruda" />
                        </div>
                        <div className="card-body--text_topics">
                            <p>Te compartimos nuestro <strong>ritual anticruda</strong> para que no te arrepientas al día siguiente de todo lo que te tomaste.</p>
                            <p className='card-body2'>Para conocer el secreto mejor guardado <br /><i><a ref={moreLink} href="" className="see-more--steps" onClick={handleClick('more')}>click aquí</a></i></p>
                        </div>
                        <div ref={info2} className='card-body--text_topics subtopic'>
                            <p className="card-body2">Ir de fiesta y beber mucho se ve <strong>fácil</strong> pero conlleva un <strong>precio muy alto a pagar</strong>, además del callo que uno puede tener, la preparación previa, durante y post fiesta <strong>es la clave!</strong></p>
                            {
                                steps.map(step => {
                                    return (
                                        <div key={step.id} className="steps-cruda">
                                            <p>{step.id}. {step.text}</p>
                                        </div>
                                    )
                                })
                            }
                            <a ref={lessLink} href="" className="see-less--step" onClick={handleClick('less')}>Ver menos...</a>
                        </div>
                    </div>
                </div>

            </div>
        </section >
    )
}