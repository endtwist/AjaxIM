<?php
/*
 * Library: Default
 * Author: Joshua Gross
 * Version: 0.1 alpha
 * Date: December 21, 2009
 *
 * Description:
 * The default PHP-only server library. This library allows
 * you to use Ajax IM on a shared server, without installing
 * any extra software.
 *
 * Requirements: Database
 */

class Default_IM extends IM {
    const FIXBUFFER = 1024; // Works around an output buffering issue in IE & Safari
    const FIXEOL = '<br/>'; // Works around an end-of-line issue in Safari

    function __construct() {
        parent::__construct();
        
        session_start();
        if($_SESSION['username']) {
            $this->username = $_SESSION['username'];
            $this->user_id = $_SESSION['user_id'];
        }
    }
    
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
    
    public function logout() {
        session_destroy();
        $_SESSION = array();
        
        return array('r' => 'logged out');
    }
    
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
    
    public function register($username, $password) {
        if(preg_match('/^[A-Za-z0-9_.]{3,16}$/', $username)) {
            if(strlen($password) > 3) {
                // hash the password
                $password = md5($password);
                $pw_str = substr($password, 0, 8);
                $password = $pw_str . md5($pw_str . $password);
                
                $register_sql = "INSERT INTO " . MYSQL_PREFIX . "users
                    (username, password, last_known_ip)
                    VALUES(:username, :password, :ip)";
                $db = MySQL_Database::instance();
                $register = $db->prepare($register_sql);
                $is_registered = $register->execute(array(
                    ':username' => $username,
                    ':password' => $password,
                    ':ip' => ip2long($_SERVER['REMOTE_ADDR'])
                ));
                
                if($is_registered) {
                    print json_encode(array('r' => 'registered'));
                } else {
                    print json_encode(array('r' => 'error', 'e' => 'unknown'));
                }
            } else {
                print json_encode(array('r' => 'error', 'e' => 'invalid password'));
            }
        } else {
            print json_encode(array('r' => 'error', 'e' => 'invalid username'));
        }
    }
    
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
    
    private function _shortPoll() {
        $messages = Message::getMany('to', $this->user_id);
        
        if($messages) {
            return $this->_pollParseMessages($messages);
        } else {
            return array('r' => 'no messages');
        }
    }
    
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
    
    private function _pollParseMessages($messages) {
        $msg_arr = array();
        foreach($messages as $msg) {
            $msg_arr[] = array('t' => $msg->type, 's' => $msg->from, 'r' => $msg->to, 'm' => $msg->message);
        }
        return $msg_arr;
    }
    
    private function _sanitize($str) {
        return str_replace('>', '&gt;', str_replace('<', '&lt;', str_replace('&', '&amp;', $str)));
    }
}

/* End of libraries/server/Default.php */