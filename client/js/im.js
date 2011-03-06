AjaxIM = function(options) {
    if(this instanceof AjaxIM) {
        var self = this,
            _defaults = {
                host: 'localhost',
                port: 8000,
                theme: 'themes/default'
            };

        this.settings = $.extend(_defaults, options);
        this.socket = new io.Socket(this.settings.host,
                                    {port: this.settings.port});

        // Load & wire up the chat bar HTML
        console.log(Template.bar);
        var IM = $('<div id="AjaxIM"></div>')
                    .appendTo('body')
                    .css('display', 'none');
        $(Template.bar).appendTo(IM);

        if(this.settings.theme) {
            if(typeof document.createStyleSheet == 'function')
                document.createStyleSheet(this.settings.theme + '/theme.css');
            else
                $('body').append('<link rel="stylesheet" href="' +
                    this.settings.theme + '/theme.css" />');
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
        //this._scrollers();

        this.socket.connect();
        this.socket.on('connect', function() { self._connected(); });
        this.socket.on('message', function(msg) { self._message(msg); });
        this.socket.on('disconnect', function() { self._disconnected(); });
    } else {
        return AjaxIM.init(options);
    }
};

AjaxIM.prototype._store = function(key, value) {
    if(['identifier', 'activeTab', 'offline', 'status']
            .indexOf(key) != -1) {
        this.user[key] = value;
        store.set('user', this.user);
    } else {
        if(this.username.length)
            store.set(key, Tea.encrypt(JSON.stringify(value), this.username));
    }
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

            var obj = $(this);
            obj.val('');
            obj.height(obj.data('height'));
        })
        .live('keypress', function(e) {
            var obj = $(this),
                scrollHeight = this.scrollHeight;

            if(!($.browser.msie && $.browser.opera))
                obj.height(0);

            if(scrollHeight > obj.height() || scrollHeight < obj.height())
                obj.height(scrollHeight);
        });

    // Focus the text input when a chatbox message log is clicked
    $('.imjs-msglog').live('click', function() {
        var chatbox = $(this).parents('.imjs-chatbox');
        chatbox.find('.imjs-input').focus();
    });

    // Create a chatbox when a buddylist item is clicked
    $('.imjs-friend').live('click', function() {
        var chatbox = self._createChatbox($(this).data('friend'));

        if(chatbox.parents('.imjs-tab').data('state') != 'active') {
            chatbox.parents('.imjs-tab').click();
            this._store('activeTab', $(this).data('friend'));
        }

        chatbox.find('.imjs-input').focus();
        if(!(input = chatbox.find('.imjs-input')).data('height')) {
            // store the height for resizing later
            input.data('height', input.height());
        }
    });

    // Setup and hide the scrollers
    $('.imjs-scroll').css('display', 'none');
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
    $(this).bind('changeStatusSuccessful changeStatusFailed', function() {
        $('#imjs-away-message-text').removeClass('imjs-loading');
    });

    // Setup reconnect button
    $('#imjs-reconnect').live('click', function() {
        self._store('offline', false);
        $('#imjs-reconnect').hide();
        $('.imjs-input').attr('disabled', false);

        // Restore status to available
        $('#imjs-status-panel .imjs-button').removeClass('imjs-toggled');
        $('#imjs-button-available').addClass('imjs-toggled');
        $(self.statuses).each(function() {
            $('#imjs-friends').removeClass('imjs-' + this);
        });
        $('#imjs-friends').addClass('imjs-available');
        $('#imjs-away-message-text, #imjs-away-message-text-arrow')
            .css('display', 'none');

        // Set status
        self._store('status', ['online', '']);
        self.status('online', '');

        // Reconnect
        self._storage();
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
        .data('state', 'minimized')
        .click(function(e) {
            if(!$(this).hasClass('imjs-not-connected') &&
                e.target.id != 'imjs-friends-panel' &&
                !$(e.target).parents('#imjs-friends-panel').length)
                self.activateTab.call(self, $(this));
        })
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

    $('#imjs-friends-panel').css('display', 'none');
};

AjaxIM.prototype._storage = function() {
    var self = this,
        chatstore = Tea.decrypt(store.get('chats') || '', this.username),
        friends = Tea.decrypt(store.get('friends') || '', this.username);
    console.log(friends)
    try {
        this.chatstore = JSON.parse(chatstore);
    } catch(e) {
        this.chatstore = {};
    }

    try {
        friends = JSON.parse(friends);
    } catch(e) {
        friends = {};
    }

    if(friends) {
        $.each(friends, function(friend, status) {
            self.addFriend(friend, status, 'Friends');
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

        var chatbox = self._createChatbox(username, true),
            msglog = chatbox.find('.imjs-msglog').empty();
        chatbox.data('lastDateStamp', null).css('display', 'none');

        if(typeof convo == 'string')
            convo = self.chatstore[username] = JSON.parse(convo);

        // Restore all messages, date stamps, and errors
        msglog.html(convo.join(''));

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

AjaxIM.prototype._clearSession = function() {
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
    console.log(msg);
    switch(msg.type) {
        case 'AUTH':
            if(msg.loggedin) {
                if('identifier' in msg) {
                    this._store('identifier', msg.identifier);
                }

                this.username = msg.username;

                $('#AjaxIM').show();
                this._wiring();
                if(this.user.offline == true) {
                    var self = this;
                    this.socket.disconnect();
                    setTimeout(function() { self._showReconnect(); }, 0);
                    return;
                } else {
                    this._storage();
                }

                $('#imjs-friends').attr('class', 'imjs-available');
                $.each(msg.friends, function(friend, status) {
                    self.addFriend(friend, status, 'Friends');
                });
                this._store('friends', msg.friends);
                this.friends = msg.friends;

                // Set username in Friends list
                var header = $('#imjs-friends-panel .imjs-header');
                header.html(header.html().replace('{username}', this.username));

                // Set status available
                $('#imjs-away-message-text, #imjs-away-message-text-arrow').hide();
                $('#imjs-status-panel .imjs-button').removeClass('imjs-toggled');
                $('#imjs-button-available').addClass('imjs-toggled');
            }
        break;

        case 'IM':
        break;

        case 'STATUS':
        break;
    }
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
        if((input = chatbox.find('.imjs-input')).length &&
            !input.data('height')) {
            if(!($.browser.msie && $.browser.opera)) input.height(0);
            if(input[0].scrollHeight > input.height() ||
               input[0].scrollHeight < input.height()) {
                input.height(input[0].scrollHeight);
            }

            // store the height for resizing later
            input.data('height', input.height());
        }

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
    store.set(this.username + '-chats', this.chatstore);

    $(this).trigger('tabToggled', ['closed', tab]);

    this._scrollers();

    return false;
};

AjaxIM.init = function(options) {
    if(!AjaxIM.client)
        AjaxIM.client = new AjaxIM(options);

    return AjaxIM.client;
};