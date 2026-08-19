const dataToSend = {
    username: 'test',
    email: 'test@example.com',
    age: 67
};

function send(){
    console.log('sent');
    fetch('https://uniserver-632q.onrender.com/api/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({key: 'value'})
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success response from server:', data);
    })
    .catch((error) => {
        console.error('Error sending data:', error);
    });
}
