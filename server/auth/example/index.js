var ExampleAuth = function() {};

ExampleAuth.prototype.authenticate = function(client, msg, callback) {
    callback({
        authenticated: true,
        username: 'username' + Math.round(Math.random() * 3)
    });
};

ExampleAuth.prototype.friends = function(client, res, callback) {
    callback(['username0', 'username1', 'username2', 'username3']);
};

var instance = new ExampleAuth();
module.exports = function getInstance() {
    return instance;
};
