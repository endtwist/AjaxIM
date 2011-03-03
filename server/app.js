#!/usr/bin/env node
var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    io = require('socket.io'),
    uglifyjs,
    o_ = require('./libs/utils'),
    client = {
        'im.js': [
            'intro.js',
            'cookies.js', 'dateformat.js', 'json.js', 'md5.js', 'store.js',
            /*'templates.js',*/ 'im.js',
            'outro.js'
        ]
    },
    contentTypes = {
        js: 'text/javascript'
    },
    _clientFiles = {},
    server, socket;
try { var uglifyjs = require('uglify-js'); } catch(e) {}

o_.merge(global, require('./settings'));
try { o_.merge(global, require('./settings.local')); } catch(e) {}

server = http.createServer(_serveClient);
server.listen(APP_PORT, APP_HOST);

var authHandler = require('./auth/' + AUTH_LIBRARY)(),
    sessionStore = require('./session/' + SESSION_STORE)(),
    msgHandler = require('./message/' + MESSAGE_HANDLER)(authHandler, sessionStore);

// setup socket.io
socket = io.listen(server);
socket.on('connection', function(client) {
    client.on('message', function(message) {
        msgHandler.message(client, message);
    });

    client.on('disconnect', function() {
        msgHandler.disconnect(client, SESSION_TIMEOUT);
    });
});

// compile client javascript
for(var file in client) {
    var fileData = "";
    for(var i = 0, fl = client[file].length; i < fl; i++)
        fileData += fs.readFileSync(
                        __dirname + '/../client/js/' + client[file][i],
                        'utf8'
                    );
    var ext = file.split('.').pop();
    if(ext == 'js' && uglifyjs) {
        // if uglify-js is installed, let's compress
        fileData = uglifyjs.parser.parse(fileData);
        fileData = uglifyjs.uglify.ast_mangle(fileData);
        fileData = uglifyjs.uglify.ast_squeeze(fileData);
        fileData = uglifyjs.uglify.gen_code(fileData);
    }
    _clientFiles[file] = {
        headers: {
            'Content-Length': fileData.length,
            'Content-Type': contentTypes[ext]
            // Should use ETag
        },
        content: fileData,
        encoding: 'utf8'
    };
};

// serve client javascript
function _serveClient(req, res) {
    var path = url.parse(req.url).pathname, 
        file = path.substr(1);

    if(req.method == 'GET' && file in _clientFiles) {
        res.writeHead(200, _clientFiles[file].headers);
        res.end(_clientFiles[file].content, _clientFiles[file].encoding);
    } else {
        res.writeHead(404);
        res.end('404');
    }
}