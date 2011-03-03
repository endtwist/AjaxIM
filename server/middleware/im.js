var url = require('url'),
    Hub = require('./im/hub');

module.exports = function setupHub(options) {
    options = options || {};

    store = new Hub(options);

    return function session(req, res, next) {
        req.sessionStore = store;
        req.sessionID = req.cookies[options.authentication.cookie];

        if(!req.cookies) {
            next(new Error('session requires cookieDecoder to work properly'));
            return;
        }
        
        if(req.dev) {
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
                if(url.parse(req.url).pathname === '/listen') {
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

                next();
            });
        } else {
            next(new Error(JSON.stringify({
                                        type: 'error',
                                        error: 'not authenticated'})));
        }
    };
};
