var utils = require('express/utils'),
    events = require('events'),
    chat = require('./chat'),
    sys = require('sys');

var User = Base.extend({
    constructor: function(id, data) {
        this.id = id;
        this.connection = null;
        this.listeners = [];
        this.message_queue = [];
        this.convos = {};
        
        Session.IM.authentication.friends(data.username, (function(friends) {
            this.friends = friends;
        }).bind(this));
        
        this._data = data;

        this.events = new events.EventEmitter();
        this.events.addListener('status', function(value) {
            chat.AjaxIM.events.emit('update', new chat.Status(this, value));
        });
        
        chat.AjaxIM.events.addListener('update', (function(package) {
            if(this.friends.indexOf(package.user))
                this.notify(package);
        }).bind(this));
                
        chat.AjaxIM.users.push(this);
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

        if(typeof message != 'string')
            message = message.toString();

        if(type == 'connection' && this.connection) {
            this.connection.respond(code, message, 'UTF-8');
        } else {
            if(!this.listeners.length)
                this.message_queue.push(arguments);

            var notify_run, cx = this.listeners.slice();
            (notify_run = function(conn) {
                return function() {
                    if(!conn) {
                        if(callback) callback();
                        return;
                    }

                    conn.respond(code, message, 'UTF-8',
                                 notify_run(cx.shift()));
                };
            })(cx.shift())();
        }
    },
    
    signoff: function(callback) {
        chat.AjaxIM.events.emit('update', new chat.Offline(this));
        
        if(callback) callback()
    },
    
    get: function(key, def) {
        if(key == 'id') return this.id;
        if(key in this._data)
            return this._data[key];
        else
            return def || false;
    },
    
    get status() {
        return this.status;
    },
    
    set status(value) {
        this.status = value;
        this.events.emit('status', value);
    }
});

Store.Memory.IM = Store.Memory.extend({
    name: 'Memory.IM',

    constructor: function(options) {
        Store.Memory.call(this);
        this.auth = options.authentication;
    },

    fetch: function(req, callback) {
        var sid = req.cookie(this.auth.cookie),
            self = this;
        
        if(sid && this.store[sid]) {
            callback(null, this.store[sid]);
        } else {
            this.generate(sid, req, function(err, session) {
                self.commit(session);
                callback(err, session);
            });
        }
    },
    
    reap: function(ms) {
        var threshold = +new Date(Date.now() - ms),
            sids = Object.keys(this.store);
        for(var i = 0, len = sids.length; i < len; ++i) {
            this.store[sids[i]].signoff((function() {
                this.destroy(sids[i]);
            }).bind(this));
        }
    },

    generate: function(sid, req, callback) {
        this.auth.authenticate(req, function(data) {
            if(data) {
                callback(null, new User(sid, data));
            } else {
                callback(true);
            }
        });
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
        },
        
        get: function(session_id) {
            return this.store.store[session_id] || false;
        }
    },

    on: {
        request: function(event, callback) {
            if(event.request.url.pathname === '/favicon.ico')
                return;

            Session.IM.store.fetch(event.request, function(err, session) {
                if(err) return callback(err);

                event.request.session = session;
                event.request.session.touch();

                if(event.request.url.pathname == '/listen') {
                    session.listener(event.request);
                    Session.IM.store.commit(event.request.session);
                    
                    if(msg = session.message_queue.shift())
                        session._send(msg);
                } else {
                    session.connection = event.request;
                }
                
                callback();
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
