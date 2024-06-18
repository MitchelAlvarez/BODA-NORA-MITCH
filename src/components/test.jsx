import React, { useEffect, useState } from 'react';

function Test() {
    const [data, setData] = useState(null);

    useEffect(() => {
        console.log('Fetching data...');
        fetch('https://youareinvite.mx/api/data')
            .then(response => response.json())
            .then(data => setData(data))
            .catch(error => console.error('Error:', error));
    }, []);

    return (
        <div>
            {data ? JSON.stringify(data) : 'Loading...'}
        </div>
    );
}

export default Test;