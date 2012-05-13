var MessageHandler = function(auth_handler, session_store) {
    this.auth_handler = auth_handler;
    this.session_store = session_store;
};

MessageHandler.prototype._auth = function(client, message) {
    var session = this.session_store.get('identifier', message.identifier);

    if(session) {
        this.session_store.touch(session, client);
        client.send({
            type: 'AUTH',
            loggedin: true,
            username: session.username
        });
    } else {
        var auth_handler = this.auth_handler,
            session_store = this.session_store;

        // authenticate the new user
        auth_handler.authenticate(client, message, function(res) {

            // authentication succeeded, setup user
            if(res.authenticated) {

                // get user's friends
                auth_handler.friends(client, res, function(friends_array) {
                    var friends_list = {},
                        sess,
                        indentifier;

                    for(var i = 0, fl = friends_array.length; i < fl; i++) {
                        sess = session_store.get('username', friends_array[i])

                        if(sess) {
                            // notify friends that user has logged on
                            sess.client.send({
                                type: 'STATUS',
                                username: res.username,
                                status: 'online'
                            });

                            friends_list[friends_array[i]] = sess.status;
                        } else if(friends_array[i] == res.username) {
                            friends_list[friends_array[i]] = 'online';
                        } else {
                            friends_list[friends_array[i]] = 'offline';
                        }
                    }

                    identifier = session_store.create(res.username,
                                                      client,
                                                      friends_array
                                                     );

                    // notify user that they're logged on
                    client.send({
                        type: 'AUTH',
                        loggedin: true,
                        username: res.username,
                        friends: friends_list,
                        identifier: identifier
                    });
                });
            } else {
                // authentication failed
                client.send({
                    type: 'AUTH',
                    loggedin: false
                });
            }
        });
    }
}

MessageHandler.prototype._im = function(client, to, message) {
    var sender = this.session_store.get('client', client.sessionId),
        recipient;
    
    if(sender) {
        recipient = this.session_store.get('username', to);
        
        if(recipient) {
            recipient.client.send({
                type: 'IM',
                from: sender.username,
                message: message
            });
        } else {
            client.send({
                type: 'ERROR',
                origin: 'IM',
                to: to
            });
        }
    }
};

MessageHandler.prototype._status = function(client, status, status_msg) {
    var session = this.session_store.get('client', client.sessionId),
        friend;
    
    if(['online', 'away', 'offline'].indexOf(status) != -1) {
        session.status = status;
        this.session_store.set(session.username, session);
        
        // let user's friends know about the new status
        for(var i = 0, fl = session.friends.length; i < fl; i++) {
            friend = this.session_store.get('username', session.friends[i]);
            
            if(friend) {
                friend.client.send({
                    type: 'STATUS',
                    username: session.username,
                    status: status
                });
            }
        }
    }
};

MessageHandler.prototype._disconnect = function(client, SESSION_TIMEOUT) {
    var threshold = +new Date - SESSION_TIMEOUT,
        session = this.session_store.get('client', client);
    
    if(session && session.lastAccess < threshold) {
        if(session.status != 'offline')
            this._status(session.username, 'offline');
        
        this.session_store.remove(session.username);
    }
};

MessageHandler.prototype.message = function(client, message) {
    console.log(message);
    switch(message.type) {
        case 'AUTH':
            this._auth(client, message);
        break;

        case 'IM':
            this._im(client, message.to, message.message);
        break;

        case 'STATUS':
            this._status(client, message.status, message.status_msg);
        break;
    }
};

MessageHandler.prototype.disconnect = function(client, SESSION_TIMEOUT) {
    var self = this;
    setTimeout(function() {
        self._disconnect(client, SESSION_TIMEOUT);
    }, SESSION_TIMEOUT);
};

module.exports = function createInstance(auth_handler, session_store) {
    return new MessageHandler(auth_handler, session_store);
};
