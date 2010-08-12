var sys = require('sys');

var Package = function() {};
Package.prototype._sanitize = function(content) {
    // strip HTML
    return content.replace(/<(.|\n)*?>/g, '');
};

var Error = exports.Error = function(error) {
    this.error = error;
};
sys.inherits(Error, Package);
Error.prototype.toJSON = function() {
    return {
        type: 'error',
        error: this.error
    };
};

var Success = exports.Success = function(success) {
    this.success = success;
};
sys.inherits(Success, Package);
Success.prototype.toJSON = function() {
    return {
        type: 'success',
        success: this.success
    };
};

var Message = exports.Message = function(from, body) {
    this.from = from;
    this.body = body;
};
sys.inherits(Message, Package);
Message.prototype.toJSON = function() {
    return {
        type: 'message',
        user: this.from,
        body: this._sanitize(this.body)
    };
};

var Notice = exports.Notice = function(username, info) {
    this.username = username;
    this.info = info;
};
sys.inherits(Notice, Package);
Notice.prototype.toJSON = function() {
    return {
        type: 'notice',
        user: this.username,
        info: this.info
    };
};

exports.TYPING_STATES = ['typing+', 'typing~', 'typing-'];
exports.STATUSES = ['available', 'away', 'idle'];
var Status = exports.Status = function(username, status, message) {
    var statuses = exports.STATUSES + exports.TYPING_STATES;

    this.username = username;
    this.status = -~statuses.indexOf(status) ? status : statuses[0];
    this.message = message;
};
sys.inherits(Status, Package);
Status.prototype.toJSON = function() {
    return {
        type: 'status',
        user: this.username,
        status: this.status,
        message: this._sanitize(this.message || '')
    };
};

var Offline = exports.Offline = function(username) {
    this.username = username;
};
sys.inherits(Offline, Package);
Offline.prototype.toJSON = function() {
    // A special type of status
    return {
        type: 'status',
        user: this.username,
        status: 'offline',
        message: ''
    };
};
