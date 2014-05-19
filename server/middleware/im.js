var url = require('url'),
    Hub = require('./im/hub');

module.exports = function setupHub(options) {
    options = options || {};

    store = new Hub(options);

    return function session(req, res, next) {
        req.sessionStore = store;

        if(!req.cookies) {
            next(new Error('session requires cookieParser to work properly'));
            return;
        }

        // move "fake" cookies from query or body (for JSONP)
        if (!(options.authentication.cookie in req.cookies)) {
           if (req.param(options.authentication.cookie)) {
              req.cookies[options.authentication.cookie] = req.param(options.authentication.cookie);
           }
        }

        // move "fake" cookies from query or body (for JSONP)
        if (!('callback' in req.cookies)) {
           if (req.param('callback')) {
              req.cookies['callback'] = req.param('callback');
           }
        }

        req.sessionID = req.cookies[options.authentication.cookie];
        req.jsonpCallback = req.cookies.callback;

        if(url.parse(req.url).pathname.substring(0, 5) !== '/app/') {
            next();
            return;
        }

        if(req.sessionID) {
            store.get(req, function(err, sess) {
                if(err) {
                    next(err);
                    return;
                }

                if(!sess) {
                    next(new Error(JSON.stringify({
                                        type: 'error',
                                        error: 'not authenticated'})));
                    return;
                }

                sess.touch();
                if(url.parse(req.url).pathname === '/app/listen') {
                    req.connection.setTimeout(5 * 60 * 1000);
                    sess.listener(res);
                    store.set(req.sessionID, sess);

                    if(msg = sess.message_queue.shift())
                        sess._send.apply(sess, msg);
                } else {
                    sess.connection = res;
                }

                req.session = sess;
                res.find = store.find.bind(store);
                res.message = function(to, package) {
                    store.message(req.session, to, package);
                };
                res.status = function(value, message) {
                    req.session.status(value, message);
                };
                res.signOff = function() { store.signOff(req.sessionID); };

                if(url.parse(req.url).pathname !== '/app/listen') {
                    next();
                }
            });
        } else {
            next(new Error(JSON.stringify({
                                        type: 'error',
                                        error: 'not authenticated'})));
        }
    };
};
