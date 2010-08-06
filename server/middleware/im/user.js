var events = require('events'),
    packages = require('../../libs/packages');

var User = module.exports = function(id, data) {
    this.id = id;
    this.connection = null;
    this.listeners = [];
    this.message_queue = [];
    this.convos = {};
    this._data = data;

    this.events = new events.EventEmitter();
    this.status = packages.STATUSES[0];

    setInterval(this._expireConns.bind(this), 500);
};

User.prototype.receivedUpdate = function(package) {
    if(this.friends.indexOf(package.user))
        this.send(package);
};

User.prototype._friends = function(friends) {
    this.friends = friends;
    this.send(JSON.stringify({
        type: 'hello',
        username: this.data('username'),
        friends: friends
    }));
};

User.prototype._expireConns = function() {
    var conn,
        noop = JSON.stringify({type: 'noop'}),
        noop_headers = {
            'Content-Type': 'application/json',
            'Content-Length': noop.length
        };
    for(var i = 0; i < this.listeners.length; i++) {
        conn = this.listeners[i].connection;
        if((Date.now() - conn._idleStart) >= conn._idleTimeout - 2000) {
            this.listeners[i].writeHead(200, noop_headers);
            this.listeners[i].end(noop);
            this.listeners.splice(i, 1);
            i--;
        }
    }
};

User.prototype.listener = function(conn) {
    this.listeners.push(conn);
};

User.prototype.respond = function(code, message, callback) {
    this._send('connection', code, message, callback);
};

User.prototype.send = function(code, message, callback) {
    this._send('listener', code, message, callback);
};

User.prototype._send = function(type, code, message, callback) {
    if(!message && typeof code != 'number') {
        callback = message;
        message = code;
        code = 200;
    }

    if(typeof message != 'string')
        message = JSON.stringify(message);

    if(type == 'connection' && this.connection) {
        this.connection.writeHead(code || 200, {
            'Content-Type': 'application/json',
            'Content-Length': message.length
        });
        this.connection.end(message);
    } else {
        if(!this.listeners.length)
            return this.message_queue.push(arguments);

        var cx = this.listeners.slice(), conn;
        this.listeners = [];
        while(conn = cx.shift()) {
            conn.writeHead(code || 200, {
                'Content-Type': 'application/json',
                'Content-Length': message.length
            });
            conn.end(message);
        }
        if(callback) callback();
    }
};

User.prototype.data = function(key, def) {
    if(key == 'id') return this.id;
    return this._data[key] || this['_' + key] ||
           (typeof this[key] != 'function' && this[key]) ||
           def || false;
};

User.prototype.touch = function() {
    this.lastAccess = +new Date;
};

Object.defineProperty(User.prototype, 'status', {
    get: function() {
        return this._status;
    },
    set: function(value) {
        this._status = value;
        this.events.emit('status', value);
    }
});
