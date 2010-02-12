// == Node.js Server Configuration ==
//
// This is the configuration file for the Node.js Ajax IM server. Here, you
// can set which ports will be used for the public and internal servers,
// as well as other settings such as the session cookie name and expiration.

// === {{{ ports }}} ===
//
// Define the ports and hosts that Ajax IM will run on. {{{public}}} is the
// public-facing API, while {{{private}}} is the memcache-compatible API
// intended for server-side use.
//
// The first item of each array is the port, the second is the host name. If
// you do not want to specify a host, set it to {{{null}}}.
exports.ports = {
    public: [8000, 'localhost'],
    private: [11998, 'localhost']
};

// === {{{ cookie }}} ===
//
// Define the cookie name and how long a session will be stored on the server.
// If you change the cookie name here, you will also need to change it in the
// PHP login script/configuration; if you fail to do this, the Node.js server
// will be looking for a cookie that does not exist.
//
// **Note:** The period for the session should be as long or longer than the
// cookie itself is set to be stored. If it is less, the user won't be logged
// back in automatically, as their cookie will have been deleted.
exports.cookie = {
    name: 'ajaxim_session',
    period: 8760
};