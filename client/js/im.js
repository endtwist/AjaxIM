//(function($) {
    // Cookies API
    var cookies = {
        // === {{{AjaxIM.}}}**{{{cookies.set(name, value, days)}}}** ===
        //
        // Sets a cookie, stringifying the JSON value upon storing it.
        //
        // ==== Parameters ====
        // * {{{name}}} is the cookie name.\\
        // * {{{value}}} is the cookie data that you would like to store.\\
        // * {{{days}}} is the number of days that the cookie will be stored for.
        set: function(name, value, days) {
            if (days) {
                var date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                var expires = "; expires=" + date.toGMTString();
            } else var expires = "";
            document.cookie = name + "=" + JSON.stringify(value) + expires + "; path=/";
        },

        // === {{{AjaxIM.}}}**{{{cookies.get(name)}}}** ===
        //
        // Gets a cookie, decoding the JSON value before returning the data.
        //
        // ==== Parameters ====
        // * {{{name}}} is the cookie name that you would like to retrieve.
        get: function(name) {
            var nameEQ = name + "=";
            var ca = document.cookie.split(';');
            for(var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) == ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) == 0) {
                  var cval = decodeURIComponent(c.substring(nameEQ.length, c.length));
                  return JSON.parse(cval);
                }
            }
            return null;
        },

        // === {{{AjaxIM.}}}**{{{cookies.erase(name)}}}** ===
        //
        // Deletes a cookie.
        //
        // {{{name}}} is the existing cookie that you would like to delete.
        erase: function(name) {
            self.cookies.set(name, '', -1);
        }
    };

    // Storage API
    var store = (function(){
    	var api = {},
    		win = window,
    		doc = win.document,
    		localStorageName = 'localStorage',
    		globalStorageName = 'globalStorage',
    		storage

    	api.set = function(key, value) {}
    	api.get = function(key) {}
    	api.remove = function(key) {}
    	api.clear = function() {}

    	function serialize(value) {
    		return JSON.stringify(value)
    	}
    	function deserialize(value) {
    		if (typeof value != 'string') { return undefined }
    		return JSON.parse(value)
    	}

    	if (localStorageName in win && win[localStorageName]) {
    		storage = win[localStorageName]
    		api.set = function(key, val) { storage[key] = serialize(val) }
    		api.get = function(key) { return deserialize(storage[key]) }
    		api.remove = function(key) { delete storage[key] }
    		api.clear = function() { storage.clear() }

    	} else if (globalStorageName in win && win[globalStorageName]) {
    		storage = win[globalStorageName][win.location.hostname]
    		api.set = function(key, val) { storage[key] = serialize(val) }
    		api.get = function(key) { return deserialize(storage[key] && storage[key].value) }
    		api.remove = function(key) { delete storage[key] }
    		api.clear = function() { for (var key in storage ) { delete storage[key] } }

    	} else if (doc.documentElement.addBehavior) {
    		function getStorage() {
    			if (storage) { return storage; }
    			storage = doc.body.appendChild(doc.createElement('div'))
    			storage.style.display = 'none'
    			// See http://msdn.microsoft.com/en-us/library/ms531081(v=VS.85).aspx
    			// and http://msdn.microsoft.com/en-us/library/ms531424(v=VS.85).aspx
    			storage.addBehavior('#default#userData')
    			storage.load(localStorageName)
    			return storage;
    		}
    		api.set = function(key, val) {
    			var storage = getStorage()
    			storage.setAttribute(key, serialize(val))
    			storage.save(localStorageName)
    		}
    		api.get = function(key) {
    			var storage = getStorage()
    			return deserialize(storage.getAttribute(key))
    		}
    		api.remove = function(key) {
    			var storage = getStorage()
    			storage.removeAttribute(key)
    			storage.save(localStorageName)
    		}
    		api.clear = function() {
    			var storage = getStorage()
    			var attributes = storage.XMLDocument.documentElement.attributes;
    			storage.load(localStorageName)
    			for (var i=0, attr; attr = attributes[i]; i++) {
    				storage.removeAttribute(attr.name)
    			}
    			storage.save(localStorageName)
    		}
    	}

    	return api
    })();

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

            // === {{{AjaxIM.}}}**{{{actions}}}** ===
            //
            // Each individual action that the IM engine can execute is predefined here.
            // By default, it merely appends the action onto the end of the {{{pollServer}}} url,
            // however, it is possible to define actions individually. //The alternative actions
            // will be defined upon calling the initialization function, and not set directly.//
            //
            // Should you define an action at a different URL, Ajax IM will determine whether
            // or not this URL is within the current domain. If it is within a subdomain of
            // the current domain, it will set the document.domain variable for you,
            // to match a broader hostname scope; the action will continue to use {{{$.post}}}
            // (the default AJAX method for Ajax IM).
            //
            // On the other hand, should you choose a URL outside the current domain
            // Ajax IM will switch to {{{$.getJSON}}} (a get request) to avoid
            // cross-domain scripting issues. This means that a server on a different
            // port or at a different address will need to be able to handle GET
            // requests rather than POST requests (such as how the Node.JS Ajax IM
            // server works).
            this.actions = $.extend({
                listen: this.settings.pollServer + '/listen',
                send: this.settings.pollServer + '/message',
                status: this.settings.pollServer + '/status'
            }, actions);

            // We load the theme dynamically based on the passed
            // settings. If the theme is set to false, we assume
            // that the user is going to load it himself.
            this.themeLoaded = false;
            if(this.settings.theme) {
                $('<div>').appendTo('body').load(this.settings.theme + '/theme.html #imjs-bar, .imjs-tooltip',
                    function() {
                        self.themeLoaded = true;
                        setup.apply(self);
                    }
                );
                if(typeof document.createStyleSheet == 'function')
                    document.createStyleSheet(this.settings.theme + '/theme.css');
                else
                    $('body').append('<link rel="stylesheet" href="' +
                        this.settings.theme + '/theme.css" />');
            } else {
                this.themeLoaded = true;
                setup.apply(this);
            }

            // Allow a chatbox to be minimized
            $('.imjs-chatbox').live('click', function(e) {
                e.preventDefault();
                return false;
            });

            $('.imjs-chatbox .imjs-minimize').live('click', function() {
                $(this).parents('.imjs-chatbox').data('tab').click();
            });

            // Allow a chatbox to be closed
            $('.imjs-chatbox .imjs-close').live('click', function() {
                var chatbox = $(this).parents('.imjs-chatbox');
                chatbox.data('tab')
                    .data('state', 'closed').css('display', 'none');

                delete self.chatstore[chatbox.data('username')];
                store.set(self.username + '-chats', self.chatstore);
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

                if(chatbox.data('tab').data('state') != 'active')
                    chatbox.data('tab').click();

                chatbox.find('.imjs-input').focus();
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
                console.log(hiddenTab)
                if(hiddenTab.length) {
                    $('#imjs-bar li.imjs-tab:visible').slice(-1).css('display', 'none');
                    $(this).html(parseInt($(this).html()) - 1);
                    $('#imjs-scroll-right').html(parseInt($('#imjs-scroll-right').html()) + 1);
                }

                return false;
            });

            // Initialize the chatbox hash
            this.chats = {};
            this.friends = {};

            $(window).resize(function() {
                try {
                    self.bar._scrollers();
                } catch(e) {}
            });
        } else {
            return AjaxIM.init(options);
        }
    };

    setup = function() {
    var self = this;
    $(self).trigger('loadComplete');

    $.extend(AjaxIM.prototype, {
        // == Main ==

        // === {{{AjaxIM.}}}**{{{storage()}}}** ===
        //
        // Retrieves chat session data from whatever storage engine is enabled
        // (provided that one is enabled at all). If a page reloads, this function
        // is called to restore the user's chat state (existing conversations, active tab).
        // This function is called //automatically//, upon initialization of the IM engine.
        storage: function() {
            var chatstore = store.get(self.username + '-chats');

            if(this.chatstore) {
                $.each(this.chatstore, function(username, convo) {
                    if(username in chatstore)
                        chatstore[username] = $.merge(chatstore[username], self.chatstore[username]);
                    else
                        chatstore[username] = self.chatstore[username];
                });

                this.chatstore = chatstore;
                store.set(self.username + '-chats', chatstore);
            } else {
                this.chatstore = chatstore;
            }

            $.each(this.chatstore, function(username, convo) {
                if(!convo.length) return;

                var chatbox = self._createChatbox(username, true);
                chatbox.data('lastDateStamp', null).css('display', 'none');

                // Remove the automatic date stamp
                chatbox.find('.imjs-msglog').empty();

                // Restore all messages, date stamps, and errors
                $.each(convo, function() {
                    switch(this[0]) {
                        case 'error':
                            self._addError(chatbox, decodeURIComponent(this[2]), this[3]);
                        break;

                        case 'datestamp':
                            self._addDateStamp(chatbox, this[3]);
                        break;

                        case 'a':
                        case 'b':
                            self._addMessage(this[0], chatbox, this[1],
                                decodeURIComponent(this[2]), this[3]);
                        break;
                    }
                });

                $(self).trigger('chatRestored', [username, chatbox]);
            });

            var activeTab = store.get(self.username + '-activeTab');
            if(activeTab && activeTab in this.chats) {
                this.chats[activeTab].data('tab').click();
                var msglog = this.chats[activeTab].find('.imjs-msglog');
                msglog[0].scrollTop = msglog[0].scrollHeight;
            }
        },

        // === //private// {{{AjaxIM.}}}**{{{_session(friends)}}}** ===
        //
        // Restores session data (username, friends) and begins listening the server.
        // Called only by {{{AjaxIM.resume()}}}.
        //
        // ==== Parameters ====
        // * {{{friends}}} is a list of "friend" objects, e.g.:\\
        // {{{[{u: 'friend', s: 1, g: 'group'}, ...]}}}
        // ** {{{u}}} being the friend's username.
        // ** {{{s}}} being one of the available status codes (see {{{AjaxIM.statuses}}}), depending on the friend's current status.
        // ** {{{g}}} being the group that the friend is in.
        _session: function(friends) {
            $('#imjs-friends-panel .imjs-header span').html(this.username);
            $('#imjs-friends').removeClass('imjs-not-connected');

            $.each(friends, function(friend, info) {
                self.addFriend(friend, info.status, info.group);
            });
            self._storeFriends();

            $(self).trigger('sessionResumed', [this.username]);

            setTimeout(function() { self.listen(); }, 0);
        },

        // === //private// {{{AjaxIM.}}}**{{{_clearSession()}}}** ===
        //
        // Clears all session data from the last known user.
        _clearSession: function() {
            var last_user = store.get('user').name;
            if(last_user != self.username)
                store.clear();

            self.chats = {};
            $('.imjs-tab').not('.imjs-tab.imjs-default').remove();

            delete self.username;
        },

        // === {{{AjaxIM.}}}**{{{listen()}}}** ===
        //
        // Queries the server for new messages.
        listen: function() {
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
                    // try reconnecting?
                }
            );
        },

        // === //private// {{{AjaxIM.}}}**{{{_parseMessages(messages)}}}** ===
        //
        _parseMessage: function(message) {
            $(self).trigger('parseMessage', [message]);

            switch(message.type) {
                case 'hello':
                    // Friends!?
                    $('#imjs-friends').removeClass('imjs-not-connected');
                    $.each(message.friends, function() {
                        var friend;
                        if(this.length == 2)
                            friend = this;
                        else
                            friend = [this.toString(), 'offline'];
                        console.log(friend);
                        self.addFriend(friend[0], friend[1], 'Friends');
                    });
                break;

                case 'message':
                    self.incoming(message.user, message.body);
                break;

                case 'status':
                    self._friendUpdate(message.user, message.status,
                                       message.message);
                    self._storeFriends();
                break;

                case 'notice':
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
            var chatbox = this._createChatbox(from);

            if(!$('#imjs-bar .imjs-selected').length) {
                chatbox.data('tab').click();
            } else if(chatbox.data('tab').data('state') != 'active') {
                this.bar.notification(chatbox.data('tab'));
            }

            var msg_html = this._addMessage('b', chatbox, from, message);
            this._store(from, msg_html);
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
            var group_id = 'imjs-group-' + $.md5(group);

            if(!(group_item = $('#' + group_id)).length) {
                var group_item = $('.imjs-friend-group.imjs-default').clone()
                        .removeClass('imjs-default')
                        .attr('id', group_id)
                        .data('group', group)
                        .appendTo('#imjs-friends-list');

                var group_header = group_item.find('.imjs-friend-group-header');
                group_header.html(group_header.html().replace('{group}', group));
            }

            var user_id = 'imjs-friend-' + $.md5(username + group);

            if(!$('#' + user_id).length) {
                var user_item = group_item.find('ul li.imjs-default').clone()
                        .removeClass('imjs-default')
                        .addClass('imjs-' + status)
                        .attr('id', user_id)
                        .data('friend', username)
                        .appendTo(group_item.find('ul'));
                if(status[0] == 0) user_item.hide();
                user_item.html(user_item.html().replace('{username}', username));
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
            for(var f in this.friends) {
                if(this.friends[f].status[0] != 0)
                    friendsLength++;
            }
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
            var chatbox_id = 'imjs-' + $.md5(username);
            if(!(chatbox = $('#' + chatbox_id)).length) {
                // add a tab
                var tab = this.bar.addTab(username, '#' + chatbox_id);
                var chatbox = tab.find('.imjs-chatbox');

                chatbox.attr('id', chatbox_id);
                chatbox.data('tab', tab);

                // remove default items from the message log
                var message_log = chatbox.find('.imjs-msglog').empty();

                // setup the chatbox header
                var cb_header = chatbox.find('.imjs-header');
                cb_header.html(cb_header.html().replace('{username}', username));

                if(!no_stamp) {
                    // add a date stamp
                    var ds_html = this._addDateStamp(chatbox);
                    this._store(username, ds_html);
                }

                // associate the username with the object and vice-versa
                this.chats[username] = chatbox;
                chatbox.data('username', username);

                if(username in this.friends) {
                    status = this.friends[username].status;
                    tab.addClass('imjs-' + status);
                }

                setTimeout(this.bar._scrollers, 0);
            } else if(chatbox.data('tab').data('state') == 'closed') {
                chatbox.find('.imjs-msglog > *').addClass('imjs-msg-old');

                var tab = chatbox.data('tab');
                if(tab.css('display') == 'none')
                    tab.css('display', '').removeClass('imjs-selected')
                        .insertAfter('#imjs-scroll-left')
                        .data('state', 'minimized');

                if(!no_stamp) {
                    // possibly add a date stamp
                    var ds_html = this._addDateStamp(chatbox);
                    this._store(username, ds_html);
                }

                if(!$('#imjs-bar .imjs-selected').length) {
                    tab.click();
                } else {
                    this.bar.notification(tab);
                }

                setTimeout(this.bar._scrollers, 0);
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
                date_stamp_time.html(AjaxIM.dateFormat(time, date_stamp_time.html()));

            var date_stamp_date = date_stamp.find('.imjs-date-date');
            var formatted_date = AjaxIM.dateFormat(time, date_stamp_date.html());
            if(chatbox.data('lastDateStamp') != formatted_date) {
                if(date_stamp_date.length)
                    date_stamp_date.html(AjaxIM.dateFormat(time, date_stamp_date.html()));

                chatbox.data('lastDateStamp', formatted_date);
                date_stamp.appendTo(message_log);

                return jQuery('<div>').append(date_stamp.clone()).html();
            } else {
                //$('<div></div>').appendTo(message_log);
                return '';
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
                error_item_time.html(AjaxIM.dateFormat(time, error_item_time.html()));
            }

            error_item.find('.imjs-error-error').html(error);
            error_item.appendTo(message_log);

            message_log[0].scrollTop = message_log[0].scrollHeight;

            return jQuery('<div>').append(error_item.clone()).html();
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
                var message_container = (last_message.hasClass('imjs-msg-' + ab + '-container') ?
                    last_message :
                    last_message.find('.imjs-msg-' + ab + '-container'));

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
                time = AjaxIM.dateFormat(time, msgtime.html());

            msgtime.html(time);

            var msglog = chatbox.find('.imjs-msglog');
            msglog[0].scrollTop = msglog[0].scrollHeight;

            return jQuery('<div>').append(single_message.clone()).html();
        },

        _store: function(username, html) {
            if(!html.length) return;
            if(!this.chatstore) this.chatstore = {};

            if(!(username in this.chatstore)) {
                this.chatstore[username] = [];
            } else if(this.chatstore[username].length > 300) {
                // If the chat store gets too long, it becomes slow to load.
                this.chatstore[username].shift();
            }

            this.chatstore[username].push(html);

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
                var tab = this.chats[friend].data('tab');
                var tab_class = 'imjs-tab';
                if(tab.data('state') == 'active') tab_class += ' imjs-selected';
                tab_class += ' imjs-' + status;

                tab.attr('class', tab_class);

                // display the status in the chatbox
                var date_stamp =
                    $('.imjs-tab.imjs-default .imjs-chatbox .imjs-msglog .imjs-date').clone();

                var date_stamp_time = date_stamp.find('.imjs-msg-time');
                if(date_stamp_time.length)
                    date_stamp_time.html(AjaxIM.dateFormat(date_stamp_time.html()));

                var date_stamp_date = date_stamp.find('.imjs-date-date').html(
                    AjaxIM.l10n[
                        'chat' + status[0].toUpperCase() + status.slice(1)
                    ].replace(/%s/g, friend));

                var msglog = this.chats[friend].find('.imjs-msglog');
                date_stamp.appendTo(msglog);
                msglog[0].scrollTop = msglog[0].scrollHeight;
            }

            if(this.friends[friend]) {
                var friend_id = 'imjs-friend-' + $.md5(friend + this.friends[friend].group);
                $('#' + friend_id).attr('class', 'imjs-friend imjs-' + status);

                if(status == 0) {
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
            $('#imjs-friends').addClass('imjs-not-connected').unbind('click', this.activateTab);
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

            if(this.chats[username]) { // REMOVE ME?
                // possibly add a datestamp
                var ds_html = self._addDateStamp(this.chats[username]);
                this._store(username, ds_html);

                var msg_html = this._addMessage('a', this.chats[username], this.username, body);
                this._store(username, msg_html);
            }

            $(self).trigger('sendingMessage', [username, body]);

            AjaxIM.post(
                this.actions.send,
                {to: username, body: body},
                function(result) {
                    if(result.type == 'success' && result.success == 'sent') {
                        $(self).trigger('sendMessageSuccessful',
                                        [username, body]);
                    } else if(result.type == 'error') {
                        if(result.error == 'user offline')
                            $(self).trigger('sendMessageFailed',
                                            ['offline', username, body]);
                        else
                            $(self).trigger('sendMessageFailed',
                                            [result.error, username, body]);
                    }
                },
                function(error) {
                    self._notConnected();
                    var error_html = self._addError(
                                   self.chats[username],
                                   'You are currently not connected or the ' +
                                   'server is not available. Please ensure ' +
                                   'that you are signed in and try again.');
                    self._store(error_html);

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
        status: function(s, message) {
            // update status icon(s)
            if(!this.statuses[s])
                return;

            $('#imjs-friends').attr('class', 'imjs-' + s);

            $(self).trigger('changingStatus', [s, message]);

            AjaxIM.post(
                this.actions.status,
                {status: this.statuses[s], message: message},
                function(result) {
                    switch(result.r) {
                        case 'ok':
                            $(self).trigger('changeStatusSuccessful', [s, message]);
                        break;

                        case 'error':
                        default:
                            $(self).trigger('changeStatusFailed', [result.e, s, message]);
                        break;
                    }
                },
                function(error) {
                    $(self).trigger('changeStatusFailed', ['not connected', s, message]);
                }
            );
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

        // == Footer bar ==
        //
        // The footer bar is the bar that sits at the bottom of the page, in a fixed
        // position. It contains a tab for the friends list, and tabs for any open
        // chat boxes. It is also possible to add custom tabs for other functionality.
        bar: {
            // === {{{AjaxIM.}}}**{{{bar.initialize()}}}** ===
            //
            // Setup the footer bar and enable tab actions. This function
            // uses {{{jQuery.live}}} to set hooks on any bar tabs created
            // in the future.
            initialize: function() {
                // Set up your standard tab actions
                $('.imjs-tab')
                    .live('click', this.activateTab);

                $('.imjs-tab .imjs-close')
                    .live('click', this.closeTab);

                // Set up the friends list actions
                var self = this;
                $(document).click(function(e) {
                    if(e.target.id == 'imjs-friends' ||
                        $(e.target).parents('#imjs-friends').length) {
                        return;
                    }

                    if($('#imjs-friends').data('state') == 'active')
                        self.activateTab.call($('#imjs-friends'));
                });
                $('#imjs-friends')
                    .data('state', 'minimized')
                    .click(function(e) {
                        if(!$(this).hasClass('imjs-not-connected') &&
                            e.target.id != 'imjs-friends-panel' &&
                            !$(e.target).parents('#imjs-friends-panel').length)
                            self.activateTab.call(this);
                    })
                    .mouseenter(function() {
                        if($(this).hasClass('imjs-not-connected')) {
                            $('.imjs-tooltip').css('display', 'block');
                            $('.imjs-tooltip p').html(AjaxIM.l10n.notConnectedTip);

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
                $('#imjs-friends-panel')
                    .data('tab', $('#imjs-friends'))
                    .css('display', 'none');
            },

            // === {{{AjaxIM.}}}**{{{bar.activateTab()}}}** ===
            //
            // Activate a tab by setting it to the 'active' state and
            // showing any related chatbox. If a chatbox is available
            // for this tab, also focus the input box.
            //
            // //Note:// {{{this}}}, here, refers to the tab DOM element.
            activateTab: function() {
                var chatbox = $(this).find('.imjs-chatbox') || false;

                if($(this).data('state') != 'active') {
                    if($(this).attr('id') != 'imjs-friends') {
                        $('#imjs-bar > li')
                            .not($(this))
                            .not('#imjs-friends')
                            .removeClass('imjs-selected')
                            .each(function() {
                                if($(this).data('state') != 'closed') {
                                    $(this).data('state', 'minimized');
                                    var chatbox = $(this).find('.imjs-chatbox');
                                    if(chatbox.length)
                                        chatbox.css('display', 'none');
                                }
                            });
                    }

                    if(chatbox && chatbox.css('display') == 'none')
                        chatbox.css('display', '');

                    // set the tab to active...
                    var tab = $(this).addClass('imjs-selected').data('state', 'active');

                    // ...and hide and reset the notification icon
                    tab.find('.imjs-notification').css('display', 'none')
                        .data('count', 0);

                    if(chatbox && (username = chatbox.data('username')))
                        store.set(self.username + '-activeTab', username);

                    $(self).trigger('tabToggled', ['activated', tab]);
                } else {
                    var tab = $(this).removeClass('imjs-selected').data('state', 'minimized');

                    if(chatbox && chatbox.css('display') != 'none')
                        chatbox.css('display', 'none');

                    store.set(self.username + '-activeTab', '');

                    $(self).trigger('tabToggled', ['minimized', tab]);
                }

                if(chatbox) {
                    if(!(input = chatbox.find('.imjs-input')).data('height')) {
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

            // === {{{AjaxIM.}}}**{{{bar.closeTab()}}}** ===
            //
            // Close a tab and hide any related chatbox, such that
            // the chatbox can not be reopened without reinitializing
            // the tab.
            //
            // //Note:// {{{this}}}, here, refers to the tab DOM element.
            closeTab: function() {
                var tab = $(this).parents('.imjs-tab');
                tab.css('display', 'none').data('state', 'closed');

                delete self.chatstore[tab.find('.imjs-chatbox').data('username')];
                store.set(self.username + '-chats', self.chatstore);

                $(self).trigger('tabToggled', ['closed', tab]);

                self.bar._scrollers();

                return false;
            },

            // === {{{AjaxIM.}}}**{{{bar.addTab(label, action, closable)}}}** ===
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
                    .attr('id', 'imjs-tab-' + $.md5(label))
                    .html(tab.html().replace('{label}', label))
                    .data('state', 'minimized');

                var notification = tab.find('.imjs-notification');
                notification.css('display', 'none')
                    .data('count', 0)
                    .data('default-text', notification.html())
                    .html(notification.html().replace('{count}', '0'));

                if(closable === false)
                    tab.find('.imjs-close').eq(0).remove();

                if(typeof action == 'string') {
                    //tab.data('chatbox', action);
                } else {
                    tab.find('.imjs-chatbox').remove();
                    tab.click(action);
                }

                return tab;
            },

            // === {{{AjaxIM.}}}**{{{bar.notification(tab)}}}** ===
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

            // === //private// {{{AjaxIM.}}}**{{{bar._scrollers()}}}** ===
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

                while($('.imjs-selected').css('display') == 'none')
                    $('#imjs-scroll-right').click();

                self.bar._scrollerIndex();
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
        }
    })

    self.bar.initialize();
    self.bar._scrollers();

    self.listen();
    };

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
        if(typeof failureFunc != 'function');
            failureFunc = function(){};

        $.ajax({
            url: url,
            data: data,
            dataType: 'json',
            type: type,
            cache: false,
            timeout: 299000,
            //callback: 'jsonp' + (new Date()).getTime(),
            success: function(json, textStatus) {
                console.log(json);
                successFunc(json);
            },
            error: function(xhr, textStatus, error) {
                failureFunc(error);
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

    // === {{{AjaxIM.}}}**{{{loaded}}}** ===
    //
    // If Ajax IM has been loaded with the im.load.js file, this function will be
    // called when the library is finally loaded and ready for use. Similar to
    // jQuery's $(document).ready(), but for Ajax IM.
    AjaxIM.loaded = function() {
        if(typeof AjaxIMLoadedFunction == 'function') {
            AjaxIMLoadedFunction();
            delete AjaxIMLoadedFunction; // clean up the global namespace
        }
    };

    // === {{{AjaxIM.}}}**{{{dateFormat([date,] [mask,] utc)}}}** ===
    //
    // Date Format 1.2.3\\
    // &copy; 2007-2009 Steven Levithan ([[http://blog.stevenlevithan.com/archives/date-time-format|stevenlevithan.com]])\\
    // MIT license
    //
    // Includes enhancements by Scott Trenda
    // and Kris Kowal ([[http://cixar.com/~kris.kowal/|cixar.com/~kris.kowal/]])
    //
    // Accepts a date, a mask, or a date and a mask and returns a formatted version
    // of the given date.
    //
    // ==== Parameters ====
    // * {{{date}}} is a {{{Date()}}} object. If not specified, the date defaults to the
    // current date/time.
    // * {{{mask}}} is a string that defines the formatting of the date. Formatting
    // options can be found in the
    // [[http://blog.stevenlevithan.com/archives/date-time-format|Date Format]]
    // documentation. If not specified, the mask defaults to {{{dateFormat.masks.default}}}.

    AjaxIM.dateFormat = function () {
        var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
            timezone = new RegExp('\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) ' +
                                  '(?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b',
                                  'g'),
            timezoneClip = /[^-+\dA-Z]/g,
            pad = function (val, len) {
                val = String(val);
                len = len || 2;
                while (val.length < len) val = "0" + val;
                return val;
            };

        // Regexes and supporting functions are cached through closure
        return function (date, mask, utc) {
            var dF = AjaxIM.dateFormat;

            // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
            if (arguments.length == 1 && Object.prototype.toString.call(date) ==
                  "[object String]" && !/\d/.test(date)) {
                mask = date;
                date = undefined;
            }

            // Passing date through Date applies Date.parse, if necessary
            date = date ? new Date(date) : new Date;
            if (isNaN(date)) throw SyntaxError("invalid date");

            mask = String(dF.masks[mask] || mask || dF.masks["default"]);

            // Allow setting the utc argument via the mask
            if (mask.slice(0, 4) == "UTC:") {
                mask = mask.slice(4);
                utc = true;
            }

            var _ = utc ? "getUTC" : "get",
                d = date[_ + "Date"](),
                D = date[_ + "Day"](),
                m = date[_ + "Month"](),
                y = date[_ + "FullYear"](),
                H = date[_ + "Hours"](),
                M = date[_ + "Minutes"](),
                s = date[_ + "Seconds"](),
                L = date[_ + "Milliseconds"](),
                o = utc ? 0 : date.getTimezoneOffset(),
                flags = {
                    d:    d,
                    dd:   pad(d),
                    ddd:  AjaxIM.l10n.dayNames[D],
                    dddd: AjaxIM.l10n.dayNames[D + 7],
                    m:    m + 1,
                    mm:   pad(m + 1),
                    mmm:  AjaxIM.l10n.monthNames[m],
                    mmmm: AjaxIM.l10n.monthNames[m + 12],
                    yy:   String(y).slice(2),
                    yyyy: y,
                    h:    H % 12 || 12,
                    hh:   pad(H % 12 || 12),
                    H:    H,
                    HH:   pad(H),
                    M:    M,
                    MM:   pad(M),
                    s:    s,
                    ss:   pad(s),
                    l:    pad(L, 3),
                    L:    pad(L > 99 ? Math.round(L / 10) : L),
                    t:    H < 12 ? "a"  : "p",
                    tt:   H < 12 ? "am" : "pm",
                    T:    H < 12 ? "A"  : "P",
                    TT:   H < 12 ? "AM" : "PM",
                    Z:    utc ? "UTC" :
                            (String(date).match(timezone) || [""])
                            .pop().replace(timezoneClip, ""),
                    o:    (o > 0 ? "-" : "+") +
                            pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
                    S:    ["th", "st", "nd", "rd"][d % 10 > 3 ?
                            0 :
                            (d % 100 - d % 10 != 10) * d % 10]
                };

            return mask.replace(token, function ($0) {
                return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
            });
        };
    }();

    // Some common format strings
    AjaxIM.dateFormat.masks = {
        "default":      "ddd mmm dd yyyy HH:MM:ss",
        shortDate:      "m/d/yy",
        mediumDate:     "mmm d, yyyy",
        longDate:       "mmmm d, yyyy",
        fullDate:       "dddd, mmmm d, yyyy",
        shortTime:      "h:MM TT",
        mediumTime:     "h:MM:ss TT",
        longTime:       "h:MM:ss TT Z",
        isoDate:        "yyyy-mm-dd",
        isoTime:        "HH:MM:ss",
        isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
        isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
    };

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

        authInvalid: 'Invalid username or password.',

        registerPasswordLength: 'Passwords must be more than 4 characters in length.',
        registerUsernameLength: 'Usernames must be more than 2 characters in length and ' +
                        ' contain only A-Z, a-z, 0-9, underscores (_) and periods (.).',
        registerPasswordMatch: 'Entered passwords do not match.',
        registerUsernameTaken: 'The chosen username is already in use; please choose another.',
        registerUnknown: 'An unknown error occurred. Please try again.'
    }
//})(jQuery || $, false);