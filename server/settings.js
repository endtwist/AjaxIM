// == Server Configuration ==
//
// This is the configuration file for the Node.js Ajax IM server. Here, you
// can set which ports will be used for the public and internal servers,
// as well as other settings such as the session cookie name and expiration.

// === Host and Port ===
//
// Define the host and port that Ajax IM will run on.
//
// Note: Setting APP_HOST to null will run the server on port 8000 for any
// hostname!
APP_HOST = 'localhost';
APP_PORT = 8000;

// Document me!
AUTH_LIBRARY = 'example';
SESSION_STORE = 'memory';
MESSAGE_HANDLER = 'default';

// Document me!
SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// === Daemon ===
//
// Define where the PID and log files will be deposited when run as a daemon.
/*
// Broken! Removed for the time being.
PID_FILE = '/tmp/ajaxim.pid';
LOG_FILE = '/var/run/ajaxim.log';
*/