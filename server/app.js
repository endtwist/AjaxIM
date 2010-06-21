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
var sys = require('sys');

require.paths.unshift('express/lib');
require('express');
require('express/plugins');
Object.merge(global, require('ext'));
Object.merge(global, require('./session.js')); // Ugly.

require('settings.js');

configure('development', function() {
    use(Logger);
    use(Static);
});

configure(function() {
    use(MethodOverride);
    use(Cookie);
    use(Session.IM, {lifetime: (15).minutes,
                     reapInterval: (1).minute,
                     authentication:
                        require('libs/authenticate/' + AUTH_LIBRARY)
                    });
    set('root', __dirname);
});

var AjaxIM = new Class({
    // === {{{ AjaxIM.constructor() }}} ===
    //
    // Initializes the frontend webserver and the backend Memcache server, which provides
    // and easy-to-use API for controlling the server from other scripts.
    constructor: function() {
        if(typeof this.config.port != 'number')
            throw new TypeError();

        get('/listen', function() {
            // Do nothing.
        });
        
        post('/send', function() {
            this.send()
        });
        
        get('/status', this.status);

        run(PORT, HOST);
    }

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
            var time = Math.round(Date.now() / 1000);
            self.users[to].callback({
                t: 'm',
                s: user.username,
                r: to,
                m: this.request.uri.params.message
            });
            sent = true;
        }
        
        self._d('User [' + user.username + '] sent a message to [' + to + '] ' + (sent ? 'successfully.' : 'UNSUCCESSFULLY.'));

        self.users[user.username].active();
        self.sessions[user.session_id].active();
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
        self.users[user.username].active();
        self.sessions[user.session_id].active();
        this.response.reply(200, {status_updated: status_updated});
    };
    
    // === {{{ AjaxIM.online() }}} ===
    //
    // Return a list of currently signed in users and their statuses
    // sans the status messages.
    this.online = function() {
        var user = self._session(this.request, 'object');
                
        if(!user) {
            self._d('An unknown user tried to retrieve a list of online users without being authenticated.');
            return this.response.reply(200, {'r': 'error', 'e': 'no session found'});
        }
        
        this.response.reply(200, this.onlineList);
    };
    
    // === {{{ AjaxIM.onlineTotal() }}} ===
    //
    // Return a count of the number of online users.
    this.onlineTotal = function() {
        this.response.reply(200, {count: self.onlineCount});
    };
};

var im = new AjaxIM(config);
im.init();