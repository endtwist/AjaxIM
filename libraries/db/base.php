<?php
class BaseDatabase {
    private static $_instance = false;

    public static function instance() {
        if(self::$_instance === false) {
            // create instance
            self::$_instance = true;
        }
        
        return self::$_instance;
    }
}

class BaseUser {
    static $db = null;
    
    function __construct($username, $password, $user_id, $ip, $last_login) {
    }
    
    public static function authenticate($username, $password) {
    }
    
    public static function get($user) {
    }
    
    public static function find($username) {
    }
    
    public function status($s=null, $message=null) {
    }
    
    public function ip($ip=null) {
    }
    
    public function lastLogin($ll=null) {
    }
    
    public function save($id=null) {
    }
}

class BaseStatus {
    const Offline = 0;
    const Available = 1;
    const Away = 2;
    const Invisible = 3;
    
    static $db = null;
    
    function __construct($user_id, $s=null, $message='') {
    }
    
    public static function of($user) {
    }
    
    public function is($s, $message='') {
    }
}

class BaseMessage {
    static $db = null;

    function __construct($from='', $to='', $message='', $type='') {
    }
    
    public static function send($from, $to, $message) {
    }
    
    public static function get($id) {
    }
    
    public static function getMany($from_or_to, $user) {
    }
    
    public function sent($ts=null) {
    }
    
    public function from($from=null) {
    }
    
    public function to($to=null) {
    }
    
    public function message($message=null) {
    }
    
    public function save($id=null) {
    }
}

class BaseFriend {
    static $db = null;
    
    function __construct($user=null, $friend=null, $group=null) {
    }
    
    public static function get($id) {
    }
    
    public static function find($friend, $user=0) {
    }
    
    public function group($group=null) {
    }
    
    public function save() {
    }
    
    public function remove() {
    }
}

class BaseFriendGroup {
    static $db = null;
    
    function __construct($user, $group) {
    }
    
    public static function get($id) {
    }
    
    public static function find($group) {
    }
    
    public function addFriend($friend) {
    }
    
    public function friends() {
    }
    
    public function save() {
    }
    
    public function remove() {
    }
}

/* End of libraries/db/base.php */