#!/usr/bin/env node
var sys = require('sys'),
    express = require('express'),
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

var app = express();
//app.set('env', 'development');
app.use(require('method-override')());
app.use(require('cookie-parser')());;
app.use(require('body-parser')());;
app.use(require('./middleware/im')({
   maxAge: 15 * 60 * 1000,
   reapInterval: 60 * 1000,
   authentication: require('./libs/authentication/' + AUTH_LIBRARY)
}));

app.set('root', __dirname);

if ('development' == app.get('env')) {
    app.set('views', __dirname + '/dev/views');
    app.set('view engine', 'jade');
    
    app.use(require("morgan")());
    require('./dev/app')('/dev', app);
    app.use(express.static(
                require('path').join(__dirname, '../client')));
    app.use(require('express-error-handler')({dumpExceptions: true, showStack: true}));
}

app.listen(APP_PORT, APP_HOST);

// Listener endpoint; handled in middleware
app.get('/app/listen', function(){});

app.post('/app/message', function(req, res) {
    res.find(req.body['to'], function(user) {
        if(!user)
            return res.send(new packages.Error('not online'));

        res.message(user, new packages.Message(
            req.session.data('username'),
            req.body.body
        ));
    });
});

app.post('/app/message/typing', function(req, res) {
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

app.post('/app/status', function(req, res) {
    if(~packages.STATUSES.indexOf(req.body['status'])) {
        res.status(req.body.status, req.body.message);
        res.send(new packages.Success('status updated'));
    } else {
        res.send(new packages.Error('invalid status'));
    }
});

app.post('/app/signoff', function(req, res) {
    res.signOff();
    res.send(new packages.Success('goodbye'));
});
