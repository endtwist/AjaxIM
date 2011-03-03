var crypto = require('crypto');

var Session = function(username) {
    this.username = username;
    this.authenticated = false;
    this.lastAccess = new Date().getTime();
    this.client = -1;
    this.identifier = -1;
    this.friends = [];
    this.status = 'online';
};

var MemorySessionStore = function() {
    this.sessions = {};
    this.sessionClientMap = {};
    this.sessionIdentifierMap = {};
};

MemorySessionStore.prototype.create = function(username, client, friends) {
    var session = new Session(username);
    session.client = client;
    
    if(friends) {
        for(var i = 0, fl = friends.length; i < fl; i++)
            session.push(friends[i])
    }
    
    this.sessions[username] = session;
    this.sessionClientMap[client.sessionId] = username;
    
    // create a re-authentication identifier
    var md5 = crypto.createHash('md5'),
        identifier = md5.update(username + client.sessionId).digest('hex');
    this.sessionIdentifierMap[identifier] = username;
    session.identifier = identifier;
    
    return identifier;
};

MemorySessionStore.prototype.set = function(username, session) {
    this.sessions[username] = session;
    this.sessionClientMap[session.client.sessionId] = username;
    this.sessionIdentifierMap[session.identifier] = username;
};

MemorySessionStore.prototype.touch = function(session, client) {
    var new_session = session;
    new_session.lastAccess = new Date().getTime();
    new_session.client = client;

    this.remove(new_session.username);
    this.set(new_session.username, new_session);
};

MemorySessionStore.prototype.get = function(key, val) {
    switch(key) {
        case 'client':
            return this.sessions[this.sessionClientMap[val]];
        break;
        
        case 'username':
            return this.sessions[val];
        break;
        
        case 'identifier':
            return this.sessions[this.sessionIdentifierMap[val]];
        break;
    }
    
    return null;
}

MemorySessionStore.prototype.all = function() {
    return this.sessions;
};

MemorySessionStore.prototype.remove = function(username) {
    if(this.session.username) {
        var clientid = this.sessions[username].client.sessionId,
            identifier = this.sessions[username].identifier;
        delete this.sessionClientMap[clientid];
        delete this.sessionIdentifierMap[identifier];
        delete this.sessions[username];
    }
};

var instance = new MemorySessionStore();
module.exports = function getInstance() {
    return instance;
};
