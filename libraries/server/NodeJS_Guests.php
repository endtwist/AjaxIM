<?php
/*
 * Library: NodeJS (Guests)
 * Author: Joshua Gross
 * Version: 0.1 alpha
 * Date: December 21, 2009
 *
 * Description:
 * A library for the Node.js server. It does not require any
 * sort of database installation, and will automatically create
 * "Guest" users, making it possible to automatically sign on
 * individuals without any sort of registration.
 *
 * Requirements: Node.js
 */

class NodeJS_Guests_IM extends IM {
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

    function __destruct() {
        $this->memcache->close();
    }

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

    public function logout() {
        $this->memcache->delete($this->username);

        return array('r' => 'logged out');
    }
}

/* End of libraries/server/NodeJS.php */