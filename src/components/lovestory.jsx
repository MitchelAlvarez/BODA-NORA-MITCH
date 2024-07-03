import React, { useEffect, useRef } from 'react'
import '../css/lovestory.css'
import loveStoryItems from '/public/assets/moks/lovestoryitems.json'

export default function Lovestory() {
    let story = loveStoryItems.items

    const observer = useRef(null);
    const observer2 = useRef(null);

    useEffect(() => {
        observer.current = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('bounce-in-right');
                    entry.target.classList.add('show');
                }
                // else {
                //     entry.target.classList.remove('bounce-in-right');
                // }
            });
        }, { threshold: 0.1 });

        const stories = document.querySelectorAll('.right');
        stories.forEach(story => {
            observer.current.observe(story);
        });

        return () => {
            observer.current.disconnect();
        };
    }, []);

    useEffect(() => {

        observer2.current = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('bounce-in-left');
                    entry.target.classList.add('show');
                }

            });
        }, { threshold: 0.1 });

        const storiesLeft = document.querySelectorAll('.left');
        storiesLeft.forEach(story => {
            observer2.current.observe(story);
        });

        return () => {
            observer2.current.disconnect();
        };
    }, []);

    return (
        <section id='lovestory' className='our-story'>
            <div className="our-story--tittle">
                <hr className='hr-tittle' />
                <h2>Nuestra Historia de Amor</h2>
                <hr className='hr-tittle' />
            </div>
            <div className="lovestory">
                <div className="lovestory-item--start" />
                {
                    story.map(item => {
                        return (
                            <div className={`lovestory-item ${item.side}`} key={item.id}>
                                <div className="lovestory-content">
                                    <div className="lovestory-date"><b>{item.date}</b></div>
                                    <div className="lovestory-description--date"><p>{item.event}</p></div>
                                    <div className={`lovestory-item--after`} >
                                        <img src={item.imgSrc} alt={item.event} />
                                    </div>
                                </div>
                                <div className={`lovestory-content-${item.shortSide} lovestory-content--image`}>
                                    <div className={`lovestory-image--container image-${item.id}`} />
                                    <div className="lovestory-description"><p>{item.phrase}</p></div>
                                </div>
                            </div>
                        )
                    })
                }
                <div className="lovestory-item--end" />
            </div>
        </section>
    )
}

