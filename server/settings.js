// == Server Configuration ==
//
// This is the configuration file for the Node.js Ajax IM server. Here, you
// can set which ports will be used for the public and internal servers,
// as well as other settings such as the session cookie name and expiration.

// === Host and Port ===
//
// Define the host and port that Ajax IM will run on.
APP_HOST = 'localhost';
APP_PORT = 8000;

// === Authentication Library ===
//
// This is the library (from libs/authenticate/) that we will use to
// authenticate a user signing in. The value should be the name of the file
// without the '.js' part. 'index' is the default library.
AUTH_LIBRARY = 'default';

// === Daemon ===
//
// Define where the PID and log files will be deposited when run as a daemon.
PID_FILE = '/tmp/ajaxim.pid';
LOG_FILE = '/var/run/ajaxim.log';