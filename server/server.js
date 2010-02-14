// = Ajax IM =
//
// **Copyright &copy; 2005 &ndash; 2010 Joshua Gross**\\
// //MIT Licensed//
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// == Node.js Server ==
//
// This is the [[http://nodejs.org|node.js]] server for Ajax IM. It handles
// user state and passing communications amongst users, though it still
// relies on outside assistance for initial authentication. It is recommended
// that this server be used, rather than the PHP-only server script.
var sys = require('sys'),
    http = require('http'),
    tcp = require('tcp'),
    url = require('url'),
    config = require('./config');

var AjaxIM = function(config) {
    var self = this;
    
    // === {{{ public variables }}} ===
    //
    // There are a few public class variables that can be accessed
    // if need be.
    //
    // * {{{users}}} is a hash table of all active users, by username. Each active
    // user has their own hash table containing state and connection information:
    // ** {{{username}}} is the identifying name of the user. It is the same as the hash key.
    // ** {{{user_id}}} is the database-stored "id" of the user.
    // ** {{{session_id}}} is the session identifier that the user uses to communicate with the server. It is stored in a cookie on the client-side.
    // ** {{{last_active}}} is a Unix timestamp signifying when the user last executed a server-side action. It is used to determine when a user has become inactive.
    // ** {{{friends}}} is the list of the user's friends, as provided on login. Follows the same format as is outlined in {{{im.js}}}
    // ** {{{status}}} is the user's status, in the format {{{ {s: 0, m: 'message'}, }}} where {{{s}}} is the status code, and {{{m}}} is the status message.
    // ** {{{callback}}} is the function that will send data back to this user through any open connections. Should this user not be connected at that moment, messages are queued.
    // * {{{sessions}}} is a hash table of session ids with usernames as values.
    // * {{{debug}}} enables or disables debug messages from being output to the console. Set manually.
    // * {{{onlineCount}}} contains the number of users online at any one moment.
    this.users = {};
    this.sessions = {};
    
    this.config = config;
    
    this.debug = true;
    
    this.onlineCount = 0;
    
    // === {{{ AjaxIM.init() }}} ===
    //
    // Initializes the frontend webserver and the backend Memcache server, which provides
    // and easy-to-use API for controlling the server from other scripts.
    this.init = function() {
        if(typeof this.config.ports.public[0] != 'number' ||
            typeof this.config.ports.private[0] != 'number')
            throw new TypeError();
        this.server = new WebServer(this.config.ports.public[1],
            this.config.ports.public[0]);
        
        this.server.get('^/poll$', this.poll);
        this.server.get('^/send$', this.send);
        this.server.get('^/status$', this.status);
        this.server.get('^/resume$', this.resume);
        this.server.get('^/online$', this.online);
        this.server.start();
        
        this.internalServer =
            new MemcacheServer(this.config.ports.private[1], this.config.ports.private[0]);
        this.internalServer.login(function(username, data) {
            self.apiLogin.apply(self, [username, data]);
        });
        this.internalServer.getUser(function(cmd) {
            var actions = {
                'session': self.apiGetSession,
                'username': self.apiGetUser,
                'list': self.apiGetUserList,
                'online': self.apiOnlineCount
            };
        
            var parts = cmd.split('/');

            if(parts[0] in actions) {
                if(parts.length > 1 && parts[1].length > 0)
                    return actions[parts[0]].apply(self, parts.slice(1));
                else
                    return actions[parts[0]].apply(self);
            }
        });
        this.internalServer.logout(function(username) {
            return (self._killUser.call(self, username) !== false);
        });
        this.internalServer.setCustom('friends/add', function(type, id, value) {
            self.apiAddFriend.apply(self, [type, id, value]);
        });
        this.internalServer.setCustom('friends/remove', function(type, id, value) {
            self.apiRemoveFriend.apply(self, [type, id, value]);
        });
        this.internalServer.setCustom('broadcast/message', function(type, id, value) {
            self.apiBroadcastMessage.apply(self, [type, id, value]);
        });
        this.internalServer.setCustom('broadcast/raw', function(type, id, value) {
            self.apiBroadcastRaw.apply(self, [type, id, value]);
        });
        this.internalServer.start();
        
        this._start_gc();
    }
    
    // === //private//\\ {{{ AjaxIM._start_gc() }}} ===
    //
    // The "garbage collector," which is run every 5 seconds. It signs out
    // users which are no longer active and have no active connections. Those
    // users that have not been active for 50 or more seconds but have an active
    // connection have their connections reset (to prevent them from automatically
    // timing out).
    this._start_gc = function() {
        // Remove inactive users (> 30 seconds of inactivity & no callbacks)
        setInterval(function() {
            for(username in self.users) {
                var user = self.users[username];
                if((Date.now() - user.last_active) > 50000 &&
                    user._callbacks.length == 0) {

                    self._killUser(username);
                } else if((Date.now() - user.last_active) >= 50000) {
                    user.callback();
                }
            }
        }, 5000); // 5 seconds
        
        // Remove old sessions after session expiry period
        setInterval(function() {
            for(s in self.sessions) {
                var session = self.sessions[s];
                var age = (Date.now() - session.last_active) / 3600000; // in hours
                
                if(age >= self.config.cookie.period) {
                    self._d('Session [' + s + '] for user [' +
                        session.username + '] has expired and has been discarded.');
                    delete self.sessions[s];
                }
            }
        }, 3600000); // 1 hour
    };
    
    // === //private//\\ {{{ AjaxIM._session(request, provide) }}} ===
    //
    // Returns the requested session information, {{{provide}}}, based on
    // the given request object, {{{request}}}. If the session does not
    // exist, {{{false}}} is returned. If {{{'object'}}} is requested and
    // there is no active session for that user, {{{false}}} is also returned.
    //
    // ==== Parameters ====
    // * {{{request}}} is a request object, as is provided by the {{{http}}} module 
    // * {{{provide}}} is one of:
    // ** {{{username}}} which merely checks for the existence of session data and
    // returns the username for that session.
    // ** {{{object}}} checks for the existence of the session //and// the existence of an active session (the user is currently logged in), and returns the user object, if found.
    this._session = function(request, provide) {
        if(this.config.cookie.name in request.cookies) {
            try {
                var session_id = request.cookies[this.config.cookie.name].sid;

                if(session_id in this.sessions) {
                    var session = this.sessions[session_id];
                } else {
                    return false;
                }
            } catch(e) {
                this._d('Invalid cookie for an unknown user.');
                return false;
            }
        } else {
            return false;
        }

        switch(provide) {
            case 'username':
                return session.username;
            break;
            
            case 'session':
                return session;
            break;
            
            case 'object':
                if(session.username in this.users) {
                    return this.users[session.username];
                } else {
                    return false;
                }
            break;
        }
    };
    
    // === //private//\\ {{{ AjaxIM._d(str) }}} ===
    //
    // If debugging is enabled, this function prints debug data, with the
    // current formatted time, to the console.
    //
    // ==== Parameters ====
    // * {{{str}}} is the debug string.
    this._d = function(str) {      
        if(this.debug) {
            var addZero = function(str) { return str < 10 ? '0' + str : str; };
            
            var d = new Date();
            var d_str = addZero(d.getMonth() + 1) + '/' + addZero(d.getDate()) + '/' + d.getFullYear() + ' ' +
                addZero(d.getHours()) + ':' + addZero(d.getMinutes()) + ':' + addZero(d.getSeconds());
                
            sys.puts('[' + d_str + '] ' + str);
        }
    };
    
    // === //private//\\ {{{ AjaxIM._initUser(username, data) }}} ===
    //
    // Initializes a user session and adds the user to the users list. Additionally,
    // it stores a callback function which will push data directly to this user. A
    // "session" object is also stored, allowing a user to reconnect at a later time
    // (provided that their session hasn't yet expired).
    //
    // ==== Parameters ====
    // * {{{username}}} is the user's account name\\
    // * {{{data}}} is an array of user data:\\
    // ** {{{user_id}}} is a unique id for this particular user.
    // ** {{{session_id}}} is the user's unique session id (used to (re)connect to the server).
    // ** {{{friends}}} is the friends list.
    // ** {{{guest}}} (optional) defines whether or not this is a "guest" (temporary) user.
    this._initUser = function(username, data) {
        if(data['user_id']) {
            self._d('User [' + username + '] has connected. Adding to user hash and notifying friends.');

            if(!(username in self.users)) {
                self.users[username] = {
                    username: username,
                    user_id: data.user_id,
                    session_id: data.session_id,
                    last_active: Date.now(),
                    friends: data.friends,
                    status: {s: 1, m: ''},
                    guest: data['guest'] ? true : false,
                    callback: function(msg) {
                        var cbs = self.users[username]._callbacks;
                        if(msg)
                            self.users[username]._queue.push(msg);
                        
                        if(cbs.length) {
                            for(var i = 0; i < cbs.length; i++)
                                cbs[i](self.users[username]._queue);
                            self.users[username]._callbacks = [];
                            self.users[username]._queue = [];
                        } else {
                            if(self.users[username]._callbackAttempts < 3) {
                                setTimeout(function() {
                                    try {
                                        self.users[username].callback();
                                        self.users[username]._callbackAttempts++;
                                    } catch(e) {}
                                }, 150);
                            } else {
                                self.users[username]._callbackAttempts = 0;
                            }
                        }
                    },
                    _callbacks: [],
                    _queue: [],
                    _callbackAttempts: 0
                };
                self.onlineCount++;
            }

            self.sessions[data.session_id] = {
                username: username,
                user_id: data.user_id,
                friends: data.friends,
                last_active: Date.now()
            };
            return true;
        } else {
            return false;
        }
    };
    
    // === //private//\\ {{{ AjaxIM._killUser() }}} ===
    //
    // Remove a user from the server. If they are a guest user, also remove
    // their session data; otherwise, retain session data so that the user's
    // session can be resumed later.
    this._killUser = function(username) {
        if(!username || !(username in self.users))
            return false;
            
        var user = self.users[username];
        if(user['guest']) {
            // User was a guest, so notify everyone that they logged off and remove their session.
            self.apiBroadcastRaw('from', username, {t: 's', s: username, r: '', m: '0:'});
            delete self.sessions[self.users[username].session_id];
        } else {
            user.friends.forEach(function(f) {
                if(f.u in self.users) {
                    for(var i=0; i < self.users[f.u]['friends'].length; i++) {
                        if(self.users[f.u]['friends'][i].u == username && self.users[f.u]['friends'][i].u != user.username) {
                            self.users[f.u]['friends'][username].s = 0;
                            break;
                        }
                    }
                    
                    self.users[f.u].callback({t: 's', s: username, r: f.u, m: '0:'});
                }
            });
        }
                
        user.callback();

        self._d('User [' + username + '] has disconnected. Notifying friends and removing from user hash.');
        delete self.users[username];
        self.onlineCount--;
    };
    
    // === {{{ AjaxIM.poll() }}} ===
    //
    // Store the user's connection in the callback list and update both the
    // user and session "last_active" variable (denoting when the user last
    // contacted the server).
    this.poll = function() {
        if(this.debug && ('sid' in this.request.uri.params && this.request.uri.params['sid'].length))
            this.request.cookies[self.config.cookie.name] = {sid: this.request.uri.params.sid};
                
        if(!(user = self._session(this.request, 'object'))) {
            var r = this;
            self._d('User with session id [' + ('ajaxim_session' in this.request.cookies ?
                this.request.cookies.ajaxim_session['sid'] :
                'unknown'
            ) + '] tried to connect. No/invalid session found.');
            r.response.reply(200, {'r': 'error', 'e': 'no session found'});
        } else {
            var response = this.response;
            
            user._callbacks.push(function(msg) { response.reply(200, msg); });
            self.users[user.username].last_active = Date.now();
            self.sessions[user.session_id].last_active = Date.now();
        }
    };
    
    // === {{{ AjaxIM.resume() }}} ===
    //
    // Attempt to resume a session based on a session id stored in a
    // cookie.
    this.resume = function() {
        if(!(user = self._session(this.request, 'username'))) {
            this.response.reply(200, {'r': 'error', 'e': 'no session found'});
        } else {
            if(!(user in self.users)) {
                session = self._session(this.request, 'session');
                session['session_id'] = this.request.cookies[self.config.cookie.name].sid;
                self._initUser(user, session);
            }
            
            this.response.reply(200, {'r': 'connected'});
        }
    };
    
    // === {{{ AjaxIM.send() }}} ===
    //
    // Send a message to the user specified in the query and return a
    // result declaring whether or not the message was sent. Messages
    // are only sent if the user has an active session.
    this.send = function() {
        var sent = false;

        var user = self._session(this.request, 'object');
        var to = this.request.uri.params['to'] || '';
        
        if(!user) {
            self._d('An unknown user tried to send a message to [' + to + '] without being authenticated.');
            return this.response.reply(200, {'r': 'error', 'e': 'no session found'});
        }
        
        if(user.username && to &&
           to in self.users &&
           self.users[to].callback
        ) {
            var time = Math.round((new Date()).getTime() / 1000);
            self.users[to].callback({
                t: 'm',
                s: user.username,
                r: to,
                m: this.request.uri.params.message
            });
            sent = true;
        }
        
        self._d('User [' + user.username + '] sent a message to [' + to + '] ' + (sent ? 'successfully.' : 'UNSUCCESSFULLY.'));

        self.users[user.username].last_active = Date.now();
        self.sessions[user.session_id].last_active = Date.now();
        this.response.reply(200, {'sent': sent});
    };

    // === {{{ AjaxIM.status() }}} ===
    //
    // Update a user's status based on the query parameters; this includes
    // both their status code and any custom status message associated with
    // that code. If the status update is successful, send an update to the
    // user's friends.
    this.status = function() {
        var status_updated = false;

        var user = self._session(this.request, 'object');
                
        if(!user) {
            self._d('An unknown user tried to change their status without being authenticated.');
            return this.response.reply(200, {'r': 'error', 'e': 'no session found'});
        }
        
        var status = this.request.uri.params.status;
        var statusMsg = status + ':' + this.request.uri.params.message;
        
        user.friends.forEach(function(f) {
            if(f.u in self.users) {
                var group = null;
                for(var i=0; i < self.users[f.u]['friends'].length; i++) {
                    if(self.users[f.u]['friends'][i].u == user.username) {
                        self.users[f.u]['friends'][i].s = status;
                        group = self.users[f.u]['friends'][i].g;
                        break;
                    }
                }
                
                self.users[f.u].callback({t: 's', s: user.username, r: f.u, m: statusMsg, g: group});
            }
        });
        
        self._d('User [' + user.username + '] set his/her status to [' + statusMsg + ']. Friends notified.');
        
        self.users[user.username].status = {s: status, m: this.request.uri.params.message};
        self.users[user.username].last_active = Date.now();
        self.sessions[user.session_id].last_active = Date.now();
        this.response.reply(200, {status_updated: status_updated});
    };
    
    // === {{{ AjaxIM.online() }}} ===
    //
    // Return a count of the number of online users.
    this.online = function() {
        this.response.reply(200, {count: self.onlineCount});
    };
    
    // === {{{ AjaxIM.apiLogin(username, data) }}} ===
    //
    // A Memcache API function. Initializes a new user based on the
    // sent username and decoded JSON user data.
    //
    // ==== Parameters ====
    // * {{{username}}} is the unique username to initialize.
    // * {{{data}}} is the user data outlined in the _initUser function.
    this.apiLogin = function(username, data) {
        this._initUser.call(self, username, data);
    };
    
    // === {{{ AjaxIM.apiGetUser(username) }}} ===
    //
    // A Memcache API function. Returns user data based on a
    // specified username.
    //
    // ==== Parameters ====
    // * {{{username}}} is the name of the user to retrieve.
    this.apiGetUser = function(username) {
        var user = this.users[username];
        return {
            username: user.username,
            user_id: user.user_id,
            status: user.status,
            session_id: user.session_id
        };
    };
    
    // === {{{ AjaxIM.apiGetSession(session_id) }}} ===
    //
    // A Memcache API function. Returns user data based on a
    // specified session id. Returns the same data as apiGetUser.
    //
    // ==== Parameters ====
    // * {{{session_id}}} is the session id of the user to retrieve.
    this.apiGetSession = function(session_id) {
        if(session_id in this.sessions)
            return this.apiGetUser(this.sessions[session_id].username);
        else
            return false;
    };
    
    // === {{{ AjaxIM.apiGetUserList() }}} ===
    //
    // A Memcache API function. Returns user data for all online users.
    // Same data returned as apiGetUser, but in an array of all users.
    this.apiGetUserList = function() {
        var users = [];
        for(var username in this.users) {
            var user = this.users[username];
            if(user.status.s > 0) {
                users.push({
                    username: user.username,
                    user_id: user.user_id,
                    status: user.status,
                    session_id: user.session_id
                });
            }
        }
        return users;
    };
    
    // === {{{ AjaxIM.apiOnlineCount() }}} ===
    //
    // A Memcache API function. Returns a count of all online users.
    this.apiOnlineCount = function() {
        return {count: this.onlineCount};
    };
    
    // === {{{ AjaxIM.apiAddFriend(type, id, value) }}} ===
    //
    // A Memcache API function. Adds a user to the friends list
    // of another user.  Note, however, that this only adds the friend
    // to the user's active session; it does not add the friend permanently
    // to any database that might be in use.
    //
    // ==== Parameters ====
    // * {{{type}}} is the type of identifier used to identify the user. One of
    // "session" or "username".\\
    // * {{{id}}} is the actual identifier; a username or session id.\\
    // * {{{value}}} is an array of data about the new friend:
    // ** {{{u}}} is the username of the friend.
    // ** {{{g}}} is the group into which the friend will be placed.
    this.apiAddFriend = function(type, id, value) {
        if(type == 'session') {
            if(id in this.sessions)
                id = this.sessions[id].username;
            else
                return false;
        }
            
        if(id in this.users && typeof value == 'object' && 'u' in value) {
            if(value.u in this.users) {
                value['s'] = this.users[value.u].status.s;
                
                var status = this.users[value.u].status.s + ':' +
                    this.users[value.u].status.m;
                    
                this.users[id].callback({t: 's', s: value.u, r: id, m: status, g: value.g});
            }
            
            this.users[id].friends.push(value);                
            return true;
        } else {
            return false;
        }
    };
    
    // === {{{ AjaxIM.apiRemoveFriend(type, id, value) }}} ===
    //
    // A Memcache API function. Does the exact opposite of {{{apiAddFriend}}}.
    //
    // ==== Parameters ====
    // * {{{type}}} is the type of identifier used to identify the user. One of
    // "session" or "username".\\
    // * {{{id}}} is the actual identifier; a username or session id.\\
    // * {{{value}}} is the username of the friend to remove.
    this.apiRemoveFriend = function(type, id, value) {
        if(type == 'session') {
            if(id in this.sessions)
                id = this.sessions[id].username;
            else
                return false;
        }
                
        if(id in this.users && typeof value == 'string' && value.length > 0) {
            for(var i = 0; i < this.users[id].friends.length; i++) {
                if(this.users[id].friends[i].u == value) {
                    var group = this.users[id].friends[i].g;
                    // should be a 'remove' type, not a 'status' type...we'll fix this later.
                    this.users[id].callback({t: 's', s: value, r: id, m: '0:', g: group});
                    
                    return true;
                }
            }
        }
        
        return false;
    };
    
    // === {{{ AjaxIM.apiBroadcastMessage(type, id, value) }}} ===
    //
    // A Memcache API function. Broadcasts a message of type "message" ("m")
    // to all signed-in users.
    // 
    // ==== Parameters ====
    // * {{{type}}} should be "from".\\
    // * {{{id}}} is the name of the sender; can be anything.\\
    // * {{{value}}} is message.
    this.apiBroadcastMessage = function(type, id, value) {
        if(type != 'from' || !id.length)
            return false;
            
        for(user in this.users) {
            this.users[user].callback({t: 'm', s: id, r: user, m: value});
        }
        
        return true;
    };
    
    // === {{{ AjaxIM.apiBroadcastRaw(type, id, value) }}} ===
    //
    // A Memcache API function. Broadcasts a message of the specified
    // type to all signed-in users.
    // 
    // ==== Parameters ====
    // * {{{type}}} should be "from".\\
    // * {{{id}}} is the name of the sender; can be anything.\\
    // * {{{value}}} is message object:
    // ** {{{t}}} is the type of message.
    // ** {{{s}}} is the sender.
    // ** {{{r}}} is the recipient (usually irrelevant in broadcasted messages).
    // ** {{{m}}} is the content of the message.
    this.apiBroadcastRaw = function(type, id, value) {
        // Why "from?" This needs to be reconsidered.
        if(type != 'from' || !id.length || typeof value != 'object')
            return false;

        for(user in this.users) {
            this.users[user].callback(value);
        }
        
        return true;
    };
};

// == WebServer Class ==
function WebServer(host, port) {
    var self = this;
    this.host = host;
    this.port = port;
    
    this.urlMap = [];
    this.get = function(path, handler) {
        this._map(path, 'GET', handler);
    };

    this.post = function(path, handler) {
        this._map(path, 'POST', handler);
    };
    
    this._map = function(path, type, handler) {
        var path_regex = new RegExp(path);
        this.urlMap.push([path_regex, type, handler]);
    };

    this._notFound = function() {
        var nf = 'Not Found\n';
        this.response.sendHeader(404, {
            'Content-Type': 'text/plain',
            'Content-Length': nf.length
        });
        this.response.sendBody(nf);
        this.response.finish();
    };
    
    this._parseCookies = function(str) {
        var c = {};
        if(!str) return c;
        
        str = str.replace(/;/g, ', ');
        str.split(', ').forEach(function(cookie) {
            var parts = cookie.split('='),
                name = parts[0].trim(),
                value = parts[1].trim();
            
            try {
                c[name] = JSON.parse(decodeURIComponent(value));
            } catch(e) {
                c[name] = value;
            }
        });
        return c;
    }
    
    this.start = function() {    
        http.createServer(function(request, response) {
            var handler = self._notFound, args = [];
            
            if(typeof request['uri'] == 'undefined') {
                uri = url.parse(request.url, true);
                request['uri'] = {
                    'path': uri.pathname,
                    'params': uri.query || {}
                };
            }
            
            for(var i = 0; i < self.urlMap.length; i++) {
                var map = self.urlMap[i];
                if(map[1] == request.method && map[0].test(request.uri.path)) {
                    args = map[0].exec(request.uri.path);
                    handler = map[2];
                    break;
                }
            }
            
            request.setBodyEncoding('utf8');
            
            request.cookies = self._parseCookies(request.headers['cookie']);
            
            response.reply = function(code, obj) {
                var content = JSON.stringify(obj);
                content = request.uri.params.callback + '(' + content + ');';
                
                response.sendHeader(code, {
                    'content-type': 'text/html',
                    'content-length': content.length,
                    'expires': 'Mon, 26 Jul 1997 05:00:00 GMT',
                    'cache-control': 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0',
                    'pragma': 'no-cache'
                });
                response.sendBody(content);
                response.finish();
            }

            handler.apply({request: request, response: response}, args.slice(1));
        }).listen(this.port, this.host);
    };
}

// == MemcacheServer Class ==
function MemcacheServer(host, port) {
    var self = this;
    this.host = host;
    this.port = port;
    
    this._cb_login = null;
    this._cb_logout = null;
    this._cb_getuser = null;
    this._cb_custom = {};

    this.login = function(callback) {
        this._cb_login = callback;
    };
    
    this.logout = function(callback) {
        this._cb_logout = callback;
    };
    
    this.getUser = function(callback) {
        this._cb_getuser = callback;
    };
    
    this.setCustom = function(action, callback) {
        this._cb_custom[action] = callback;
    };
    
    this._add = function(username, data) {
        if(typeof self._cb_login != 'function' ||
            !('user_id' in data) || !('session_id' in data)) {
            this.send('NOT_STORED\r\n');
        } else if(self._cb_login(username, data)) {
            this.send('STORED\r\n');
        } else {
            this.send('NOT_STORED\r\n');
        }
    };
    
    this._set = function(username, action, value) {
        if(!action.length || !value) {
            this.send('NOT_STORED\r\n');
        } else {
            var result = false;
            for(var axn in self._cb_custom) {
                var rx = new RegExp(axn);
                if(rx.test(action)) {
                    result = self._cb_custom[axn](username[0], username[1], value);
                    break;
                }
            }
            
            if(result) {
                this.send('STORED\r\n');
            } else {
                this.send('NOT_STORED\r\n');
            }
        }
    };
    
    this._delete = function(username) {            
        if(typeof self._cb_logout == 'function' && self._cb_logout(username)) {
            this.send('DELETED\r\n');
        } else {
            this.send('NOT_FOUND\r\n');
        }
    };
    
    this._get = function(username) {
        if(typeof self._cb_getuser == 'function') {       
            var user = self._cb_getuser(username);
            if(user) {
                var json_user = JSON.stringify(user);
                this.send('VALUE ' + username + ' 0 ' + json_user.length + '\r\n')
                this.send(json_user + '\r\n');
            }
        }
                
        this.send('END\r\n');
    };
    
    this._gets = function(list) {
        if(typeof self._cb_getuser == 'function') {    
            var results = [];
            for(var i = 0; i < list.length; i++) {
                var user = self._cb_getuser(list[i]);
                if(user) {
                    var json_user = JSON.stringify(user);
                    results.push('VALUE ' + list[i] + ' 0 ' + json_user.length + '\r\n');
                    results.push(json_user + '\r\n');
                }
            }
    
            if(results.length) {
                this.send(results.join(''));
            }
        }
                
        this.send('END\r\n');
    };
    
    this.start = function() {
        tcp.createServer(function(socket) {
            socket.setEncoding('utf8');
            
            var cmd = {};
            var incoming = '';
            socket.addListener('receive', function(data) {
                incoming += data;

                // We're in the middle of receiving some data, so we can't
                // parse it yet.
                if(data.substring(data.length - 2) != '\r\n')
                    return;
                
                data = incoming;
                incoming = '';
                
                var parts = data.split(/ /);
                if(parts[0].match(/^(add|set|delete|get|gets)$/i)) {
                    switch(parts[0]) {
                        case 'add':
                            var message = JSON.parse(data.split('\r\n')[1]);
                            self._add.call(socket, parts[1].replace('\r\n', ''), message);
                        break;
                        
                        case 'set':
                            var message = data.split('\r\n')[1];
                            try {
                                message = JSON.parse(message);
                            } catch(e) {}
                            var subparts = parts[1].replace('\r\n', '').split('/');
                            self._set.call(socket, subparts.slice(0, 2), subparts.slice(2).join('/'), message);
                        break;
                        
                        case 'delete':
                            self._delete.call(socket, parts[1].replace('\r\n', ''));
                        break;
                        
                        case 'get':
                            self._get.call(socket, parts[1].replace('\r\n', ''));
                        break;
                        
                        case 'gets':
                            var getsparts = parts.slice(1);
                            getsparts[getsparts.length - 1] =
                                getsparts[getsparts.length - 1].replace('\r\n', '');
                            self._gets.call(socket, getsparts);
                        break;
                    }
                }
            });
        }).listen(this.port, this.host);
    };
}

var im = new AjaxIM(config);
im.init();