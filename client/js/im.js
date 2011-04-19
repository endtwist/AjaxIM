AjaxIM = function(options) {
    if(this instanceof AjaxIM) {
        var self = this,
            _defaults = {
                host: 'localhost',
                port: 8000,
                theme: true
            };

        this.settings = $.extend(_defaults, options);
        this.socket = new io.Socket(this.settings.host,
                                    {port: this.settings.port});

        // Load & wire up the chat bar HTML
        var IM = $('<div id="AjaxIM"></div>')
                    .appendTo('body')
                    .css('display', 'none');

        if(this.settings.theme) {
            if(typeof document.createStyleSheet == 'function')
                document.createStyleSheet('http://'
                                          + this.settings.host
                                          + ':' + this.settings.port
                                          + '/theme.css');
            else
                $('body').append('<link rel="stylesheet" href="' +
                    'http://'
                    + this.settings.host
                    + ':' + this.settings.port
                    + '/theme.css" />');
        }

        this.friends = {};
        this.chats = {};
        this.username = '';
        this.user = store.get('user') || {
            identifier: '',
            activeTab: null,
            offline: false,
            status: ['online', '']
        };
        this._lastReconnect = 0;

        // On window resize, check scroller visibility
        $(window).resize(function() {
            try {
                self._scrollers();
            } catch(e) {}
        });

        this.socket.connect();
        this.socket.on('connect', function() { self._connected(); });
        this.socket.on('message', function(msg) { self._message(msg); });
        this.socket.on('disconnect', function() { self._disconnected(); });
        this.socket.on('connect_failed', function() { self._disconnected(); });
    } else {
        return AjaxIM.init(options);
    }
};

AjaxIM.prototype._store = function(key, value) {
    if(['identifier', 'activeTab', 'offline', 'status']
            .indexOf(key) != -1) {
        this.user[key] = value;
        store.set('user', this.user);
    } else if(this.username.length) {
        store.set(key, Tea.encrypt(JSON.stringify(value), this.username));
    }
};

AjaxIM.prototype._storeChat = function(username, content) {
    if(!this.chatstore) this.chatstore = {};

    if(!(username in this.chatstore)) {
        this.chatstore[username] = [];
    } else if(this.chatstore[username].length > 300) {
        // If the chat store gets too long, it becomes slow to load.
        this.chatstore[username].shift();
    }

    if(content && content.html.length) {
        if(content.replace_last)
            this.chatstore[username].pop();

        this.chatstore[username].push(content.html);
    }

    store.set('chats',
              Tea.encrypt(JSON.stringify(this.chatstore), this.username));
};

AjaxIM.prototype._wiring = function() {
    var self = this;

    // Prevent a chatbox from being minimized if just clicked
    $('.imjs-chatbox').live('click', function(e) {
        e.preventDefault();
        return false;
    });

    // Allow a chatbox to be minimized via minimize button
    $('.imjs-chatbox .imjs-minimize').live('click', function() {
        $(this).parents('.imjs-selected').click();
    });

    // Setup message sending for all chatboxes
    $('.imjs-chatbox .imjs-input')
        .live('keydown', function(event) {
            if(event.keyCode != 13 || ($.browser.msie && $.browser.version < 8))
                return;

            var obj = $(this);
            self.send(obj.parents('.imjs-chatbox').data('username'), obj.val());
        })
        .live('keyup', function(event) {
            if(event.keyCode != 13)
                return;

            if($.browser.msie && $.browser.version < 8) {
                var obj = $(this);
                self.send(obj.parents('.imjs-chatbox').data('username'),
                          obj.val());
            }

            $(this).val('').change();
        });

    // Focus the text input when a chatbox message log is clicked
    $('.imjs-msglog').live('click', function() {
        var chatbox = $(this).parents('.imjs-chatbox');
        chatbox.find('.imjs-input').focus();
    });

    // Create a chatbox when a buddylist item is clicked
    $('.imjs-friend').live('click', function() {
        var chatbox = self.createChatbox($(this).data('friend'));

        if(chatbox.parents('.imjs-tab').data('state') != 'active') {
            chatbox.parents('.imjs-tab').click();
            self._store('activeTab', $(this).data('friend'));
        }

        chatbox.find('.imjs-input').focus();
    });

    // Setup the scrollers
    $('#imjs-scroll-right').live('click', function() {
        var hiddenTab = $(this)
            .prevAll('#imjs-bar li.imjs-tab:hidden')
            .filter(function() {
                return (
                    $(this).data('state') != 'closed' &&
                    $(this).prev('#imjs-bar li.imjs-tab:visible').length
                );
            })
            .slice(-1)
            .css('display', '');

        if(hiddenTab.length) {
            $('#imjs-bar li.imjs-tab:visible').eq(0).css('display', 'none');
            $(this).html(parseInt($(this).html()) - 1);
            $('#imjs-scroll-left')
                .html(parseInt($('#imjs-scroll-left').html()) + 1);
        }

        return false;
    });
    $('#imjs-scroll-left').live('click', function() {
        var hiddenTab = $(this)
            .nextAll('#imjs-bar li.imjs-tab:hidden')
            .filter(function() {
                return (
                    $(this).data('state') != 'closed' &&
                    $(this).next('#imjs-bar li.imjs-tab:visible').length
                );
            })
            .slice(-1)
            .css('display', '');

        if(hiddenTab.length) {
            $('#imjs-bar li.imjs-tab:visible').slice(-1).css('display', 'none');
            $(this).html(parseInt($(this).html()) - 1);
            $('#imjs-scroll-right')
                .html(parseInt($('#imjs-scroll-right').html()) + 1);
        }

        return false;
    });

    // Setup status buttons
    $('#imjs-status-panel .imjs-button').live('click', function() {
        var status = this.id.split('-')[2],
            away_msg = $('#imjs-away-message-text');

        $('#imjs-away-message-text, #imjs-away-message-text-arrow').animate({
            opacity: (status == 'away' ? 'show' : 'hide'),
            height: (status == 'away' ? 'show' : 'hide')
        }, 50);

        $('#imjs-status-panel .imjs-button').removeClass('imjs-toggled');
        $(this).addClass('imjs-toggled');

        if(self.user.status[0] == 'away')
            self._last_status_message = away_msg.val();

        away_msg.val(status == 'away'
                        ? self._last_status_message ||
                          AjaxIM.l10n.defaultAway
                        : '');

        self.status(status, away_msg.val());
        return false;
    });

    // Allow status message to be changed
    $('#imjs-away-message-text')
        .live('keyup', (function() {
            var msg_type_timer = null;

            return function() {
                if(msg_type_timer) clearTimeout(msg_type_timer);

                msg_type_timer = setTimeout(function() {
                    self._last_status_message =
                    self.current_status[1] = $('#imjs-away-message-text')
                                                .addClass('imjs-loading').val();
                    self.status.apply(self, self.current_status);
                }, 250);
            };
        })());
    $(this).bind('statusChanged', function() {
        $('#imjs-away-message-text').removeClass('imjs-loading');
    });

    // Setup reconnect button
    $('#imjs-reconnect').live('click', function() {
        $('#imjs-reconnect').hide();
        $('.imjs-input').attr('disabled', false);

        self.socket.connect();
    });

    // Allow tabs to be activated and closed
    $('.imjs-tab')
        .live('click', function() {
            return self.activateTab.call(self, $(this));
        });

    $('.imjs-tab .imjs-close')
        .live('click', function() {
            return self.closeTab.call(self, $(this));
        });

    // Set up the friends list actions
    $(document).click(function(e) {
        if(~['imjs-friends'].indexOf(e.target.id) ||
            $(e.target).parents('#imjs-friends').length) {
            return;
        }

        if($('#imjs-friends').data('state') == 'active')
            self.activateTab.call(self, $('#imjs-friends'));
        else if($('#imjs-status').data('state') == 'active')
            self.activateTab.call(self, $('#imjs-status'));
    });

    $('#imjs-friends')
        .live('click', function(e) {
            if(!$(this).hasClass('imjs-not-connected') &&
                e.target.id != 'imjs-friends-panel' &&
                !$(e.target).parents('#imjs-friends-panel').length)
                self.activateTab.call(self, $(this));
        })
        /*
        .mouseenter(function() {
            if($(this).hasClass('imjs-not-connected')) {
                $('.imjs-tooltip')
                    .css('display', 'block')
                    .find('p')
                    .html(AjaxIM.l10n.notConnectedTip);

                var tip_left = $(this).offset().left -
                    $('.imjs-tooltip').outerWidth() +
                    ($(this).outerWidth() / 2);
                var tip_top = $(this).offset().top -
                    $('.imjs-tooltip').outerHeight(true);

                $('.imjs-tooltip').css({
                        left: tip_left,
                        top: tip_top
                    });
            }
        })
        .mouseleave(function() {
            if($(this).hasClass('imjs-not-connected')) {
                $('.imjs-tooltip').css('display', '');
            }
        });
        */
};

AjaxIM.prototype._setup = function() {
    $('.imjs-scroll, #imjs-friends-panel').css('display', 'none');
    $('#imjs-friends').data('state', 'minimized');
};

AjaxIM.prototype._restore = function() {
    var self = this,
        chatstore = Tea.decrypt(store.get('chats') || '', this.username),
        friends = Tea.decrypt(store.get('friends') || '', this.username);

    try {
        this.chatstore = JSON.parse(chatstore);
    } catch(e) {
        this.chatstore = {};
        store.set('chats', '');
    }

    try {
        friends = JSON.parse(friends);
    } catch(e) {
        friends = {};
        store.set('friends', '');
    }

    if(friends) {
        $.each(friends, function(friend, info) {
            self.addFriend(friend, info.status || 'offline', info.group || 'Friends');
        });

        $('#imjs-friends').removeClass('imjs-not-connected')
                          .addClass('imjs-' + this.user.status[0]);

        $('#imjs-button-' + status[0]).addClass('imjs-toggled');
        if(this.user.status[0] == 'away') {
            setTimeout(function() {
                $('#imjs-away-message-text, #imjs-away-message-text-arrow')
                    .show();
            }, 250);
            $('#imjs-away-message-text').val(this.user.status[1]);
        }
    }

    $.each(this.chatstore, function(username, convo) {
        if(!convo.length) return;

        if(typeof convo == 'string')
            convo = self.chatstore[username] = JSON.parse(convo);

        var chatbox = self.createChatbox(username, convo.join(''));
        chatbox.data('lastDateStamp', null).css('display', 'none');

        $(self).trigger('chatRestored', [username, chatbox]);
    });

    if(this.user.activeTab && this.user.activeTab in this.chats) {
        this.chats[this.user.activeTab].parents('.imjs-tab').click();
        var msglog = this.chats[this.user.activeTab].find('.imjs-msglog');
        msglog[0].scrollTop = msglog[0].scrollHeight;
    }

    // Set username in Friends list
    var header = $('#imjs-friends-panel .imjs-header');
    header.html(header.html().replace('{username}', this.username));
};

AjaxIM.prototype._kill = function() {
    var last_user = store.get('user');
    $.each(['friends', 'activeTab', 'chats', 'status', 'connected'],
           function(i, key) {
               store.remove(last_user + '-' + key);
           });
    store.set('user', '');

    this.chats = {};
    this.friends = {};
    this.chatstore = {};

    $('.imjs-friend-group').remove();

    delete this.user;
};

AjaxIM.prototype._connected = function() {
    this.socket.send({
        type: 'AUTH',
        cookies: document.cookie,
        identifier: this.user.identifier.length
                        ? this.user.identifier
                        : ''
    });
};

AjaxIM.prototype._message = function(msg) {
    var self = this;
    _dbg(msg);
    switch(msg.type) {
        case 'AUTH':
            if(msg.loggedin) {
                if('identifier' in msg) {
                    this._store('identifier', msg.identifier);
                }

                this.username = msg.username;

                $('#AjaxIM').html('').append($(Template.bar)).show();
                this._setup();

                // a run-once-per-page-load function
                this._wiring();
                this._wiring = function(){};

                if(this.user.offline == true) {
                    var self = this;
                    this.socket.disconnect();
                    setTimeout(function() { self._showReconnect(); }, 0);
                    return;
                } else {
                    this._restore();
                }

                $('#imjs-friends').attr('class', 'imjs-online');
                
                if(msg.friends) {
                    $.each(msg.friends, function(friend, status) {
                        self.addFriend(friend, status, 'Friends');
                    });
                    this._store('friends', this.friends);
                }

                // Set username in Friends list
                var header = $('#imjs-friends-panel .imjs-header');
                header.html(header.html().replace('{username}', this.username));

                // Set status available
                $('#imjs-away-message-text, #imjs-away-message-text-arrow').hide();
                $('#imjs-status-panel .imjs-button').removeClass('imjs-toggled');
                $('#imjs-button-online').addClass('imjs-toggled');
            }
        break;

        case 'IM':
            if(!msg['from']) return;
            
            if(!this.chats[msg.from])
                this.createChatbox(msg.from);
            
            this._storeChat(
                msg.from,
                this._addMessage('them', this.chats[msg.from], msg.from, msg.message)
            );
        break;

        case 'STATUS':
            if(!msg['username']) return;

            this._friendUpdate(msg.username, msg.status);
            this._store('friends', this.friends);
        break;
    }
};

AjaxIM.prototype._disconnected = function() {
    $('#imjs-friends')
        .addClass('imjs-not-connected');
    if($('#imjs-friends').hasClass('imjs-selected'))
        this.activateTab($('#imjs-friends'));
    $('.imjs-input').attr('disabled', true);
    $('#imjs-reconnect').show();
};

AjaxIM.prototype.friendsListNoop = function() {
    if($(this).hasClass('imjs-not-connected'))
        return false;
};

AjaxIM.prototype.send = function(username, message) {
    if(!message) return;
    var self = this;

    if(this.chats[username]) {
        // possibly add a datestamp
        this._storeChat(username, this._addDateStamp(this.chats[username]));
        this._storeChat(username,
                        this._addMessage('you', this.chats[username],
                                         this.username, message));
    }

    this.socket.send({
        type: 'IM',
        to: username,
        message: message
    });
    
    $(this).trigger('messageSent', [username, message]);
};

AjaxIM.prototype._statuses = ['offline', 'online', 'away'];
AjaxIM.prototype.status = function(value, message) {
    var self = this;

    // update status icon(s)
    if(this._statuses.indexOf(value) == -1)
        return;

    // check if selected before writing over the class!
    $(this._statuses).each(function() {
        $('#imjs-friends').removeClass('imjs-' + this);
    });
    $('#imjs-friends').addClass('imjs-' + value);
    
    this.socket.send({
        type: 'STATUS',
        status: value,
        status_msg: message
    });

    $(this).trigger('statusChanged', [value, message]);
};

AjaxIM.prototype.addFriend = function(username, status, group) {
    var group_id = 'imjs-group-' + md5.hex(group);

    if(!(group_item = $('#' + group_id)).length) {
        var group_item = $(Template.group)
                .attr('id', group_id)
                .data('group', group)
                .appendTo('#imjs-friends-list');

        var group_header = group_item.find('.imjs-friend-group-header');
        group_header.html(group_header.html().replace('{group}', group));
    }

    var user_id = 'imjs-friend-' + md5.hex(username + group);

    if(!$('#' + user_id).length) {
        var user_item = $(Template.friend)
                .addClass('imjs-' + status)
                .attr('id', user_id)
                .data('friend', username)
                .appendTo(group_item.find('ul'));
        if(status == 'offline')
            user_item.hide();
        user_item.html(
            user_item.html()
                     .replace('{username}', username)
                     .replace('{status}', status)
        );
        user_item.find('.imjs-friend-status')
                 .attr('title', status);
    }

    this.friends[username] = {status: status, group: group};
    this._updateFriendCount();
    return this.friends[username];
};

AjaxIM.prototype._updateFriendCount = function() {
    var friendsLength = 0;
    $.each(this.friends, function(u, f) {
        if(f.status != 'offline') friendsLength++;
    });
    $('#imjs-friends .imjs-tab-text span span').html(friendsLength);
};

AjaxIM.prototype._friendUpdate = function(username, status, statusMessage) {
    if(this.chats[username]) {
        var tab = this.chats[username].parents('.imjs-tab');
        var tab_class = 'imjs-tab';
        if(tab.data('state') == 'active') tab_class += ' imjs-selected';
        tab_class += ' imjs-' + status;

        tab.attr('class', tab_class);

        // display the status in the chatbox
        var date_stamp =
            $('.imjs-tab.imjs-default .imjs-chatbox .imjs-msglog .imjs-date').clone();

        var date_stamp_time = date_stamp.find('.imjs-msg-time');
        if(date_stamp_time.length)
            date_stamp_time.html(dateFormat(date_stamp_time.html()));

        var date_stamp_date = date_stamp.find('.imjs-date-date').html(
            AjaxIM.l10n[
                'chat' + status.slice(0, 1).toUpperCase() + status.slice(1)
            ].replace(/%s/g, username));

        var msglog = this.chats[username].find('.imjs-msglog');
        date_stamp.appendTo(msglog);
        msglog[0].scrollTop = msglog[0].scrollHeight;
    }

    if(this.friends[username]) {
        var friend_id = 'imjs-friend-' + md5.hex(username + 'Friends');
        $('#' + friend_id).attr('class', 'imjs-friend imjs-' + status);
        $('#' + friend_id).find('.imjs-friend-status')
                          .html(statusMessage);

        if(status == 'offline') {
            $('#' + friend_id + ':visible').slideUp();
            $('#' + friend_id + ':hidden').hide();
        } else if(!$('#' + friend_id + ':visible').length) {
            $('#' + friend_id).slideDown();
        }

        this.friends[username].status = status;
        this._updateFriendCount();
    }
};

AjaxIM.prototype.addTab = function(label, action, closable) {
    var tab = $(Template.tab).insertAfter('#imjs-scroll-left');
    tab.attr('id', 'imjs-tab-' + md5.hex(label))
       .html(tab.html().replace('{label}', label))
       .data('state', 'minimized');

    var notification = tab.find('.imjs-notification');
    notification.css('display', 'none')
        .data('count', 0)
        .data('default-text', notification.html())
        .html(notification.html().replace('{count}', '0'));

    if(closable === false)
        tab.find('.imjs-close').eq(0).remove();

    if(typeof action != 'string') {
        tab.find('.imjs-chatbox').remove();
        tab.click(action);
    }

    return tab;
};

AjaxIM.prototype.activateTab = function(tab) {
    var chatbox = tab.find('.imjs-chatbox') || false,
        input;

    if(tab.data('state') != 'active') {
        if(tab.attr('id') != 'imjs-friends') {
            $('#imjs-bar > li')
                .not(tab)
                .not('#imjs-friends, .imjs-scroll, .imjs-default')
                .add(tab.attr('id') == 'imjs-status' ? '#imjs-friends' : '')
                .removeClass('imjs-selected')
                .each(function() {
                    var self = $(this);
                    if(self.data('state') != 'closed') {
                        self.data('state', 'minimized');
                        var chatbox = self.find('.imjs-chatbox');
                        if(chatbox.length)
                            chatbox.css('display', 'none');
                    }
                });
        } else {
            $('#imjs-status')
                .removeClass('imjs-selected')
                .data('state', 'minimized')
                .find('.imjs-chatbox')
                .css('display', 'none');
        }

        if(chatbox && chatbox.css('display') == 'none')
            chatbox.css('display', '');

        // set the tab to active...
        tab.addClass('imjs-selected').data('state', 'active');

        // ...and hide and reset the notification icon
        tab.find('.imjs-notification').css('display', 'none')
            .data('count', 0);

        if(chatbox && (username = chatbox.data('username')))
            this._store('activeTab', username);

        $(this).trigger('tabToggled', ['activated', tab]);
    } else {
        tab.removeClass('imjs-selected').data('state', 'minimized');

        if(chatbox && chatbox.css('display') != 'none')
            chatbox.css('display', 'none');

        this._store('activeTab', username);

        $(this).trigger('tabToggled', ['minimized', tab]);
    }

    if(chatbox) {
        try {
            var msglog = chatbox.find('.imjs-msglog');
            msglog[0].scrollTop = msglog[0].scrollHeight;
        } catch(e) {}

        try { chatbox.find('.imjs-input').focus(); } catch(e) {}
    }
};

AjaxIM.prototype.closeTab = function(tab) {
    tab = tab.parents('.imjs-tab');
    tab.css('display', 'none')
       .removeClass('imjs-selected')
       .data('state', 'closed');

    delete this.chatstore[tab.find('.imjs-chatbox').data('username')];
    store.set('chats',
              Tea.encrypt(JSON.stringify(this.chatstore), this.username));

    $(this).trigger('tabToggled', ['closed', tab]);

    this._scrollers();

    return false;
};

AjaxIM.prototype.createChatbox = function(username, contents) {
    var self = this,
        chatbox_id = 'imjs-' + md5.hex(username);
    if(!(chatbox = $('#' + chatbox_id)).length) {
        // add a tab
        var tab = this.addTab(username, '#' + chatbox_id);
        var chatbox = tab.find('.imjs-chatbox');

        chatbox.attr('id', chatbox_id);
        
        // setup the textarea to autogrow
        chatbox.find('.imjs-input').autogrow();

        // remove default items from the message log
        var message_log = chatbox.find('.imjs-msglog').empty();

        // setup the chatbox header
        var cb_header = chatbox.find('.imjs-header');
        cb_header.html(cb_header.html().replace('{username}', username));

        if(!contents) {
            // add a date stamp
            this._storeChat(username, this._addDateStamp(chatbox));
        } else {
            message_log.html(contents);
        }

        // associate the username with the object and vice-versa
        this.chats[username] = chatbox;
        chatbox.data('username', username);

        if(username in this.friends) {
            status = this.friends[username].status;
            tab.addClass('imjs-' + status);
        }

        setTimeout(function() { self._scrollers(); }, 0);
    } else if(chatbox.parents('.imjs-tab').data('state') == 'closed') {
        chatbox.find('.imjs-msglog > *').addClass('imjs-msg-old');

        var tab = chatbox.parents('.imjs-tab');
        if(tab.css('display') == 'none')
            tab.css('display', '').removeClass('imjs-selected')
                .insertAfter('#imjs-scroll-left')
                .data('state', 'minimized');

        if(!no_stamp) {
            // possibly add a date stamp
            this._storeChat(username, this._addDateStamp(chatbox));
        }

        if(!$('#imjs-bar .imjs-selected').length) {
            tab.click();
        } else {
            this.notification(tab);
        }

        setTimeout(function() { self._scrollers() }, 0);
    }

    return chatbox;
};

AjaxIM.prototype._addDateStamp = function(chatbox, time) {
    var message_log = $(chatbox).find('.imjs-msglog');
    if(!time)
       time = (new Date()).getTime();

    var date_stamp = $(Template.datestamp);
    var date_stamp_time = date_stamp.find('.imjs-msg-time');
    if(date_stamp_time.length)
        date_stamp_time.html(dateFormat(time, date_stamp_time.html()));

    var date_stamp_date = date_stamp.find('.imjs-date-date');
    var formatted_date = dateFormat(time, date_stamp_date.html());
    if(chatbox.data('lastDateStamp') != formatted_date) {
        if(date_stamp_date.length)
            date_stamp_date.html(dateFormat(time, date_stamp_date.html()));

        chatbox.data('lastDateStamp', formatted_date);
        date_stamp.appendTo(message_log);

        return {
            replace_last: false,
            html: jQuery('<div>').append(date_stamp.clone()).html()
        };
    } else {
        return {replace_last: false, html: ''};
    }
};

AjaxIM.prototype._addMessage = function(yt, chatbox, username, message, time) {
    var message_container = chatbox.find('.imjs-msglog > *:last-child'),
        new_container = false;
    if(!message_container.hasClass('imjs-msg-' + yt + '-container')) {
        // message isn't from same person; create new message container
        message_container =
            $(Template['message_' + yt + '_outer']
              .replace('{username}', username))
                .appendTo(chatbox.find('.imjs-msglog'));
        new_container = true;
    }

    // clean up the message
    message = message.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/(^|.*)\*([^*]+)\*(.*|$)/, '$1<strong>$2</strong>$3');

    // autolink URLs
    message = message.replace(
        new RegExp('([A-Za-z][A-Za-z0-9+.-]{1,120}:[A-Za-z0-9/]' +
        '(([A-Za-z0-9$_.+!*,;/?:@&~=-])|%[A-Fa-f0-9]{2}){1,333}' +
        '(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*,;/?:@&~=%-]{0,1000}))?)', 'g'),
        '<a href="$1" target="_blank">$1</a>');

    // insert the message
    var single_message = $(
        Template['message_' + yt].replace('{message}', message)
    ).appendTo(message_container.find('ul'));

    // set the message time
    var msgtime = single_message.find('.imjs-msg-time');
    if(!time)
        time = new Date();

    if(typeof time != 'string')
        time = dateFormat(time, msgtime.html());

    msgtime.html(time);

    var msglog = chatbox.find('.imjs-msglog');
    msglog[0].scrollTop = msglog[0].scrollHeight;

    return {
        replace_last: !new_container,
        html: jQuery('<div>').append(message_container.clone()).html()
    };
};

AjaxIM.prototype._scrollers = function() {
    var needScrollers = false;
    $('#imjs-scroll-left').nextAll('.imjs-tab')
    .filter(function() {
        return $(this).data('state') != 'closed';
    })
    .each(function(i, tab) {
        tab = $(tab).css('display', '');

        var tab_pos = tab.position();
        if(tab_pos.top >= $('#imjs-bar').height() ||
           tab_pos.left < 0 ||
           tab_pos.right > $(document).width()) {
            $('.imjs-scroll').css('display', '');
            tab.css('display', 'none');
            needScrollers = true;
        }
    });

    if(!needScrollers) {
        $('.imjs-scroll').css('display', 'none');
    }

    if($('#imjs-scroll-left').css('display') != 'none' &&
        $('#imjs-scroll-right').position().top >= $('#imjs-bar').height()) {
        $('#imjs-bar li.imjs-tab:visible').slice(-1).css('display', 'none');
    }

    if($('#imjs-bar li.imjs-tab:visible').length) {
        while($('.imjs-selected').css('display') == 'none')
            $('#imjs-scroll-right').click();
    }

    var hiddenRight = $('#imjs-bar li.imjs-tab:visible').slice(-1)
        .nextAll('#imjs-bar li.imjs-tab:hidden')
        .not('.imjs-default')
        .filter(function() {
            return $(this).data('state') != 'closed'
        }).length;

    var hiddenLeft = $('#imjs-bar li.imjs-tab:visible').eq(0)
        .prevAll('#imjs-bar li.imjs-tab:hidden')
        .not('.imjs-default')
        .filter(function() {
            return $(this).data('state') != 'closed'
        }).length;

    $('#imjs-scroll-left').html(hiddenLeft);
    $('#imjs-scroll-right').html(hiddenRight);
};

AjaxIM.init = function(options) {
    if(!AjaxIM.client)
        AjaxIM.client = new AjaxIM(options);

    return AjaxIM.client;
};

AjaxIM.debug = true;
function _dbg(msg) {
    if(AjaxIM.debug && window.console) console.log(msg);
}
