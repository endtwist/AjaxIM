<?php
/*
 * Library: NodeJS (Guests)
 * Author: Joshua Gross
 * Version: 0.1 alpha
 * Date: February 12, 2010
 *
 * Description:
 * A library for the Node.js server. It does not require any
 * sort of database installation, and will automatically create
 * "Guest" users, making it possible to automatically sign on
 * individuals without any sort of registration.
 *
 * Requirements: Node.js
 */

// == Node.js Guest Server Library ==
//
// This is the [[http://nodejs.org|Node.js]] Guest server library for Ajax IM. It
// creates a random "Guest" username upon login and passes that information to
// the Node.js server. Additionally, it makes every user a friend of every other
// user.
class NodeJS_Guests_IM extends IM {
    // === {{{NodeJS_Guests_IM::}}}**{{{__construct()}}}** ===
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
            }
        }
    }

    // === {{{NodeJS_Guests_IM::}}}**{{{__destruct()}}}** ===
    //
    // Closes the connection to the Node.js server.
    function __destruct() {
        $this->memcache->close();
    }

    // === {{{NodeJS_IM::}}}**{{{login($username, $password)}}}** ===
    //
    // Create a new Guest username based in the microtime, then
    // pass the user's information to the Node.js server.
    //
    // ==== Parameters ====
    // * {{{$username}}} is unused (kept for compatability with caller).\\
    // * {{{$password}}} is unused (kept for compatability with caller).
    public function login($username='', $password='') {
        $username = 'Guest' . (microtime(true) * 100);
        $session_id = md5(microtime(true) . $username);

        $friends_raw = json_decode($this->memcache->get('list/'));
        $friends = array();
        foreach($friends_raw as $friend) {
            $friends[] = array(
                'u' => $friend->username,
                's' => $friend->status,
                'g' => 'Users'
            );
        }

        $session = array(
            'username' => $username,
            'user_id' => $username,
            'session_id' => $session_id,
            'friends' => $friends,
            'guest' => true
        );

        $cookie = json_encode(array(
            'user' => $username,
            'sid' => $session_id
        ));
        setcookie(COOKIE_NAME, $cookie, time()+(60*60*24*COOKIE_PERIOD), '/', COOKIE_DOMAIN);
        $this->memcache->add($username, json_encode($session));
        $this->memcache->set('from/' . $username . '/broadcast/raw', json_encode(array(
            't' => 's',
            's' => $username,
            'r' => 'all',
            'm' => '1:',
            'g' => 'Users'
        )));

        return array(
            'r' => 'logged in',
            'u' => $username,
            's' => $session_id,
            'f' => $session['friends']
        );
    }

    // === {{{NodeJS_IM::}}}**{{{logout()}}}** ===
    //
    // Signs the user out of the Node.js server.
    public function logout() {
        $this->memcache->delete($this->username);

        return array('r' => 'logged out');
    }
}

/* End of libraries/server/NodeJS.php */