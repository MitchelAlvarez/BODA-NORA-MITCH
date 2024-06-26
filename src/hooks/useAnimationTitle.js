// useViewportAnimation.js
import { useEffect } from 'react';

export default function useViewportAnimation() {
    // Función para verificar si un elemento está en el viewport
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    useEffect(() => {
        // Selecciona todos los elementos con la clase 'title-animation'
        const elements = document.querySelectorAll('.title-animation');

        // Función para verificar si cada elemento está en el viewport
        function checkElementsInViewport() {
            elements.forEach(element => {
                if (isInViewport(element)) {
                    element.classList.add('in-view');
                }
            });
        }

        // Verifica los elementos en el viewport inicialmente
        checkElementsInViewport();

        // Agrega un event listener para verificar los elementos en el viewport cada vez que el usuario hace scroll
        window.addEventListener('scroll', checkElementsInViewport);

        // Elimina el event listener cuando el componente se desmonte
        return () => {
            window.removeEventListener('scroll', checkElementsInViewport);
        };
    }, []);
}