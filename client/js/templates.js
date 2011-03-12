var Template = {
    bar:
        '<ul id="imjs-bar">' +
            '<li id="imjs-friends" class="imjs-not-connected">' +
            '<span class="imjs-tab-text"><strong>&bull;</strong> Friends <span>(<span>0</span>)</span></span>' +
                '<div id="imjs-friends-panel" class="imjs-chatbox">' +
                    '<div class="imjs-header">' +
                        '<span>{username}</span>' +
                        '<a href="#" class="imjs-minimize">_</a>' +
                    '</div>' +
                    '<div id="imjs-status-panel">' +
                        '<textarea id="imjs-away-message-text"></textarea>' +
                        '<div id="imjs-away-message-text-arrow"></div>' +
                        '<a href="#" id="imjs-button-available" class="imjs-button"><span>&bull;</span> Available</a>' +
                        '<a href="#" id="imjs-button-away" class="imjs-button"><span>&bull;</span> Away</a>' +
                        '<a href="#" id="imjs-button-offline" class="imjs-button"><span>&bull;</span> Offline</a>' +
                    '</div>' +
                    '<ul id="imjs-friends-list">' +
                    '</ul>' +
                    '<form>' +
                        '<p><input type="text" id="imjs-search-friends" value="Search" /></p>' +
                    '</form>' +
                '</div>' +
            '</li>' +
            '<li id="imjs-reconnect"><span class="imjs-tab-text">&#8635;</span></li>' +
            '<li id="imjs-scroll-left" class="imjs-scroll">{count}</li>' +
        '</ul>',
     tab:
        '<li class="imjs-tab">' +
            '<span class="imjs-tab-text"><strong>&bull;</strong> {label} <a href="#" class="imjs-close">x</a></span>' +
            '<span class="imjs-notification">{count}</span>' +
            '<form class="imjs-chatbox">' +
                '<div>' +
                    '<div class="imjs-header">' +
                        '<span>{username}</span>' +
                        '<a href="#" class="imjs-close">x</a>' +
                        '<a href="#" class="imjs-minimize">_</a>' +
                    '</div>' +
                    '<ul class="imjs-msglog"></ul>' +
                    '<textarea class="imjs-input"></textarea>' +
                '</div>' +
            '</form>' +
        '</li>',
    datestamp:
        '<li class="imjs-date">' +
            '<ul>' +
                '<li>' +
                    '<span class="imjs-msg-time">hh:MM TT &bull;</span>' +
                    '<p class="imjs-date-date">ddd, mmmm d, yyyy</p>' +
                '</li>' +
            '</ul>' +
        '</li>',
    message_error:
        '<li class="imjs-error">' +
            '<ul>' +
                '<li>' +
                    '<span class="imjs-msg-time">hh:MM TT &bull;</span>' +
                    '<p class="imjs-error-error">ddd, mmmm d, yyyy</p>' +
                '</li>' +
            '</ul>' +
        '</li>',
    message_you_outer:
        '<li class="imjs-msg-you">' +
            '<span>{username}</span>' +
            '<ul class="imjs-msg-you-container"></ul>' +
        '</li>',
    message_you:
        '<li class="imjs-msg-you-msg">' +
            '<span class="imjs-msg-time">hh:MM TT &bull;</span>' +
            '<p>{message}</p>' +
        '</li>',
    message_them_outer:
        '<li class="imjs-msg-them">' +
            '<span>{username}</span>' +
            '<ul class="imjs-msg-them-container"></ul>' +
        '</li>',
    message_them:
        '<li class="imjs-msg-them-msg">' +
            '<span class="imjs-msg-time">hh:MM TT &bull;</span>' +
            '<p>{message}</p>' +
        '</li>',
    group:
        '<li class="imjs-friend-group">' +
            '<span class="imjs-friend-group-header">{group}</span>' +
            '<ul></ul>' +
        '</li>',
    friend:
        '<li class="imjs-friend"><strong>&bull;</strong><span>{username}</span><span class="imjs-friend-status">{status}</span></li>',
    tooltip:
        '<span class="imjs-tooltip"><p>{tip}</p></span>'
};
