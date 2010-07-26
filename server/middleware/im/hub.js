var events = require('events'),
    sys = require('sys'),
    packages = require('../../libs/packages'),
    User = require('./user');

var Hub = module.exports = function Hub(options) {
    this.events = new events.EventEmitter();
    this.auth = options.authentication;
    this.sessions = {};

    this.maxAge = options.maxAge || 14400000;
    this.reapInterval = options.reapInterval || 60000;

    if(this.reapInterval !== -1) {
        setInterval(function(self) {
            self.reap(self.maxAge);
        }, this.reapInterval, this);
    }

    this.events.addListener('update', (function(package) {
        if(package.constructor === exports.Offline) {
            for(var i = 0, l = this.users.length; i < l; i++) {
                if(this.users[i].get('username') == package.user)
                    this.users.splice(i, 1);
            }
        }
    }).bind(this));
};

Hub.prototype.destroy = function(sid, fn) {
    this.set(sid, null, fn);
};

Hub.prototype.reap = function(ms) {
    var threshold = +new Date - ms,
        sids = Object.keys(this.sessions);
    for(var i = 0, len = sids.length; i < len; ++i) {
        var sid = sids[i], sess = this.sessions[sid];
        if(sess.lastAccess < threshold) {
            sess.signoff((function() {
                delete this.sessions[sid];
            }).bind(this));
        }
    }
};

Hub.prototype.get = function(sid, fn) {
    if(this.sessions[sid]) {
        fn(null, this.sessions[sid]);
    } else {
        this.auth.authenticate(sid, (function(data) {
            if(data) {
                var session = new User(sid, data);
                this.set(sid, session);

                this.auth.friends(sid, data, (function(friends) {
                    var friends_copy = friends.slice();
                    Object.values(this.sessions).filter(function(friend) {
                        return ~friends.indexOf(friend.data('username'));
                    }).each(function(friend) {
                        var username = friend.data('username');
                        friends_copy[friends_copy.indexOf(username)] =
                                            [username, friend.data('status')];
                    }, this);

                    session._friends(friends_copy);
                    session.events.addListener('status', (function(value) {
                        this.events.emit(
                            'update',
                            new packages.Status(session.data('username'), value)
                        );
                    }).bind(this));
                    this.events.addListener('update',
                                        session.receivedUpdate.bind(session));
                    this.set(sid, session);
                    fn(null, session);
                }).bind(this));
            } else {
                fn();
            }
        }).bind(this));
    }
};

Hub.prototype.set = function(sid, sess, fn) {
    this.sessions[sid] = sess;
    fn && fn();
};

Hub.prototype.find = function(username, fn) {
    for(var sid in this.sessions) {
        var session = this.sessions[sid],
            sess_username = session.data('username');
        if(sess_username == username) {
            fn(session);
            return;
        }
    }
    fn(false);
};

Hub.prototype.message = function(from, to, package) {
    try {
        package.user = from;
        to.send(package);
        from.respond(new packages.Success('sent'));
    } catch(e) {
        from.respond(new packages.Error(e.description));
    }
};

Hub.prototype.signOff = function(sid) {
    this.get(sid, function(session) {
        if(session) this.events.emit('update', new packages.Offline(this));
    });
};
