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

// == Node.js Server Library ==
//
// This is the [[http://nodejs.org|Node.js]] server library for Ajax IM. It
// handles registration and passing login to the Node.js server.
class NodeJS_IM extends IM {
    // === {{{NodeJS_IM::}}}**{{{__construct()}}}** ===
    //
    // Initializes the IM library and retrieves the user's session, if one
    // currently exists.
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
    
    // === {{{NodeJS_IM::}}}**{{{__destruct()}}}** ===
    //
    // Closes the connection to the Node.js server.
    function __destruct() {
        $this->memcache->close();
    }
    
    // === {{{NodeJS_IM::}}}**{{{login($username, $password)}}}** ===
    //
    // Authenticate a user against the database. If the user is valid,
    // pass the user's information to the Node.js server.
    //
    // ==== Parameters ====
    // * {{{$username}}} is the user's login name.\\
    // * {{{$password}}} is an already-md5'd copy of the user's password.
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
    
    // === {{{NodeJS_IM::}}}**{{{logout()}}}** ===
    //
    // Signs the user out of the Node.js server.
    public function logout() {
        $this->memcache->delete($this->username);
        
        return array('r' => 'logged out');
    }
    
    // === {{{NodeJS_IM::}}}**{{{register($username, $password)}}}** ===
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
    
    // === {{{NodeJS_IM::}}}**{{{add_friend($friend, $group)}}}** ===
    //
    // Add a new friend to the current user's friend list, in the specified
    // group name. Adds the friend to both the database and the current
    // Node.js server session.
    //
    // ==== Parameters ====
    // * {{{$friend}}} is the username of the friend.\\
    // * {{{$group}}} is the name of group in which to place the friend.
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