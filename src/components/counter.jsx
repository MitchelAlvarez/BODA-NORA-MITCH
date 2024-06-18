// renderer.js
const renderer = ({ days, hours, minutes, seconds, completed }) => {
    if (completed) {
        // Render a completed state
        return <h3>Time to Party!!</h3>
    } else {
        // Render a countdown
        return (
            <div className='countdown-text'>
                <div className='countdown_date countdown_date--day'>
                    <span id="day_number" className='countdown_number'>{days}</span>
                    <span id="day_label" className='countdown_label'>Dias</span>
                </div>
                <div className='countdown_date countdown_date--hour'>
                    <span id="hour_number" className='countdown_number'>{hours}</span>
                    <span id="hour_label" className='countdown_label'>Hrs</span>
                </div>
                <div className='countdown_date countdown_date--minute'>
                    <span id="minute_number" className='countdown_number'>{minutes}</span>
                    <span id="minute_label" className='countdown_label'>Min</span>
                </div>
                <div className='countdown_date countdown_date--second'>
                    <span id="second_number" className='countdown_number'>{seconds}</span>
                    <span id="second_label" className='countdown_label'>Seg</span>
                </div>
            </div>
        );
    }
};

export default renderer;