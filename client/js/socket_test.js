var socket = new io.Socket();
socket.transport.sessionid = store.get('socketid') || null;

socket.on('connect', function() {
    console.log('connected!');
});

socket.on('message', function(data) {
    if(data.type == 'auth') {
        console.log(data);
        socket.send({type: 'auth', id: cookie.get(data.key)});
    } else {
        console.log(data);
    }
});

socket.on('disconnect', function() {
    console.log('disconnected!');
});

socket.connect();