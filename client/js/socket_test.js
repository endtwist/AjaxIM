var socket = new io.Socket(),
    socketid = store.get('socketid') || false;
console.log(socketid);
if(socketid) {
    socket.transport = socket.getTransport([socketid.type]);
    socket.transport.sessionid = socketid.id;
}

socket.on('connect', function() {
    console.log('connected! ' + socket.transport.sessionid);
    store.set('socketid', {type: socket.transport.type,
                           id: socket.transport.sessionid});
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