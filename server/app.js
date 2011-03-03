#!/usr/bin/env node
var http = require('http'),
    io = require('./libs/socket.io'),
    o_ = require('./libs/utils'),
    server, socket;

o_.merge(global, require('./settings'));
try { o_.merge(global, require('./settings.local')); } catch(e) {}

server = http.createServer(function(req, res) {
    // Any other server code goes here.
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('');
});
server.listen(APP_PORT, APP_HOST);

var auth_handler = require('./auth/' + AUTH_LIBRARY)(),
    session_store = require('./session/' + SESSION_STORE)(),
    msg_handler = require('./message/' + MESSAGE_HANDLER)(auth_handler, session_store);

socket = io.listen(server);
socket.on('connection', function(client) {
    client.on('message', function(message) {
        msg_handler.message(client, message);
    });

    client.on('disconnect', function() {
        msg_handler.disconnect(client, SESSION_TIMEOUT);
    });
});
