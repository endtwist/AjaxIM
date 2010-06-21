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

require.paths.unshift(require.paths[0] + '/express');
require('express');
require('express/plugins');
Object.merge(global, require('ext'));
Object.merge(global, require('./session')); // Ugly.

Object.merge(global, require('./settings'));
try { Object.merge(global, require('./settings.local')); } catch(e) {}

var chat = require('./chat');

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
                        require('./libs/authenticate/' + AUTH_LIBRARY)
                    });
    set('root', __dirname);
});

get('/test_cookie', function() {
    var utils = require('express/utils');
    this.cookie('sessionid', utils.uid());
    this.respond(200, 'cookie set');
});

get('/listen', function() {
    // Do nothing.
});

get('/message/user/:username', function(username) {
    chat.AjaxIM.messageUser(this.session, username,
                            new chat.Message(
                                this.session,
                                this.param('body') || ''
                            ));
});

post('/message/user/:username', function(username) {
    chat.AjaxIM.messageUser(this.session, username,
                            new chat.Message(
                                this.session,
                                this.params.post['body'] || ''
                            ));
});

post('/message/user/:username/typing', function(username) {
    if('state' in this.params.post &&
       -~chat.TYPING_STATES.indexOf('typing' + this.params.post.state)) {
        chat.AjaxIM.messageUser(this.session, username,
                                new chat.Status(
                                    this.session,
                                    'typing' + this.params.post.state
                                ));
    }
});

post('/status', function() {
    if('status' in this.params.post &&
       -~chat.STATUSES.indexOf(this.params.post.status)) {
       this.session.status = this.params.post.status;
    }
});

run(APP_PORT, APP_HOST);