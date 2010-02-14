<?php
/*
 * Library: Default
 * Author: Joshua Gross
 * Version: 0.1 alpha
 * Date: February 12, 2010
 *
 * Description:
 * The default PHP-only server library. This library allows
 * you to use Ajax IM on a shared server, without installing
 * any extra software.
 *
 * Requirements: Database
 */

// == Default Server Library ==
//
// This is the default PHP-only server library. This library allows you
// to use Ajax IM on a shared server, without installing any extra software.
class Default_IM extends IM {
    const FIXBUFFER = 1024; // Works around an output buffering issue in IE & Safari
    const FIXEOL = '<br/>'; // Works around an end-of-line issue in Safari

    // === {{{Default_IM::}}}**{{{__construct()}}}** ===
    //
    // Initializes the IM library and retrieves the user's session, if one
    // currently exists.
    function __construct() {
        parent::__construct();
        
        session_start();
        if($_SESSION['username']) {
            $this->username = $_SESSION['username'];
            $this->user_id = $_SESSION['user_id'];
        }
    }
    
    // === {{{Default_IM::}}}**{{{login($username, $password)}}}** ===
    //
    // Authenticate a user against the database. If the user is valid,
    // log them in.
    //
    // ==== Parameters ====
    // * {{{$username}}} is the user's login name.\\
    // * {{{$password}}} is an already-md5'd copy of the user's password.
    public function login($username, $password) {
        if($user = User::authenticate($username, $password)) {
            // user just logged in, update login time.
            $user->lastLogin(time());
            
            $_SESSION['username'] = $user->username;
            $_SESSION['user_id'] = intval($user->user_id);
            
            $online = Friend::of($user->user_id);
            
            return array('r' => 'logged in', 's' => session_id(), 'f' => $online);
        } else {
            return array('r' => 'error', 'e' => 'invalid user');
        }
    }
    
    // === {{{Default_IM::}}}**{{{logout()}}}** ===
    //
    // Signs the user out.
    public function logout() {
        session_destroy();
        $_SESSION = array();
        
        return array('r' => 'logged out');
    }
    
    // === {{{Default_IM::}}}**{{{send($to, $message)}}}** ===
    //
    // Send a message to another user by adding the message to the
    // database.
    //
    // ==== Parameters ====
    // * {{{$to}}} is the username of the recipient.\\
    // * {{{$message}}} is the content.
    public function send($to, $message) {
        if(!$this->username)
            return array('r' => 'error', 'e' => 'no session found');
            
        $message = $this->_sanitize($message);
        
        $to = User::find($to);
        if(!$to)
            return array('r' => 'error', 'e' => 'no_recipient');

        if(Message::send($this->user_id, $to->user_id, $message)) {
            return array('r' => 'sent');
        } else {
            return array('r' => 'error', 'e' => 'send error');
        }
    }
    
    // === {{{Default_IM::}}}**{{{status($status, $message)}}}** ===
    //
    // Sets the status of the current user, including any associated
    // status message.
    public function status($status, $message) {
        if(!$this->username)
            return array('r' => 'error', 'e' => 'no session found');
            
        $status = intval($status);
        $message = $this->_sanitize($message);
        
        $statuses = array(Status::Offline, Status::Available, Status::Away, Status::Invisible);
        if(!in_array($status, $statuses))
            $status = Status::Available;

        $user_status = new Status($this->user_id);
        if($user_status->is($s, $message)) {
            return array('r' => 'status set');
            
            // now, notify all friends
            
        } else {
            return array('r' => 'error', 'e' => 'status error');
        }
    }
    
    // === {{{Default_IM::}}}**{{{register($username, $password)}}}** ===
    //
    // Create a new user based on the provided username and password.
    //
    // ==== Parameters ====
    // * {{{$username}}} is the new user's login name.\\
    // * {{{$password}}} is the user's plaintext password.
    public function register($username, $password) {
        if(preg_match('/^[A-Za-z0-9_.]{3,16}$/', $username)) {
            if(strlen($password) > 3) {
                $db = MySQL_Database::instance();
                $test_username_sql = "SELECT COUNT(user_id) FROM " . MYSQL_PREFIX . "users
                    WHERE username LIKE :username";
                $test_username = $db->prepare($test_username_sql);
                $test_username->execute(array(':username' => $username));
                if(!$test_username->fetchColumn()) {
                    // hash the password
                    $password = md5($password);
                    $pw_str = substr($password, 0, 8);
                    $password = $pw_str . md5($pw_str . $password);
                    
                    $register_sql = "INSERT INTO " . MYSQL_PREFIX . "users
                        (username, password, last_known_ip)
                        VALUES(:username, :password, :ip)";
                    $register = $db->prepare($register_sql);
                    $is_registered = $register->execute(array(
                        ':username' => $username,
                        ':password' => $password,
                        ':ip' => ip2long($_SERVER['REMOTE_ADDR'])
                    ));
                    
                    if($is_registered) {
                        return array('r' => 'registered');
                    } else {
                        return array('r' => 'error', 'e' => 'unknown');
                    }
                } else {
                    return array('r' => 'error', 'e' => 'username taken');
                }
            } else {
                return array('r' => 'error', 'e' => 'invalid password');
            }
        } else {
            return array('r' => 'error', 'e' => 'invalid username');
        }
    }
    
    // === {{{Default_IM::}}}**{{{poll($method)}}}** ===
    //
    // Query the database for any new messages, and respond (or wait)
    // using the specified method (short, long, or comet).
    //
    // ==== Parameters ====
    // * {{{$method}}} is the type of response method to use as a reply.
    // See {{{im.js}}} for a description of each method.
    public function poll($method) {
        if(!$this->username)
            return array('r' => 'error', 'e' => 'no session found');

        session_write_close(); // prevents locking
        
        // If output buffering hasn't been setup yet...
        if(count(ob_list_handlers()) < 2) {
            // Buffer output, but flush always after any output
            ob_start();
            ob_implicit_flush(true);
            
            // Set the headers such that our response doesn't get cached
            header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
            header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
            header('Cache-Control: no-store, no-cache, must-revalidate');
            header('Cache-Control: post-check=0, pre-check=0', false);
            header('Pragma: no-cache');
        }
        
        switch($method) {
            case 'long':
                return $this->_longPoll();
            break;
            
            case 'comet':
                return $this->_comet();
            break;
            
            default:
            case 'short':
                return $this->_shortPoll();
            break;
        }
    }
    
    // === //private// {{{Default_IM::}}}**{{{_longPoll()}}}** ===
    //
    // Use the long polling technique to check for and deliver new messages.
    private function _longPoll() {
        set_time_limit(30);
        
        // We're going to keep a running tally of the number of times
        // we've checked for, but haven't received, messages. As that
        // number increases, the sleep duration will increase.
        
        $no_msg_count = 0;
        $start = time();
        do {
            $messages = Message::getMany('to', $this->user_id);

            if(!$messages) {
                $no_msg_count++;
                sleep(2.5 + min($no_msg_count * 1.5, 7.5));
            }
        } while(!$messages && time() - $start < 30);

        if($messages)
            return $this->_pollParseMessages($messages);
        else
            return array();
    }
    
    // === //private// {{{Default_IM::}}}**{{{_shortPoll()}}}** ===
    //
    // Use the short polling technique to check for and deliver new messages.
    private function _shortPoll() {
        $messages = Message::getMany('to', $this->user_id);
        
        if($messages) {
            return $this->_pollParseMessages($messages);
        } else {
            return array('r' => 'no messages');
        }
    }
    
    // === //private// {{{Default_IM::}}}**{{{_comet()}}}** ===
    //
    // Use the comet/streaming technique to check for and deliver new messages.
    private function _comet() {
        set_time_limit(0);
    
        // First, fix buffers
        echo str_repeat(chr(32), self::FIXBUFFER) . self::FIXEOL , ob_get_clean();

        $no_msg_count = 0;
        while(true) {                
            $messages = Message::getMany('to', $this->user_id);

            if(!$messages) {
                $no_msg_count++;
                sleep(2.5 + min($no_msg_count * 1.5, 7.5));
                echo chr(32) , ob_get_clean();
                if(connection_aborted()) return;
            } else {
                $no_msg_count = 0;
                echo '<script type="text/javascript">parent.AjaxIM.incoming(' .
                    json_encode($this->_pollParseMessages($messages)) .
                ');</script>' . self::FIXEOL , ob_get_clean();
                sleep(1);
            }
        }
    }
    
    // === //private// {{{Default_IM::}}}**{{{_pollParseMessages()}}}** ===
    //
    // Parse each message object and return it as an array deliverable to the client.
    //
    // ==== Parameters ====
    // * {{{$messages}}} is the array of message objects.
    private function _pollParseMessages($messages) {
        $msg_arr = array();
        foreach($messages as $msg) {
            $msg_arr[] = array('t' => $msg->type, 's' => $msg->from, 'r' => $msg->to, 'm' => $msg->message);
        }
        return $msg_arr;
    }
    
    // === //private// {{{Default_IM::}}}**{{{_sanitize()}}}** ===
    //
    // Sanitize messages by preventing any HTML tags from being created
    // (replaces &lt; and &gt; entities).
    private function _sanitize($str) {
        return str_replace('>', '&gt;', str_replace('<', '&lt;', str_replace('&', '&amp;', $str)));
    }
}

/* End of libraries/server/Default.php */