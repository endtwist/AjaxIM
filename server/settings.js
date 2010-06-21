// == Node.js Server Configuration ==
//
// This is the configuration file for the Node.js Ajax IM server. Here, you
// can set which ports will be used for the public and internal servers,
// as well as other settings such as the session cookie name and expiration.

// === {{{ host and port }}} ===
//
// Define the host and port that Ajax IM will run on.
APP_HOST = 'localhost';
APP_PORT = 8000;

// === API Key ===
//
// This is the **private** API key that is used for any REST calls to the
// server. Please change this key to something long and random. You should
// never use this key on the client side!
API_KEY = 'FG34tbNW$n5aw4E6Y&U&6inBFDs';

// === Authentication Library ===
//
// This is the library (from libs/authenticate/) that we will use to
// authenticate a user signing in. The value should be the name of the file
// without the '.js' part. 'index' is the default library.
AUTH_LIBRARY = 'index';