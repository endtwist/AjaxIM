AjaxIM = function(options, actions) {
    if(this instanceof AjaxIM) {
        var self = this;

        // === {{{ defaults }}} ===
        //
        // These are the available settings for Ajax IM, and the associated
        // defaults:
        //
        // * {{{pollServer}}} is the default URL to which all actions refer. It is
        // possible to specify certain action URLs separately (as is used with the
        // NodeJS server).
        // * {{{theme}}} is the name of the theme folder that defines the HTML and
        // CSS of the IM bar and chat boxes. Usually, themes are deposited in the
        // provided "themes" folder and specified by that path, e.g. {{{themes/default}}}.
        // Theme files within the theme folder must be named {{{theme.html}}} and
        // {{{theme.css}}}.
        var defaults = {
            pollServer: '',
            theme: 'themes/default'
        };

        // === {{{AjaxIM.}}}**{{{settings}}}** ===
        //
        // These are the settings for the IM. If particular options are not specified,
        // the defaults (see above) will be used. //These options will be defined
        // upon calling the initialization function, and not set directly.//
        this.settings = $.extend(defaults, options);

        this.socket = new io.Socket();

        // We load the theme dynamically based on the passed
        // settings. If the theme is set to false, we assume
        // that the user is going to load it himself.
        this.themeLoaded = false;
        if(this.settings.theme) {
            $('<div>').appendTo('body').load(this.settings.theme + '/theme.html #imjs-bar, .imjs-tooltip',
                function() {
                    self.themeLoaded = true;
                    self.setup();
                }
            );
            if(typeof document.createStyleSheet == 'function')
                document.createStyleSheet(this.settings.theme + '/theme.css');
            else
                $('body').append('<link rel="stylesheet" href="' +
                    this.settings.theme + '/theme.css" />');
        } else {
            this.themeLoaded = true;
            this.setup();
        }

        // Allow a chatbox to be minimized
        $('.imjs-chatbox').live('click', function(e) {
            e.preventDefault();
            return false;
        });

        $('.imjs-chatbox .imjs-minimize').live('click', function() {
            $(this).parents('.imjs-selected').click();
        });

        // Setup message sending for all chatboxes
        $('.imjs-chatbox .imjs-input').live('keydown', function(event) {
            var obj = $(this);
            if(event.keyCode == 13 && !($.browser.msie && $.browser.version < 8)) {
                self.send(obj.parents('.imjs-chatbox').data('username'), obj.val());
            }
        }).live('keyup', function(event) {
            if(event.keyCode == 13) {
                if($.browser.msie && $.browser.version < 8) {
                    var obj = $(this);
                    self.send(obj.parents('.imjs-chatbox').data('username'), obj.val());
                }

                var obj = $(this);
                obj.val('');
                obj.height(obj.data('height'));
            }
        }).live('keypress', function(e) {
            var obj = $(this);
            if(!($.browser.msie && $.browser.opera)) obj.height(0);
            if(this.scrollHeight > obj.height() || this.scrollHeight < obj.height()) {
                obj.height(this.scrollHeight);
            }
        });

        $('.imjs-msglog').live('click', function() {
            var chatbox = $(this).parents('.imjs-chatbox');
            chatbox.find('.imjs-input').focus();
        });

        // Create a chatbox when a buddylist item is clicked
        $('.imjs-friend').live('click', function() {
            var chatbox = self._createChatbox($(this).data('friend'));

            if(chatbox.parents('.imjs-tab').data('state') != 'active') {
                chatbox.parents('.imjs-tab').click();
                store.set(self.username + '-activeTab', $(this).data('friend'));
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
                .not('.imjs-default')
                .slice(-1)
                .css('display', '');

            if(hiddenTab.length) {
                $('#imjs-bar li.imjs-tab:visible').eq(0).css('display', 'none');
                $(this).html(parseInt($(this).html()) - 1);
                $('#imjs-scroll-left').html(parseInt($('#imjs-scroll-left').html()) + 1);
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
                .not('.imjs-default')
                .slice(-1)
                .css('display', '');

            if(hiddenTab.length) {
                $('#imjs-bar li.imjs-tab:visible').slice(-1).css('display', 'none');
                $(this).html(parseInt($(this).html()) - 1);
                $('#imjs-scroll-right').html(parseInt($('#imjs-scroll-right').html()) + 1);
            }

            return false;
        });

        // Setup status buttons
        $('#imjs-status-panel .imjs-button').live('click', function() {
            var status = this.id.split('-')[2];

            $('#imjs-away-message-text, #imjs-away-message-text-arrow').animate({
                opacity: (status == 'away' ? 'show' : 'hide'),
                height: (status == 'away' ? 'show' : 'hide')
            }, 50);
            
            $('#imjs-status-panel .imjs-button').removeClass('imjs-toggled');
            $(this).addClass('imjs-toggled');
            
            if(self.current_status[0] == 'away')
                self._last_status_message = $('#imjs-away-message-text').val();

            $('#imjs-away-message-text').val(status == 'away'
                                                ? self._last_status_message ||
                                                  AjaxIM.l10n.defaultAway
                                                : '');

            self.status(status, $('#imjs-away-message-text').val());
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
            self.offline = false;
            store.remove(self.username + '-offline');
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
            self.current_status = ['available', ''];
            store.set(self.username + '-status', ['available', '']);
            self.status('available', '');
            
            // Reconnect
            self.storage();
            self.listen();
        });

        // Initialize the chatbox hash
        this.chats = {};

        // On window resize, check scroller visibility
        $(window).resize(function() {
            try {
                self._scrollers();
            } catch(e) {}
        });
    } else {
        return AjaxIM.init(options);
    }
};

$.extend(AjaxIM.prototype, {
    // == Main ==
    setup: function() {
        $(this).trigger('loadComplete');

        this.initTabBar();
        this._scrollers();

        this.username = store.get('user');
        this._lastReconnect = 0;

        if(this.username && store.get(this.username + '-offline') == true) {
            this.offline = true;
            
            var self = this;
            setTimeout(function() { self._showReconnect(); }, 0);
            return;
        }

        if(this.username)
            this.storage();

        this.socket.connect();
        this.socket.on('connect', this.connected);
        this.socket.on('message', this.message);
        this.socket.on('disconnect', this.disconnected);
    },
    
    

    // === {{{AjaxIM.}}}**{{{storage()}}}** ===
    //
    // Retrieves chat session data from whatever storage engine is enabled
    // (provided that one is enabled at all). If a page reloads, this function
    // is called to restore the user's chat state (existing conversations, active tab).
    // This function is called //automatically//, upon initialization of the IM engine.
    storage: function() {
        var self = this,
            chatstore = store.get(this.username + '-chats'),
            friends = store.get(this.username + '-friends'),
            status = store.get(this.username + '-status') || ['available', ''];

        this.chatstore = chatstore || {};
        this.friends = {};
        this.current_status = status;

        if(friends) {
            $.each(friends, function(friend, data) {
                self.addFriend(friend, data.status, data.group);
            });

            $('#imjs-friends').removeClass('imjs-not-connected')
                              .addClass('imjs-' + status[0]);
            
            $('#imjs-button-' + status[0]).addClass('imjs-toggled');
            if(status[0] == 'away') {
                setTimeout(function() {
                    $('#imjs-away-message-text, #imjs-away-message-text-arrow').show();
                }, 250);
                $('#imjs-away-message-text').val(this.current_status[1]);
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

        var activeTab = store.get(this.username + '-activeTab');
        if(activeTab && activeTab in this.chats) {
            this.chats[activeTab].parents('.imjs-tab').click();
            var msglog = this.chats[activeTab].find('.imjs-msglog');
            msglog[0].scrollTop = msglog[0].scrollHeight;
        }
        
        // Set username in Friends list
        var header = $('#imjs-friends-panel .imjs-header');
        header.html(header.html().replace('{username}', this.username));
    },

    // === //private// {{{AjaxIM.}}}**{{{_clearSession()}}}** ===
    //
    // Clears all session data from the last known user.
    _clearSession: function() {
        var last_user = store.get('user');
        $.each(['friends', 'activeTab', 'chats', 'status', 'connected'],
               function(i, key) {
                   store.remove(last_user + '-' + key);
               });
        store.set('user', '');

        this.chats = {};
        this.friends = {};
        this.chatstore = {};
        this.current_status = ['available', ''];

        $('.imjs-tab').not('.imjs-tab.imjs-default').remove();
        $('.imjs-friend-group').not('.imjs-friend-group.imjs-default').remove();

        delete this.username;
    },

    // === {{{AjaxIM.}}}**{{{listen()}}}** ===
    //
    // Queries the server for new messages.
    listen: function() {
        if(this.offline) return;

        var self = this;
        AjaxIM.get(
            this.actions.listen,
            {},
            function(response) {
                if(response)
                    self._parseMessage(response);

                setTimeout(function() { self.listen(); }, 0);
            },
            function(error) {
                self._notConnected();
                $(self).trigger('pollFailed', ['not connected']);

                // Try reconnecting in n*2 seconds (max 16)
                self._reconnectIn = (self._lastReconnect < (new Date()) - 60000)
                                     ? 1000
                                     : Math.min(self._reconnectIn * 2, 16000);
                self._lastReconnect = new Date();
                setTimeout(function() { self.listen(); }, self._reconnectIn);
            }
        );
    },

    // === //private// {{{AjaxIM.}}}**{{{_parseMessages(messages)}}}** ===
    //
    _parseMessage: function(message) {
        var self = this;
        $(this).trigger('parseMessage', [message]);

        switch(message.type) {
            case 'hello':
                this._clearSession();

                this.username = message.username;
                this.current_status = ['available', ''];
                store.set('user', message.username);
                store.set(this.username + '-status', this.current_status);

                $('#imjs-friends').attr('class', 'imjs-available');
                $.each(message.friends, function() {
                    var friend;
                    if(this.length == 2)
                        friend = this;
                    else
                        friend = [this.toString(), ['offline', '']];
                    self.addFriend(friend[0], friend[1], 'Friends');
                });
                store.set(this.username + '-friends', this.friends);
                
                // Set username in Friends list
                var header = $('#imjs-friends-panel .imjs-header');
                header.html(header.html().replace('{username}', this.username));
                
                // Set status available
                $('#imjs-away-message-text, #imjs-away-message-text-arrow').hide();
                $('#imjs-status-panel .imjs-button').removeClass('imjs-toggled');
                $('#imjs-button-available').addClass('imjs-toggled');
            break;

            case 'message':
                this.incoming(message.user, message.body);
            break;

            case 'status':
                this._friendUpdate(message.user, message.status,
                                   message.message);
                this._storeFriends();
            break;

            case 'notice':
            break;
            
            case 'goodbye':
                this._notConnected();
            break;

            default:
            break;
        }
    },

    // === {{{AjaxIM.}}}**{{{incoming(from, message)}}}** ===
    //
    // Handles a new message from another user. If a chatbox for that
    // user does not yet exist, one is created. If it does exist, but
    // is minimized, the user is notified but the chatbox is not brought
    // to the front. This function also stores the message, if a storage
    // method is set.
    //
    // ==== Parameters ====
    // * {{{from}}} is the username of the sender.
    // * {{{message}}} is the body.
    incoming: function(from, message) {
        // check if IM exists, otherwise create new window
        // TODO: If friend is not on the buddylist,
        // should add them to a temp list?
        var chatbox = this._createChatbox(from),
            tab = chatbox.parents('.imjs-tab');

        if(!$('#imjs-bar .imjs-selected').length) {
            tab.click();
        } else if(tab.data('state') != 'active') {
            this.notification(tab);
        }

        this._store(from, this._addMessage('b', chatbox, from, message));
    },

    // === {{{AjaxIM.}}}**{{{addFriend(username, group)}}}** ===
    //
    // Inserts a new friend into the friends list. If the group specified
    // doesn't exist, it is created. If the friend is already in this group,
    // they aren't added again, however, the friend item is returned.
    //
    // ==== Parameters ====
    // * {{{username}}} is the username of the new friend.
    // * {{{status}}} is the current status of the friend.
    // * {{{group}}} is the user group to which the friend should be added.
    addFriend: function(username, status, group) {
        var group_id = 'imjs-group-' + md5.hex(group);

        if(!(group_item = $('#' + group_id)).length) {
            var group_item = $('.imjs-friend-group.imjs-default').clone()
                    .removeClass('imjs-default')
                    .attr('id', group_id)
                    .data('group', group)
                    .appendTo('#imjs-friends-list');

            var group_header = group_item.find('.imjs-friend-group-header');
            group_header.html(group_header.html().replace('{group}', group));
        }

        var user_id = 'imjs-friend-' + md5.hex(username + group);

        if(!$('#' + user_id).length) {
            var user_item = group_item.find('ul li.imjs-default').clone()
                    .removeClass('imjs-default')
                    .addClass('imjs-' + status[0])
                    .attr('id', user_id)
                    .data('friend', username)
                    .appendTo(group_item.find('ul'));
            if(status[0] == 'offline')
                user_item.hide();
            user_item.html(
                user_item.html()
                         .replace('{username}', username)
                         .replace('{status}', status[1])
            );
            user_item.find('.imjs-friend-status')
                     .attr('title', status[1]);
        }

        this.friends[username] = {status: status, group: group};
        this._updateFriendCount();
        return this.friends[username];
    },

    // === //private// {{{AjaxIM.}}}**{{{_updateFriendCount()}}}** ===
    //
    // Counts the number of online friends and updates the friends count
    // in the friend tab.
    _updateFriendCount: function() {
        var friendsLength = 0;
        $.each(this.friends, function(u, f) {
            if(f.status[0] != 'offline') friendsLength++;
        });
        $('#imjs-friends .imjs-tab-text span span').html(friendsLength);
    },

    // === //private// {{{AjaxIM.}}}**{{{_storeFriends()}}}** ===
    //
    // If a storage method is enabled, the current state of the
    // user's friends list is stored.
    _storeFriends: function() {
        store.set(this.username + '-friends', this.friends);
    },

    // === //private// {{{AjaxIM.}}}**{{{_createChatbox(username)}}}** ===
    //
    // Builds a chatbox based on the default chatbox HTML and CSS defined
    // in the current theme. Should a chatbox for this user already exist,
    // a new one is not created. Instead, it is either given focus (should
    // no other windows already have focus), or a notification is issued.
    //
    // As well, if the chatbox does not exist, an associated tab will be
    // created.
    //
    // ==== Parameters ====
    // * {{{username}}} is the name of the user for whom the chatbox is intended
    // for.
    // * {{{no_stamp}}} sets whther or not to add a date stamp to the chatbox
    // upon creation.
    //
    // //Note:// New chatboxes are given an automatically generated ID in the
    // format of {{{#imjs-[md5 of username]}}}.
    _createChatbox: function(username, no_stamp) {
        var self = this,
            chatbox_id = 'imjs-' + md5.hex(username);
        if(!(chatbox = $('#' + chatbox_id)).length) {
            // add a tab
            var tab = this.addTab(username, '#' + chatbox_id);
            var chatbox = tab.find('.imjs-chatbox');

            chatbox.attr('id', chatbox_id);

            // remove default items from the message log
            var message_log = chatbox.find('.imjs-msglog').empty();

            // setup the chatbox header
            var cb_header = chatbox.find('.imjs-header');
            cb_header.html(cb_header.html().replace('{username}', username));

            if(!no_stamp) {
                // add a date stamp
                this._store(username, this._addDateStamp(chatbox));
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
                this._store(username, this._addDateStamp(chatbox));
            }

            if(!$('#imjs-bar .imjs-selected').length) {
                tab.click();
            } else {
                this.notification(tab);
            }

            setTimeout(function() { self._scrollers() }, 0);
        }

        return chatbox;
    },

    // === //private// {{{AjaxIM.}}}**{{{_addDateStamp(chatbox)}}}** //
    //
    // Adds a date/time notifier to a chatbox. These are generally
    // inserted upon creation of a chatbox, or upon the date changing
    // since the last time a date stamp was added. If a date stamp for
    // the current date already exists, a new one will not be added.
    //
    // ==== Parameters ====
    // * {{{chatbox}}} refers to the jQuery-selected chatbox DOM element.
    // * {{{time}}} is the date/time the date stamp will show. It is specified
    // in milliseconds since the Unix Epoch. This is //only// defined when
    // date stamps are being restored from storage; if not specified, the
    // current computer time will be used.
    _addDateStamp: function(chatbox, time) {
        var message_log = $(chatbox).find('.imjs-msglog');
        if(!time)
           time = (new Date()).getTime();

        var date_stamp = $('.imjs-tab.imjs-default .imjs-chatbox .imjs-msglog .imjs-date').clone();
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
            //$('<div></div>').appendTo(message_log);
            return {replace_last: false, html: ''};
        }
    },

    // === //private// {{{AjaxIM.}}}**{{{_addError(chatbox, error)}}}** //
    //
    // Adds an error to a chatbox. These are generally inserted after
    // a user sends a message unsuccessfully. If an error message
    // was already added, another one will be added anyway.
    //
    // ==== Parameters ====
    // * {{{chatbox}}} refers to the jQuery-selected chatbox DOM element.
    // * {{{error}}} is the error message string.
    // * {{{time}}} is the date/time the error occurred. It is specified in
    // milliseconds since the Unix Epoch. This is //only// defined when
    // errors are being restored from storage; if not specified, the current
    // computer time will be used.
    _addError: function(chatbox, error, time) {
        var message_log = $(chatbox).find('.imjs-msglog');

        var error_item =
            $('.imjs-tab.imjs-default .imjs-chatbox .imjs-msglog .imjs-error').clone();

        var error_item_time = error_item.find('.imjs-msg-time');
        if(error_item_time.length) {
            if(!time)
                time = (new Date()).getTime();
            error_item_time.html(dateFormat(time, error_item_time.html()));
        }

        error_item.find('.imjs-error-error').html(error);
        error_item.appendTo(message_log);

        message_log[0].scrollTop = message_log[0].scrollHeight;

        return {
            replace_last: false,
            html: jQuery('<div>').append(error_item.clone()).html()
        };
    },

    // === //private// {{{AjaxIM.}}}**{{{_addMessage(ab, chatbox, username, message, time)}}}** //
    //
    // Adds a message to a chatbox. Depending on the {{{ab}}} value,
    // the color of the username may change as a way of visually
    // identifying users (however, this depends on the theme's CSS).
    // A timestamp is added to the message, and the chatbox is scrolled
    // to the bottom, such that the new message is visible.
    //
    // Messages will be automatically tag-escaped, so as to prevent
    // any potential cross-site scripting problems. Additionally,
    // URLs will be automatically linked.
    //
    // ==== Parameters ====
    // * {{{ab}}} refers to whether the user is "a" or "b" in a conversation.
    // For the general case, "you" are "a" and "they" are "b".
    // * {{{chatbox}}} refers to the jQuery-selected chatbox DOM element.
    // * {{{username}}} is the username of the user who sent the message.
    // * {{{time}}} is the time the message was sent in milliseconds since
    // the Unix Epoch. This is //only// defined when messages are being
    // restored from storage. For new messages, the current computer
    // time is automatically used.
    _addMessage: function(ab, chatbox, username, message, time) {
        var last_message = chatbox.find('.imjs-msglog > *:last-child');
        if(last_message.hasClass('imjs-msg-' + ab)) {
            // Last message was from the same person, so let's just add another imjs-msg-*-msg
            var message_container = (last_message.hasClass('imjs-msg-' + ab + '-container')
                ? last_message
                : last_message.find('.imjs-msg-' + ab + '-container'));

            var single_message =
                $('.imjs-tab.imjs-default .imjs-chatbox .imjs-msglog .imjs-msg-' + ab + '-msg')
                .clone().appendTo(message_container);

            single_message.html(single_message.html().replace('{username}', username));
        } else if(!last_message.length || !last_message.hasClass('imjs-msg-' + ab)) {
            var message_group = $('.imjs-tab.imjs-default .imjs-chatbox .imjs-msg-' + ab)
                .clone().appendTo(chatbox.find('.imjs-msglog'));
            message_group.html(message_group.html().replace('{username}', username));

            var single_message = message_group.find('.imjs-msg-' + ab + '-msg');
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
        single_message.html(single_message.html().replace('{message}', message));

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
            replace_last : !!message_container,
            html: jQuery('<div>').append(
                      message_container
                      ? last_message.clone()
                      : message_group.clone()
                  ).html()
        };
    },

    _store: function(username, msg) {
        if(!msg.html.length) return;
        if(!this.chatstore) this.chatstore = {};

        if(!(username in this.chatstore)) {
            this.chatstore[username] = [];
        } else if(this.chatstore[username].length > 300) {
            // If the chat store gets too long, it becomes slow to load.
            this.chatstore[username].shift();
        }

        if(msg.replace_last)
            this.chatstore[username].pop();

        this.chatstore[username].push(msg.html);

        store.set(this.username + '-chats', this.chatstore);
    },

    // === //private// {{{AjaxIM.}}}**{{{_friendUpdate(friend, status, statusMessage)}}}** ===
    //
    // Called when a friend's status is updated. This function will update all locations
    // where a status icon is displayed (chat tab, friends list), as well as insert
    // a notification, should a chatbox be open.
    //
    // ==== Parameters ====
    // * {{{friend}}} is the username of the friend.
    // * {{{status}}} is the new status code. See {{{AjaxIM.statuses}}} for a list of available
    // codes. //Note: If an invalid status is specified, no action will be taken.//
    // * {{{statusMessage}}} is a message that was, optionally, specified by the user. It will be
    // used should "you" send the user an IM while they are away, or if their status is viewed
    // in another way (such as via the friends list [**not yet implemented**]).
    _friendUpdate: function(friend, status, statusMessage) {
        if(this.chats[friend]) {
            var tab = this.chats[friend].parents('.imjs-tab');
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
                    'chat' + status.toUpperCase() + status.slice(1)
                ].replace(/%s/g, friend));

            var msglog = this.chats[friend].find('.imjs-msglog');
            date_stamp.appendTo(msglog);
            msglog[0].scrollTop = msglog[0].scrollHeight;
        }

        if(this.friends[friend]) {
            var friend_id = 'imjs-friend-' + md5.hex(friend + this.friends[friend].group);
            $('#' + friend_id).attr('class', 'imjs-friend imjs-' + status);
            $('#' + friend_id).find('.imjs-friend-status')
                              .html(statusMessage)
                              .attr('status', statusMessage);

            if(status == 'offline') {
                $('#' + friend_id + ':visible').slideUp();
                $('#' + friend_id + ':hidden').hide();
            } else if(!$('#' + friend_id + ':visible').length) {
                $('#' + friend_id).slideDown();
            }

            this.friends[friend].status = [status, statusMessage];
            this._updateFriendCount();
        }
    },

    // === //private// {{{AjaxIM.}}}**{{{_notConnected()}}}** ===
    //
    // Puts the user into a visible state of disconnection. Sets the
    // friends list to "not connected" and empties it; disallows new messages
    // to be sent.
    _notConnected: function() {
        $('#imjs-friends')
            .addClass('imjs-not-connected')
            .unbind('click', this.activateTab);
        if($('#imjs-friends').hasClass('imjs-selected'))
            this.activateTab($('#imjs-friends'));
    },
    
    _showReconnect: function() {
        $('#imjs-reconnect').show();
    },

    // === {{{AjaxIM.}}}**{{{send(to, message)}}}** ===
    //
    // Sends a message to another user. The message will be added
    // to the chatbox before it is actually sent, however, if an
    // error occurs during sending, that will be indicated immediately
    // afterward.
    //
    // After sending the message, one of three status codes should be
    // returned as a JSON object, e.g. {{{{r: 'code'}}}}:
    // * {{{ok}}} &mdash; Message was sent successfully.
    // * {{{offline}}} &mdash; The user is offline or unavailable to
    // receive messages.
    // * {{{error}}} &mdash; a problem occurred, unrelated to the user
    // being unavailable.
    //
    // ==== Parameters ====
    // * {{{to}}} is the username of the recipient.
    // * {{{message}}} is the content to be sent.
    send: function(username, body) {
        if(!body) return;
        var self = this;

        if(this.chats[username]) {
            // possibly add a datestamp
            this._store(username, this._addDateStamp(this.chats[username]));
            this._store(username,
                        this._addMessage('a', this.chats[username],
                                         this.username, body));
        }

        $(this).trigger('sendingMessage', [username, body]);

        AjaxIM.post(
            this.actions.send,
            {to: username, body: body},
            function(result) {
                if(result.type == 'success' && result.success == 'sent') {
                    $(self).trigger('sendMessageSuccessful',
                                    [username, body]);
                } else if(result.type == 'error') {
                    if(result.error == 'not online')
                        $(self).trigger('sendMessageFailed',
                                        ['offline', username, body]);
                    else
                        $(self).trigger('sendMessageFailed',
                                        [result.error, username, body]);
                }
            },
            function(error) {
                self._notConnected();
                var error = self._addError(
                              self.chats[username],
                              'You are currently not connected or the ' +
                              'server is not available. Please ensure ' +
                              'that you are signed in and try again.');
                self._store(error);

                $(self).trigger('sendMessageFailed',
                                ['not connected', username, body]);
            }
        );
    },

    // === {{{AjaxIM.}}}**{{{status(s, message)}}}** ===
    //
    // Sets the user's status and status message. It is possible to not
    // set a status message by setting it to an empty string. The status
    // will be sent to the server, where upon the server will broadcast
    // the update to all individuals with "you" on their friends list.
    //
    // ==== Parameters ====
    // * {{{s}}} is the status code, as defined by {{{AjaxIM.statuses}}}.
    // * {{{message}}} is the custom status message.
    status: function(value, message) {
        var self = this;

        // update status icon(s)
        if(!~this.statuses.indexOf(value))
            return;

        // check if selected before writing over the class!
        $(this.statuses).each(function() {
            $('#imjs-friends').removeClass('imjs-' + this);
        });
        $('#imjs-friends').addClass('imjs-' + value);

        $(this).trigger('changingStatus', [value, message]);

        if(value == 'offline') {
            self._notConnected();
            self._showReconnect();
            store.set(this.username + '-offline', true);
            self.offline = true;
            $('.imjs-input').attr('disabled', true);

            AjaxIM.post(
                this.actions.signoff,
                {},
                function(result) {
                    if(result.type == 'success')
                        $(self).trigger('changeStatusSuccessful',
                                        [value, null]);
                },
                function(error) {
                    $(self).trigger('changeStatusFailed',
                                    ['not connected', value, null]);
                }
            );
        } else {
            AjaxIM.post(
                this.actions.status,
                {status: value, message: message},
                function(result) {
                    switch(result.type) {
                        case 'success':
                            $(self).trigger('changeStatusSuccessful',
                                            [value, message]);
                            self.current_status = [value, message];
                            store.set(self.username + '-status',
                                      self.current_status);
                        break;
    
                        case 'error':
                        default:
                            $(self).trigger('changeStatusFailed',
                                            [result.e, value, message]);
                        break;
                    }
                },
                function(error) {
                    $(self).trigger('changeStatusFailed',
                                    ['not connected', value, message]);
                }
            );
        }
    },

    // === {{{AjaxIM.}}}**{{{statuses}}}** ===
    //
    // These are the available status codes and their associated identities:
    // * {{{offline}}} (0) &mdash; Only used when signing out/when another
    // user has signed out, as once this status is set, the user is removed
    // from the server and friends will be unable to contact the user.
    // * {{{available}}} (1) &mdash; The user is online and ready to be messaged.
    // * {{{away}}} (2) &mdash; The user is online but is not available. Others
    // may still contact this user, however, the user may not respond. Anyone
    // contacting an away user will receive a notice stating that the user is away,
    // and (if one is set) their custom status message.
    // * {{{invisible}}} (3; **not yet implemented**) &mdash; The user is online,
    // but other users are made unaware, and the user will be represented
    // as being offline. It is still possible to contact this user, and for this
    // user to contact others; no status message or notice will be sent to others
    // messaging this user.
    statuses: ['offline', 'available', 'away'],

    // === {{{AjaxIM.}}}**{{{initTabs()}}}** ===
    //
    // Setup the footer bar and enable tab actions. This function
    // uses {{{jQuery.live}}} to set hooks on any bar tabs created
    // in the future.
    initTabBar: function() {
        var self = this;

        // Set up your standard tab actions
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
    },

    // === {{{AjaxIM.}}}**{{{activateTab()}}}** ===
    //
    // Activate a tab by setting it to the 'active' state and
    // showing any related chatbox. If a chatbox is available
    // for this tab, also focus the input box.
    //
    // //Note:// {{{this}}}, here, refers to the tab DOM element.
    activateTab: function(tab) {
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
                store.set(this.username + '-activeTab', username);

            $(this).trigger('tabToggled', ['activated', tab]);
        } else {
            tab.removeClass('imjs-selected').data('state', 'minimized');

            if(chatbox && chatbox.css('display') != 'none')
                chatbox.css('display', 'none');

            store.set(this.username + '-activeTab', '');

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
    },

    // === {{{AjaxIM.}}}**{{{closeTab()}}}** ===
    //
    // Close a tab and hide any related chatbox, such that
    // the chatbox can not be reopened without reinitializing
    // the tab.
    //
    // //Note:// {{{this}}}, here, refers to the tab DOM element.
    closeTab: function(tab) {
        tab = tab.parents('.imjs-tab');
        tab.css('display', 'none')
           .removeClass('imjs-selected')
           .data('state', 'closed');

        delete this.chatstore[tab.find('.imjs-chatbox').data('username')];
        store.set(this.username + '-chats', this.chatstore);

        $(this).trigger('tabToggled', ['closed', tab]);

        this._scrollers();

        return false;
    },

    // === {{{AjaxIM.}}}**{{{addTab(label, action, closable)}}}** ===
    //
    // Adds a tab to the tab bar, with the label {{{label}}}. When
    // clicked, it will call a callback function, {{{action}}}. If
    // {{{action}}} is a string, it is assumed that the string is
    // referring to a chatbox ID.
    //
    // ==== Parameters ====
    // * {{{label}}} is the text that will be displayed on the tab.\\
    // * {{{action}}} is the callback function, if it is a non-chatbox
    // tab, or a string if it //is// a chatbox tab.\\
    // * {{{closable}}} is a boolean value that determines whether or not
    // it is possible for a user to close this tab.
    //
    // //Note:// New tabs are given an automatically generated ID
    // in the format of {{{#imjs-tab-[md5 of label]}}}.
    addTab: function(label, action, closable) {
        var tab = $('.imjs-tab.imjs-default').clone().insertAfter('#imjs-scroll-left');
        tab.removeClass('imjs-default')
            .attr('id', 'imjs-tab-' + md5.hex(label))
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
    },

    // === {{{AjaxIM.}}}**{{{notification(tab)}}}** ===
    //
    // Displays a notification on a tab. Generally, this is called when
    // a tab is minimized to let the user know that there is an update
    // for them. The way the notification is displayed depends on the
    // theme CSS.
    //
    // ==== Parameters ====
    // * {{{tab}}} is the jQuery-selected tab DOM element.
    notification: function(tab) {
        var notify = tab.find('.imjs-notification');
        var notify_count = notify.data('count') + 1;

        notify.data('count', notify_count)
            .html(notify.data('default-text').replace('{count}', notify_count))
            .css('display', '');
    },

    // === //private// {{{AjaxIM.}}}**{{{_scrollers()}}}** ===
    //
    // Document me!
    _scrollers: function() {
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

        this._scrollerIndex();
    },

    _scrollerIndex: function() {
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
    }
})

// == Static functions and variables ==
//
// The following functions and variables are available outside of an initialized
// {{{AjaxIM}}} object.

// === {{{AjaxIM.}}}**{{{client}}}** ===
//
// Once {{{AjaxIM.init()}}} is called, this will be set to the active AjaxIM
// object. Only one AjaxIM object instance can exist at a time. This variable
// can and should be accessed directly.
AjaxIM.client = null;

// === {{{AjaxIM.}}}**{{{init(options, actions)}}}** ===
//
// Initialize the AjaxIM client object and engine. Here, you can define your
// options and actions as outlined at the top of this documentation.
//
// ==== Parameters ====
// * {{{options}}} is the hash of custom settings to initialize Ajax IM with.
// * {{{actions}}} is the hash of any custom action URLs.
AjaxIM.init = function(options, actions) {
    if(!AjaxIM.client)
        AjaxIM.client = new AjaxIM(options, actions);

    return AjaxIM.client;
}


// === {{{AjaxIM.}}}**{{{request(url, data, successFunc, failureFunc)}}}** ===
//
// Wrapper around {{{$.jsonp}}}, the JSON-P library for jQuery, and {{{$.ajax}}},
// jQuery's ajax library. Allows either function to be called, automatically,
// depending on the request's URL array (see {{{AjaxIM.actions}}}).
//
// ==== Parameters ====
// {{{url}}} is the URL of the request.
// {{{data}}} are any arguments that go along with the request.
// {{{success}}} is a callback function called when a request has completed
// without issue.
// {{{_ignore_}}} is simply to provide compatability with {{{$.post}}}.
// {{{failure}}} is a callback function called when a request hasn't not
// completed successfully.
AjaxIM.post = function(url, data, successFunc, failureFunc) {
    AjaxIM.request(url, 'POST', data, successFunc, failureFunc);
};

AjaxIM.get = function(url, data, successFunc, failureFunc) {
    AjaxIM.request(url, 'GET', data, successFunc, failureFunc);
};

AjaxIM.request = function(url, type, data, successFunc, failureFunc) {
    var errorTypes = ['timeout', 'error', 'notmodified', 'parseerror'];
    if(typeof failureFunc != 'function')
        failureFunc = function(){};

    $.ajax({
        url: url,
        data: data,
        dataType: 'json',
        type: type,
        cache: false,
        timeout: 299000,
        success: function(json, textStatus, xhr) {
            if('status' in xhr && xhr.status == '0') return;
            _dbg(json);
            successFunc(json);
        },
        complete: function(xhr, textStatus) {
            if(~errorTypes.indexOf(textStatus) || xhr.status == '0')
                failureFunc(textStatus);
        }
    });

    // This prevents Firefox from spinning indefinitely
    // while it waits for a response.
    /*
    if(url == 'jsonp' && $.browser.mozilla) {
        $.jsonp({
            'url': 'about:',
            timeout: 0
        });
    }
    */
};

// === {{{AjaxIM.}}}**{{{incoming(data)}}}** ===
//
// Never call this directly. It is used as a connecting function between
// client and server for Comet.
//
// //Note:// There are two {{{AjaxIM.incoming()}}} functions. This one is a
// static function called outside of the initialized AjaxIM object; the other
// is only called within the initalized AjaxIM object.
AjaxIM.incoming = function(data) {
    if(!AjaxIM.client)
        return false;

    if(data.length)
        AjaxIM.client._parseMessages(data);
}

// === {{{AjaxIM.}}}**{{{l10n}}}** ===
//
// Text strings used by Ajax IM. Should you want to translate Ajax IM into
// another language, merely change these strings.
//
// {{{%s}}} denotes text that will be automatically replaced when the string is
// used.
AjaxIM._ = function(str) {
    if(str in AjaxIM.l10n) return AjaxIM.l10n[str];
    return str;
};

AjaxIM.l10n = {
    dayNames: [
        "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ],
    monthNames: [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        "January", "February", "March", "April", "May", "June", "July", "August", "September",
        "October", "November", "December"
    ],

    chatOffline: '%s signed off.',
    chatAvailable: '%s became available.',
    chatAway: '%s went away.',

    notConnected: 'You are currently not connected or the server is not available. ' +
                  'Please ensure that you are signed in and try again.',
    notConnectedTip: 'You are currently not connected.',
    
    defaultAway: 'I\'m away.'
};

AjaxIM.debug = true;
function _dbg(msg) {
    if(AjaxIM.debug && window.console) console.log(msg);
}
