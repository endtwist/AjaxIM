#!/usr/bin/env node
var sys = require('sys'),
    express = require('express'),
    io = require('./libs/socket.io'),
    packages = require('./libs/packages'),
    o_ = require('./libs/utils');
o_.merge(global, require('./settings'));
try { o_.merge(global, require('./settings.local')); } catch(e) {}

try {
    var daemon = require('./libs/daemon/daemon'),
        start = function() {
            daemon.init({
                lock: PID_FILE,
                stdin: '/dev/null',
                stdout: LOG_FILE,
                stderr: LOG_FILE,
                umask: 0,
                chroot: null,
                chdir: '.'
            });
        },
        stop = function() {
            process.kill(parseInt(require('fs').readFileSync(PID_FILE)));
        };

    switch(process.argv[2]) {
        case 'stop':
            stop();
            process.exit(0);
        break;

        case 'start':
            if(process.argv[3])
                process.env.EXPRESS_ENV = process.argv[3];
            start();
        break;

        case 'restart':
            stop();
            start();
            process.exit(0);
        break;

        case 'help':
            sys.puts('Usage: node app.js [start|stop|restart]');
            process.exit(0);
        break;
    }
} catch(e) {
    sys.puts('Daemon library not found! Please compile ' +
             './libs/daemon/daemon.node if you would like to use it.');
}

var app = express.createServer(
    express.methodOverride(),
    express.cookieDecoder(),
    express.bodyDecoder(),
    require('./middleware/im')({
        maxAge: 15 * 60 * 1000,
        reapInterval: 60 * 1000,
        authentication: require('./libs/authentication/' + AUTH_LIBRARY)
    })
);

app.set('root', __dirname);

app.configure('development', function() {
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/dev/views');

    app.stack.unshift({
        route: '/dev',
        handle: function(req, res, next) {
            req.dev = true;
            next();
        }
    });

    app.use(express.logger());
    app.use('/dev', express.router(require('./dev/app')));
    app.use(express.staticProvider(
                require('path').join(__dirname, '../client')));
    app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

app.listen(APP_PORT, APP_HOST);

var socket = io.listen(app, {
        transportOptions: {
            'websocket': {closeTimeout: 20000},
            'flashsocket': {closeTimeout: 20000},
            'htmlfile': {closeTimeout: 20000},
            'xhr-multipart': {closeTimeout: 20000},
            'xhr-polling': {closeTimeout: 20000},
            'jsonp-polling': {closeTimeout: 20000}
        }
    }),
    auth = require('./libs/authentication/' + AUTH_LIBRARY);

socket.on('connection', function(client) {
    client.metadata = function(key, def) {
        return client._metadata[key] || def || false;
    };

    client.sendTo = function(username, message) {
        try {
            Object.values(socket.clients).filter(function(cl) {
                return username == cl.metadata('username');
            }).each(function(user) {
                user.send(new packages.Message(
                    client.metadata('username'),
                    message
                ));
            });
            return true;
        } catch(e) {
            return false;
        }
    };

    client.on('connect', function() {
        client.authenticated = false;
        client.key_id = null;
        client.send({type: 'auth', id: client.sessionId, key: auth.cookie});
    });
    
    client.on('message', function(data) {
        if(!data['type']) {
            client.send(new packages.Error('bad packet'));
            return;
        }

        console.log(data);

        if(!client.authenticated) {
            if(data.type == 'auth') {
                auth.authenticate(data.id, function(info) {
                    if(info) {
                        client.authenticated = true;
                        client.key_id = data.id;
                        client._metadata = info;

                        auth.friends(data.id, info, function(friends) {
                            var friends_copy = friends.slice();
                            Object.values(socket.clients).filter(function(friend) {
                                return ~friends.indexOf(friend.metadata('username'));
                            }).each(function(friend) {
                                var username = friend.metadata('username');
                                friends_copy[friends_copy.indexOf(username)] =
                                                    [username, friend.metadata('status')];
                            }, this);
        
                            client.friends = friends_copy;
                            client.send({
                                type: 'hello',
                                username: client.metadata('username'),
                                friends: friends
                            });
                        });
                    } else {
                        client.send(new packages.Error('invalid auth'));
                    }
                });
            } else {
                client.send(new packages.Error('not authenticated'));
            }
        } else {
            // do shit.
            client.send(data);
            client.sendTo(client.metadata('username'), 'hello');
        }
    });
    
    client.on('disconnect', function() {
    
    });
});

// Listener endpoint; handled in middleware
app.get('/listen', function(){});

app.post('/message', function(req, res) {
    res.find(req.body['to'], function(user) {
        if(!user)
            return res.send(new packages.Error('not online'));

        res.message(user, new packages.Message(
            req.session.data('username'),
            req.body.body
        ));
    });
});

app.post('/message/typing', function(req, res) {
    if(~packages.TYPING_STATES.indexOf('typing' + req.body['state'])) {
        res.find(req.body['to'], function(user) {
            if(user) {
                res.message(user, new packages.Status(
                    req.session.data('username'),
                    'typing' + req.body.state
                ));
            }

            // Typing updates do not receive confirmations,
            // as they are not important enough.
            res.send('');
        });
    } else {
        res.send(new packages.Error('invalid state'));
    }
});

app.post('/status', function(req, res) {
    if(~packages.STATUSES.indexOf(req.body['status'])) {
        res.status(req.body.status, req.body.message);
        res.send(new packages.Success('status updated'));
    } else {
        res.send(new packages.Error('invalid status'));
    }
});

app.post('/signoff', function(req, res) {
    res.signOff();
    res.send(new packages.Success('goodbye'));
});
