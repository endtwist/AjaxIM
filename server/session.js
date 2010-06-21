var utils = require('express/utils');

var User = Base.extend({
    constructor: function(id, data) {
        this.id = id;
        this.connection = null;
        this.listeners = [];
        this.message_queue = [];
        this._data = data;
    },

    connected: function(conn) {
        this.connection = conn;
    },

    listener: function(conn) {
        this.listeners.push(conn);
    },

    respond: function(code, message, callback) {
        this._send('connection', code, message, callback);
    },

    notify: function(code, message, callback) {
        this._send('listener', code, message, callback);
    },

    _send: function(type, code, message, callback) {
        if(!message && typeof code != 'number') {
            callback = message;
            message = code;
            code = 200;
        }

        if(typeof message != 'string') {
            try {
                message = JSON.encode(message);
            } except(e) {
                throw new Error('Could not JSON encode message content!');
            }
        }

        if(type == 'connection' && this.connection) {
            this.connection.respond(code, message, 'UTF-8');
        } else {
            if(!this.listeners.length)
                this.message_queue.push(arguments);

            var notify_run, self = this;
            (notify_run = function(conn) {
                return function() {
                    if(!conn) (callback ? callback() : return);

                    conn.respond(code, message,
                                 notify_run(self.listeners.pop()));
                };
            })(this.listeners.pop())();
        }
    },
    
    get: function(key, def) {
        if(key == 'id') return this.id;
        if(key in this._data)
            return this._data[key];
        else
            return def || false;
    }
});

Store.Memory.IM = Store.Memory.extend({
    name: 'Memory.IM',

    constructor: function(options) {
        Store.Memory.call(this);
        this.auth = options.authenticate;
    },

    fetch: function(req, callback) {
        var sid = req.cookie(this.auth.cookie);
        
        if(sid && this.store[sid]) {
            callback(null, this.store[sid], false);
        } else {
            this.generate(req, callback);
        }
    },

    generate: function(req, callback) {
        if(data = this.auth.authenticate(req)) {
            var sid = req.cookie(this.auth.cookie);
            callback(null, new User(sid, data), true);
        }
    }
});

Session.IM = Plugin.extend({
    extend: {
        init: function(options) {
            this.cookie = {};
            Object.merge(this, options);
            this.store = new (this.dataStore || Store.Memory.IM)(options);
            this.startReaper();
        },

        startReaper: function() {
            setInterval(function(self) {
                self.store.reap(self.lifetime || (1).day);
            }, this.reapInterval || this.reapEvery || (1).hour, this);
        }
    },

    on: {
        request: function(event, callback) {
            if(event.request.url.pathname === '/favicon.ico')
                return;

            Session.IM.store.fetch(event.request, function(err, session, is_new) {
                if(err) return callback(err);

                event.request.session = session;
                event.request.session.touch();

                if(event.request.url.pathname == '/listen') {
                    session.listener(event.request);

                    callback();
                    if(is_new) session.notify({type: 'noop'});
                    else if(session.message_queue.length)
                        session._send(session.message_queue.shift());
                } else {
                    session.connection = event.request;
                    callback();
                }
            });

            return true;
        },
        
        response: function(event, callback) {
            if(event.request.session)
                return Session.IM.store.commit(
                            event.request.session,
                            callback),
                        true;
        }
    }
});