<?php
/*
 * Library: NodeJS
 * Author: Joshua Gross
 * Version: 0.1 alpha
 * Date: February 12, 2010
 *
 * Description:
 * A library for the Node.js server. It will authenticate a
 * user against the default database, and then add the user to
 * the server.
 *
 * Requirements: Database, Node.js
 */

class NodeJS_IM extends IM {
    function __construct() {
        parent::__construct();
        
        global $nodejs_memcache_server;
        
        if(!is_array($nodejs_memcache_server))
            die(json_encode(array('r' => 'error', 'e' => 'server misconfigured')));
        
        $this->memcache = memcache_connect($nodejs_memcache_server[0], $nodejs_memcache_server[1]);
        
        $cookie = json_decode($_COOKIE[COOKIE_NAME]);
        if($cookie) {
            $session = json_decode($this->memcache->get('session/' . $cookie->sid));
            if($session) {
                $this->username = $session->username;
                $this->user_id = $session->user_id;
                $this->server_key = $session->server_key;
            }
        }
    }
    
    function __destruct() {
        $this->memcache->close();
    }
    
    public function login($username, $password) {
        if($user = User::authenticate($username, $password)) {
            // user just logged in, update login time.
            $user->lastLogin(time());
            
            $session_id = md5(microtime(true) . $user->username);
            $session = array(
                'username' => $user->username,
                'user_id' => intval($user->user_id),
                'session_id' => $session_id,
                'friends' => Friend::of($user->user_id, true)
            );
            
            $cookie = json_encode(array(
                'user' => $user->username,
                'sid' => $session_id
            ));
            setcookie(COOKIE_NAME, $cookie, time()+(60*60*24*COOKIE_PERIOD), '/', COOKIE_DOMAIN);
            $this->memcache->add($user->username, json_encode($session));

            return array('r' => 'logged in', 's' => $session_id, 'f' => $session['friends']);
        } else {
            return array('r' => 'error', 'e' => 'invalid user');
        }
    }
    
    public function logout() {
        $this->memcache->delete($this->username);
        
        return array('r' => 'logged out');
    }
    
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
    
    public function add_friend($friend, $group) {
        if(!$this->username)
            return array('r' => 'error', 'e' => 'no session found');
        
        $friend = new Friend($this->username, $friend, $group);
        $friend_obj_id = $friend->save();

        if($friend_obj_id) {
            $friend_arr = Friend::get($friend_obj_id);
            $this->memcache->set('user/' . $this->username . '/friends/add', json_encode($friend_arr));
            
            return array('r' => 'added');
        } else {
            return array('r' => 'error', 'e' => 'invalid user');
        }
    }
}

/* End of libaries/server/NodeJS.php */