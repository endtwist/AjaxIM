var sys = require('sys'),
    connect = require('connect'),
    express = require('express'),
    packages = require('./libs/packages');
Object.merge(global, require('ext'));

Object.merge(global, require('./settings'));
try { Object.merge(global, require('./settings.local')); } catch(e) {}

var app = express.createServer(
    connect.methodOverride(),
    connect.cookieDecoder(),
    connect.bodyDecoder(),
    require('./middleware/im')({
        lifetime: (15).minutes,
        reapInterval: (1).minute,
        authentication: require('./libs/authentication/' + AUTH_LIBRARY)
    })
);

app.set('root', __dirname);

app.configure('development', function() {
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/dev/views');

    app.use(connect.logger());
    app.use('/dev', connect.router(require('./dev/app')));
    app.use(connect.staticProvider(__dirname + '/dev/public'));
    app.use(connect.errorHandler({dumpExceptions: true, showStack: true}));
});

app.listen(APP_PORT, APP_HOST);

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
    if(-~packages.TYPING_STATES.indexOf('typing' + req.body['state'])) {
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
        res.status(req.body.status);
        res.send(new packages.Success('status updated'));
    } else {
        res.send(new packages.Error('invalid status'));
    }
});