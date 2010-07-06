var utils = require('express/utils'),
    events = require('events'),
    sys = require('sys');

exports.AjaxIM = AjaxIM = new (new Class({
    constructor: function() {
        this.users = [];
        this.events = new events.EventEmitter();
        this.events.addListener('update', (function(package) {
            if(package.constructor === exports.Offline) {
                for(var i = 0, l = this.users.length; i < l; i++) {
                    if(this.users[i].get('username') == package.user)
                        this.users.splice(i, 1);
                }
            }
        }).bind(this));
    },

    messageUser: function(session, user, package) {
        if(!(user in session.convos)) {
            try {
                var user_id = this.findUser(user).id;

                session.convos[user] =
                    new exports.Conversation(session.id, user_id);
            } catch(e) {
                session.respond(new exports.Error('user offline'));
                return;
            }
        }

        try {
            session.convos[user].send(package);
            session.respond(new exports.Success('sent'));
        } catch(e) {
            session.respond(new exports.Error(e.description));
        }
    },

    findUser: function(username) {
        return this.users.find(function(e) {
                   return e.get('username') == username;
               });
    },

    // === {{{ AjaxIM.online() }}} ===
    //
    // Return a list of currently signed in users and their statuses.
    online: function() {
    },

    // === {{{ AjaxIM.onlineTotal() }}} ===
    //
    // Return a count of the number of online users.
    onlineTotal: function() {
    }
}));

var Package = new Class({
    _sanitize: function(content) {
        // strip HTML
        return content.replace(/<(.|\n)*?>/g, '');
    }
});

exports.Error = Package.extend({
    constructor: function(error) {
        this.error = error;
    },

    toString: function() {
        return JSON.encode({
            type: 'error',
            error: this.error
        });
    }
});

exports.Success = Package.extend({
    constructor: function(success) {
        this.success = success;
    },

    toString: function() {
        return JSON.encode({
            type: 'success',
            success: this.success
        });
    }
});

exports.Message = Package.extend({
    constructor: function(user, body) {
        this.user = user;
        this.body = body;
    },

    toString: function() {
        return JSON.encode({
            type: 'message',
            user: this.user.get('username'),
            room: this.room,
            body: this._sanitize(this.body)
        });
    }
});

exports.Notice = Package.extend({
    constructor: function(user, info) {
        this.user = user;
        this.info = info;
    },

    toString: function() {
        return JSON.encode({
            type: 'notice',
            user: this.user.get('username'),
            room: this.room,
            info: this.info
        });
    }
});

exports.TYPING_STATES = ['typing+', 'typing~', 'typing-'];
exports.STATUSES = ['available', 'away', 'idle'];
exports.Status = Package.extend({
    constructor: function(user, status, message) {
        var statuses = exports.STATUSES + exports.TYPING_STATES;

        this.user = user;
        this.status = -~statuses.indexOf(status) ? status : statuses[0];
        this.message = message;
    },

    toString: function() {
        return JSON.encode({
            type: 'status',
            user: this.user.get('username'),
            status: this.status,
            message: this._sanitize(this.message || '')
        });
    }
});

exports.Offline = Package.extend({
    constructor: function(user) {
        this.user = user;
    },

    toString: function() {
        // A special type of status
        return JSON.encode({
            type: 'status',
            user: this.user.get('username'),
            status: 'offline',
            message: ''
        });
    }
});

exports.Conversation = new Class({
    constructor: function(you, them) {
        this.you = you;
        this.them = them;
        this.last_updated = Date.now();
    },

    send: function(package) {
        this.touch();
        if(user = Session.IM.get(this.them))
            user.notify(package);
        else
            throw new Error('user not online');
    },

    touch: function() {
        this.last_updated = Date.now();
    }
});