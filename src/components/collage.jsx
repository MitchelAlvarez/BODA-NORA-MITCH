import { useEffect, useRef, useState } from 'react';
import '../css/collage.css';
import nosotros1 from '/public/assets/images/nosotros1.webp'
import nosotros2 from '/public/assets/images/nosotros2.webp'
import nosotros3 from '/public/assets/images/nosotros3.webp'
import nosotros4 from '/public/assets/images/nosotros4.webp'
import nosotros5 from '/public/assets/images/nosotros5.webp'
import nosotros6 from '/public/assets/images/nosotros6.webp'

export default function Collage() {
    const [allImagesLength, setAllImagesLength] = useState(0);

    const carouselRef = useRef(null);
    const prevBtnRef = useRef(null);
    const nextBtnRef = useRef(null);
    const imageBoxRef = useRef(null);
    const imageViewRef = useRef(null);
    let touchStartX = 0;
    let touchEndX = 0;
    let currentImageIdx = 0;
    const carrousel = carouselRef.current;
    const imageBox = imageBoxRef.current;


    useEffect(() => {
        const carrousel = carouselRef.current;
        const allImages = document.querySelectorAll('.nosotros-img-container');
        setAllImagesLength(allImages.length);
        if (carrousel) {
            carrousel.addEventListener('touchstart', (event) => {
                touchStartX = event.changedTouches[0].screenX;
            });

            carrousel.addEventListener('touchend', (event) => {
                touchEndX = event.changedTouches[0].screenX;
                handleSwipe();
            });
        }

        function handleSwipe() {
            if (touchEndX < touchStartX) {
                // Swipe left
                // currentImageIdx++;
                // if (currentImageIdx === 7) {
                //     currentImageIdx = 1;
                // }
                // currentImageDisplay(currentImageIdx);
                handleNextClick();
            }

            if (touchEndX > touchStartX) {
                // Swipe right
                // currentImageIdx--;
                // if (currentImageIdx === 0) {
                //     currentImageIdx = allImagesLength;
                // }
                // currentImageDisplay(currentImageIdx);
                handlePrevClick();
            }
        }

        // if (collage) {
        //     collage.addEventListener('click', handleClick);
        // }

        // return () => {
        //     if (collage) {
        //         collage.removeEventListener('click', handleClick);
        //     }
        // }
    }, [allImagesLength]);

    const handleImgClick = (event) => {
        carrousel.style.display = "block";
        imageBox.style.display = "block";
        currentImageIdx = parseInt(event.target.alt.split(' ')[1]);
        currentImageDisplay(currentImageIdx);
    }

    function handlePrevClick() {
        currentImageIdx--;
        if (currentImageIdx === 0) {
            currentImageIdx = allImagesLength;
        }
        currentImageDisplay(currentImageIdx);
    }

    const handleNextClick = () => {
        currentImageIdx++;
        if (currentImageIdx === 7) {
            currentImageIdx = 1;
        }
        currentImageDisplay(currentImageIdx);
    }

    const handleCloseClick = () => {
        carrousel.style.display = "none";
        imageBox.style.display = "none";
    }

    // function handleClick(event) {

    //     if (!carrousel || !imageBox) {
    //         return;
    //     }
    // }

    function currentImageDisplay(position) {
        const imageView = imageViewRef.current;

        if (!imageView) {
            return;
        }

        imageView.src = `/public/assets/images/nosotros${position}.webp`;
    }

    return (
        <section className='collage'>
            <div className="nosotros-foto1 nosotros-img-container"><img className="zoom-img" src={nosotros1} alt="nosotros 1" onClick={handleImgClick} /></div>
            <div className="nosotros-foto2 nosotros-img-container"><img className="zoom-img" src={nosotros2} alt="nosotros 2" onClick={handleImgClick} /></div>
            <div className="nosotros-foto3 nosotros-img-container"><img className="zoom-img" src={nosotros3} alt="nosotros 3" onClick={handleImgClick} /></div>
            <div className="nosotros-foto4 nosotros-img-container"><img className="zoom-img" src={nosotros4} alt="nosotros 4" onClick={handleImgClick} /></div>
            <div className="nosotros-foto5 nosotros-img-container"><img className="zoom-img" src={nosotros5} alt="nosotros 5" onClick={handleImgClick} /></div>
            <div className="nosotros-foto6 nosotros-img-container"><img className="zoom-img" src={nosotros6} alt="nosotros 6" onClick={handleImgClick} /></div>

            <div ref={carouselRef} className="carousel-container" id="carousel-container">
                <div ref={imageBoxRef} className="image-box">
                    <img ref={imageViewRef} src="" alt="carousel" className='image-box--img' />
                    <div ref={prevBtnRef} id="prev-btn" onClick={handlePrevClick}></div>
                    <div ref={nextBtnRef} id="next-btn" onClick={handleNextClick}></div>
                </div>
                <div id="close-btn" onClick={handleCloseClick}>×</div>
            </div>
        </section>
    );
}
