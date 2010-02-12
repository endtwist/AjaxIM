<?php
/*
 * Library: MySQL
 * Author: Joshua Gross
 * Version: 0.1 alpha
 * Date: January 16, 2010
 *
 * Description:
 * The default MySQL server backend.
 *
 * Requirements: MySQL 5.0+
 */

class MySQL_Database extends BaseDatabase {
    private static $_instance = false;

    public static function instance() {
        if(self::$_instance === false) {
            // create instance
            self::$_instance = new PDO('mysql:dbname=' . MYSQL_DATABASE . ';host=' . MYSQL_HOSTNAME, MYSQL_USERNAME, MYSQL_PASSWORD);
        }
        
        return self::$_instance;
    }
}

class MySQL_User extends BaseUser {
    function __construct($username, $password, $user_id, $ip='', $last_login=0) {
        parent::__construct($username, $password, $user_id, $ip, $last_login);
        
        self::$db = MySQL_Database::instance();
        
        $this->username = $username;
        $this->password = $password;
        $this->user_id = $user_id;
        $this->ip = $ip;
        $this->last_login = $last_login;
    }
    
    public static function authenticate($username, $password) {
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
        $username = preg_replace('/([%_])/', '\\\\\1', $username);
    
        $auth_sql = "SELECT * FROM " . MYSQL_PREFIX . "users
            WHERE username LIKE :username LIMIT 1";
        $auth = self::$db->prepare($auth_sql);
        $auth->execute(array(':username' => $username));

        if($auth->rowCount()) {
            $user = $auth->fetch(PDO::FETCH_OBJ);
            
            // hash given password using actual password hash, then test against real password
            $pw_hash = substr($user->password, 0, 8);
            
            if($user->password == $pw_hash . md5($pw_hash . $password)) {
                $user_obj = new MySQL_User($user->username, $user->password, $user->user_id,
                    $user->last_known_ip, $user->last_login);
                
                return $user_obj;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }
    
    public static function get($user) {
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
    }
    
    public static function find($username) {
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
        $username = preg_replace('/([%_])/', '\\\\\1', $username);
    
        $find_sql = "SELECT * FROM " . MYSQL_PREFIX . "users
            WHERE username LIKE :username LIMIT 1";
        $find = self::$db->prepare($find_sql);
        $find->execute(array(':username' => $username));
        
        $user = $find->fetch(PDO::FETCH_OBJ);
        return new User($user->username, $user->password, $user->user_id, $user->last_known_ip, $user->last_login);
    }
    
    public function status($s=null, $message=null) {
        if(!$this->status) {
            $this->status = MySQL_Status::of($this->user_id);
        }
        
        if($s) {            
            return $this->status->is($s, $message);
        } else {
            return $this->status;
        }
    }
    
    public function ip($ip=null) {
        if($ip) {
            $this->ip = $ip;
            
            if($this->user_id && $this->autosave) {
                $updateip_sql = "UPDATE " . MYSQL_PREFIX . "users SET last_known_ip=:ip WHERE user_id=:id";
                $updateip = self::$db->prepare($updateip_sql);
                $updateip->execute(array(
                    ':ip' => $ip,
                    ':id' => $this->user_id
                ));
            }
            
            return $this;
        } else {
            if($this->ip) {
                return $this->ip;
            } else if($this->user_id) {
                $getip_sql = "SELECT last_known_ip FROM " . MYSQL_PREFIX . "users WHERE user_id=:id";
                $getip = self::$db->prepare($getip_sql);
                $getip->execute(array(':id' => $this->user_id));
                
                $user_obj = $getip->fetch(PDO::FETCH_OBJ);
                $this->ip = $user_obj->last_known_ip;
                return $this->ip;
            }
            
            return false;
        }
    }
    
    public function lastLogin($ll=null) {
        if($ll) {
            $this->last_login = $ll;
            
            if($this->user_id && $this->autosave) {
                $updatell_sql = "UPDATE " . MYSQL_PREFIX . "users SET last_login=FROM_UNIXTIME(:ll) WHERE user_id=:id";
                $updatell = self::$db->prepare($updatell_sql);
                $updatell->execute(array(
                    ':ll' => $ll,
                    ':id' => $this->user_id
                ));
            }
            
            return $this;
        } else {
            if($this->last_login) {
                return $this->last_login;
            } else if($this->user_id) {
                $getll_sql = "SELECT last_login FROM " . MYSQL_PREFIX . "users WHERE user_id=:id";
                $getll = self::$db->prepare($getll_sql);
                $getll->execute(array(':id' => $this->user_id));
                
                $user_obj = $getll->fetch(PDO::FETCH_OBJ);
                $this->last_login = strtotime($user_obj->last_login);
                return $this->last_login;
            }
            
            return false;
        }
    }
    
    public function save($id=null) {
    }
}

class MySQL_Status extends BaseStatus {
    const Offline = 0;
    const Available = 1;
    const Away = 2;
    const Invisible = 3;
    
    public $s = null;
    public $message = '';
    public $user_id = 0;
    
    function __construct($user_id, $s=null, $message='') {
        self::$db = MySQL_Database::instance();
        
        $this->s = $s;
        $this->message = $message;
        $this->user_id = $user_id;
    }
    
    public static function of($user) {
        $status_sql = "SELECT s, message, s.user_id FROM " . MYSQL_PREFIX . "status as s ";
        if(is_int($user)) {
            $status_sql .= "WHERE user_id = :user";
        } else {
            $status_sql .= "LEFT JOIN " . MYSQL_PREFIX . "users as u ON u.user_id=s.user_id WHERE u.username = :user";
        }
        $status_sql .= " LIMIT 1";
        
        $prep = self::$db->prepare($sql);
        $prep->execute(array(':user' => $user));        
        $status = $prep->fetch(PDO::FETCH_OBJ);
        
        return new Status($status->s, $status->message, $status->user_id);
    }

    public function is($s, $message='') {
        $status_sql = "INSERT INTO " . MYSQL_PREFIX . "status (user_id, message, status) VALUES(:user_id, :message, :s)
            ON DUPLICATE KEY UPDATE 
            status = :s, message = :message";
        $prep = self::$db->prepare($status_sql);
        
        $this->s = $s;
        $this->message = $message;

        $changed_status = $prep->execute(array(
            ':s' => $s,
            ':message' => $message,
            ':user_id' => $this->user_id
        ));
        
        if($changed_status) {        
            // broadcast status update to friends
            $update_friends_sql = "INSERT INTO " . MYSQL_PREFIX . "messages (from_id, to_id, message, type)
                SELECT :user_id AS from_id, friend_id as to_id, :status as message, 's' as type FROM " . MYSQL_PREFIX . "friends as friends
                LEFT JOIN " . MYSQL_PREFIX . "status as status ON friends.friend_id = status.user_id WHERE friends.user_id = :user_id AND status.status > 0";
            $update_friends = self::$db->prepare($update_friends_sql);
            
            $update_friends->execute(array(
                ':user_id' => $this->user_id,
                ':status' => $s . ':' . $message
            ));
        }
        
        return $changed_status;
    }
}

class MySQL_Message extends BaseMessage {
    function __construct($from=0, $to=0, $message='', $type='m') {
        self::$db = MySQL_Database::instance();
        
        $this->id = 0;
        $this->from = $from;
        $this->to = $to;
        $this->message = $message;
        $this->type = $type;
        $this->sent = 0;
        
        // Automatically flush changes if id is set?
        $this->autosave = true;
    }
    
    public static function send($from=0, $to=0, $message='') {
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
        if(isset($this) && $this->from && !$from) {
            $from = $this->from;
            $to = $this->to;
            $message = $this->message;
        }
                
        $send_sql = "INSERT INTO " . MYSQL_PREFIX . "messages (from_id, to_id, type, message)
            VALUES(:from, :to, 'm', :message)";
        $prep_send = self::$db->prepare($send_sql);
        
        return $prep_send->execute(array(
            ':from' => $from,
            ':to' => $to,
            ':message' => $message
        ));
    }
    
    public static function get($id) {
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
        $get_sql = "SELECT * FROM " . MYSQL_PREFIX . "messages WHERE message_id=:id LIMIT 1";
        $get_message = self::$db->prepare($get_sql);
        $get_message->execute(array(':id' => intval($id)));
        
        if($get_message->rowCount()) {
            $msg_obj = $get_message->fetch(PDO::FETCH_OBJ);
            
            $message = new Message($msg_obj->from, $msg_obj->to, $msg_obj->message, $msg_obj->type);
            $message->id = $msg_obj->message_id;
            
            return $message;
        } else {
            return false;
        }
    }
    
    public static function getMany($from_or_to, $user) {
        if(!self::$db)
            self::$db = MySQL_Database::instance();

        $get_sql = "SELECT message_id, u1.username as `from`, u2.username as `to`, message, `type`, sent FROM " . MYSQL_PREFIX . "messages as m
                    LEFT JOIN ajaxim_users as u1 ON m.to_id = u1.user_id
                    LEFT JOIN ajaxim_users as u2 ON m.from_id = u2.user_id WHERE ";
        if(is_numeric($user)) {
            $get_sql .= ($from_or_to == 'from' ? 'from' : 'to') . "_id = :user";
        } else {
            $get_sql .= "u" . ($from_or_to == 'from' ? '2' : '1') . ".username = :user";
        }
        $get_sql .= " AND `read` = 0 ORDER BY sent ASC";

        $get_messages = self::$db->prepare($get_sql);
        $get_messages->execute(array(':user' => $user));
        
        if($get_messages->rowCount()) {
            $messages = array(); $message_ids = array();
            while($msg_obj = $get_messages->fetch(PDO::FETCH_OBJ)) {
                $messages[] = new Message($msg_obj->from, $msg_obj->to, $msg_obj->message, $msg_obj->type);
                $idx = count($messages) - 1;
                $messages[$idx]->sent = strtotime($msg_obj->sent);
                $messages[$idx]->id = $msg_obj->message_id;
                
                $message_ids[] = $msg_obj->message_id;
            }
            
            $mark_read_sql = "UPDATE " . MYSQL_PREFIX . "messages SET `read` = 1 WHERE message_id IN(" . join(',', $message_ids) . ")";
            $mark_read = self::$db->prepare($mark_read_sql);
            $mark_read->execute();
            
            return $messages;
        } else {
            return false;
        }
    }
    
    public function sent($ts=null) {
        if($ts) {
            $this->sent = $ts;
            
            if($this->id && $this->autosave) {            
                $updatets_sql = "UPDATE " . MYSQL_PREFIX . "messages SET sent=FROM_UNIXTIME(:ts) WHERE message_id=:id";
                $updatets = self::$db->prepare($updatets_sql);
                
                $updatets->execute(array(
                    ':ts' => $ts,
                    ':id' => $this->id
                ));
            }

            return $this;
        } else {
            if($this->sent) {
                return $this->sent;
            } else if($this->id) {
                $getts_sql = "SELECT sent FROM " . MYSQL_PREFIX . "messages WHERE message_id=:id LIMIT 1";
                $getts = self::$db->prepare($getts_sql);
                $getts->execute(array(':id' => $this->id));
                
                if($getts->rowCount()) {
                    $msg_obj = $getts->fetch(PDO::FETCH_OBJ);
                    $this->sent = strtotime($msg_obj->sent);
                    return $this->sent;
                } else {
                    return false;
                }
            }
            
            return false;
        }
    }
    
    public function from($from=null) {
        // check if from is int, string, or User object
        if($from) {
            $this->from = $from;
            
            if($this->id && $this->autosave) {
                $updatefrom_sql = "UPDATE " . MYSQL_PREFIX . "messages SET from=:from WHERE message_id=:id";
                $updatefrom = self::$db->prepare($updatefrom_sql);
                
                $updatefrom->execute(array(
                    ':from' => $from,
                    ':id' => $this->id
                ));
            }
            
            return $this;
        } else {
            if($this->from) {
                return $this->from;
            } else if($this->id) {
                $getfrom_sql = "SELECT from FROM " . MYSQL_PREFIX . "messages WHERE message_id=:id LIMIT 1";
                $getfrom = self::$db->prepare($getfrom_sql);
                $getfrom->execute(array(':id' => $this->id));
                
                if($getfrom->rowCount()) {
                    $msg_obj = $getfrom->fetch(PDO::FETCH_OBJ);
                    $this->from = $msg_obj->from;
                    return $this->from;
                } else {
                    return false;
                }
            }
            
            return false;
        }
    }
    
    public function to($to=null) {
        // check if to is int, string, or User object
        if($to) {
            $this->to = $to;
            
            if($this->id && $this->autosave) {
                $updateto_sql = "UPDATE " . MYSQL_PREFIX . "messages SET to=:to WHERE message_id=:id";
                $updateto = self::$db->prepare($updateto_sql);
                
                $updateto->execute(array(
                    ':to' => $to,
                    ':id' => $this->id
                ));
            }
            
            return $this;
        } else {
            if($this->to) {
                return $this->to;
            } else if($this->id) {
                $getto_sql = "SELECT to FROM " . MYSQL_PREFIX . "messages WHERE message_id=:id LIMIT 1";
                $getto = self::$db->prepare($getto_sql);
                $getto->execute(array(':id' => $this->id));
                
                if($getto->rowCount()) {
                    $msg_obj = $getto->fetch(PDO::FETCH_OBJ);
                    $this->to = $msg_obj->to;
                    return $this->to;
                } else {
                    return false;
                }
            }
            
            return false;
        }
    }
    
    public function message($message=null) {
        if($message) {
            $this->message = $message;
            
            if($this->id && $this->autosave) {
                $updatemsg_sql = "UPDATE " . MYSQL_PREFIX . "messages SET message=:message WHERE message_id=:id";
                $updatemsg = self::$db->prepare($updatemsg_sql);
                
                $updatemsg->execute(array(
                    ':message' => $message,
                    ':id' => $this->id
                ));
            }
            
            return $this;
        } else {
            if($this->message) {
                return $this->message;
            } else if($this->id) {
                $getmsg_sql = "SELECT message FROM " . MYSQL_PREFIX . "messages WHERE message_id=:id LIMIT 1";
                $getmsg = self::$db->prepare($getmsg_sql);
                $getmsg->execute(array(':id' => $this->id));
                
                if($getmsg->rowCount()) {
                    $msg_obj = $getmsg->fetch(PDO::FETCH_OBJ);
                    $this->message = $msg_obj->message;
                    return $this->message;
                } else {
                    return false;
                }
            }
            
            return false;
        }
    }
    
    public function save($id=null) {
        if(!$this->id && !$id)
            return false;
        else if($this->id)
            $id = $this->id;
    
        if($id) {
            $savemsg_sql = "UPDATE " . MYSQL_PREFIX . "messages SET from_id=:from, to_id=:to, type=:type, message=:message, sent=:sent WHERE message_id=:id";
            $savemsg = self::$db->prepare($savemsg_sql);
            
            $state = $savemsg->execute(array(
                ':from' => $this->from,
                ':to' => $this->to,
                ':type' => $this->type,
                ':message' => $this->message,
                ':sent' => $this->sent,
                ':id' => $this->id
            ));
            
            if($state) {
                return $id;
            } else {
                return false;
            }
        } else {
            $savemsg_sql = "INSERT INTO " . MYSQL_PREFIX . "messages (from_id, to_id, type, message, sent) VALUES (:from, :to, :type, :message, :sent)
                ON DUPLICATE KEY UPDATE message_id=LAST_INSERT_ID(message_id), from_id=:from, to_id=:to, type=:type, message=:message, sent=:sent";
            $savemsg = self::$db->prepare($savemsg_sql);
            
            $state = $savemsg->execute(array(
                ':from' => $this->from,
                ':to' => $this->to,
                ':type' => $this->type,
                ':message' => $this->message,
                ':sent' => $this->sent
            ));
            
            if($state) {
                $this->id = self::$db->lastInsertId();
                return $this->id;
            } else {
                return false;
            }
        }
    }
}

class MySQL_Friend extends BaseFriend {
    static $db = null;
    
    function __construct($user=null, $friend=null, $group=null) {
        self::$db = MySQL_Database::instance();
    
        $this->id = 0;
        $this->user = $user;
        $this->friend = $friend;
        $this->group = $group;
        
        // Automatically flush changes if id is set?
        $this->autosave = true;
    }
    
    public static function of($user=0, $offline=false) {
        if(!$user && (isset($this) && !$this->user))
            return array();
            
        if(isset($this) && $this->user && !$user)
            $user = $this->user;

        if(!self::$db)
            self::$db = MySQL_Database::instance();
        
        $friends_of_sql = "SELECT users.username as u, status.status as s, groups.name as g FROM " . MYSQL_PREFIX . "friends as friends
            LEFT JOIN " . MYSQL_PREFIX . "users as users ON friends.friend_id = users.user_id
            LEFT JOIN " . MYSQL_PREFIX . "status as status ON users.user_id = status.user_id
            LEFT JOIN " . MYSQL_PREFIX . "groups as groups ON friends.group_id = groups.group_id
            WHERE friends.user_id = :user" . ($offline ? "" : " AND status.status != 0");

        $friends_of = self::$db->prepare($friends_of_sql);
        
        $friends_of->execute(array('user' => $user));
        
        if($friends_of->rowCount()) {
            return $friends_of->fetchAll(PDO::FETCH_ASSOC);
        } else {
            return array();
        }
    }
    
    public static function get($id) {
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
        $friend_get_sql = "SELECT users.username as u, status.status as s, groups.name as g FROM " . MYSQL_PREFIX . "friends as friends
            LEFT JOIN " . MYSQL_PREFIX . "users as users ON friends.friend_id = users.user_id
            LEFT JOIN " . MYSQL_PREFIX . "status as status ON users.user_id = status.user_id
            LEFT JOIN " . MYSQL_PREFIX . "groups as groups ON friends.group_id = groups.group_id
            WHERE friends.id = :id LIMIT 1";
        $friend_get = self::$db->prepare($friend_get_sql);

        $friend_get->execute(array('id' => $id));
        
        if($friend_get->rowCount()) {
            return $friend_get->fetch(PDO::FETCH_ASSOC);
        } else {
            return array('u' => false, 's' => 0, 'g' => false);
        }
    }

    public static function find($friend, $user=0) {
        if(!$user && (isset($this) && !$this->user))
            return false;
    
        if(!self::$db)
            self::$db = MySQL_Database::instance();
            
        if($this->user && !$user)
            $user = $this->user;
        
        $friend_find_sql = "SELECT users.username as u, status.status as s, groups.name as g FROM " . MYSQL_PREFIX . "friends as friends
            LEFT JOIN " . MYSQL_PREFIX . "users as users ON friends.friend_id = users.user_id
            LEFT JOIN " . MYSQL_PREFIX . "status as status ON users.user_id = status.user_id
            LEFT JOIN " . MYSQL_PREFIX . "groups as groups ON friends.group_id = groups.group_id ";
            
        if(is_int($friend))
            $friend_find_sql .= "WHERE friends.friend_id = :friend";
        else
            $friend_find_sql .= "WHERE users.username = :friend";
            
        $friend_find_sql .= " AND friends.user_id = :user LIMIT 1";
        
        $friend_find = self::$db->prepare($friend_find_sql);
        
        $friend_find->execute(array(
            'friend' => $friend,
            'user' => $user
        ));
        
        if($friend_find->rowCount()) {
            return $friend_find->fetch(PDO::FETCH_ASSOC);
        } else {
            return false;
        }
    }

    public function group($group=null) {
        if($group) {
            $this->group = $group;
            
            if($this->id && $this->autosave) {
                if(!is_int($this->group)) {
                    $group_id_sql = "INSERT INTO " . MYSQL_PREFIX . "groups (name) VALUES (:group)
                        ON DUPLICATE KEY UPDATE group_id=LAST_INSERT_ID(group_id)";
                    $group_id = self::$db->prepare($group_id_sql);
                    $group_id->execute(array(':group' => $group));
                    if(!$group_id) {
                        return false;
                    } else {
                        $group_id = self::$db->lastInsertId();
                        $this->group = $group_id;
                    }
                }
                
                $updategroup_sql = "UPDATE " . MYSQL_PREFIX . "friends SET group_id=:group_id WHERE id=:id";
                $updategroup = self::$db->prepare($updatemsg_sql);
                
                $updategroup->execute(array(
                    ':group_id' => $this->group,
                    ':id' => $this->id
                ));
            }
            
            return $this;
        } else {
            if($this->group) {
                return $this->group;
            } else if($this->id) {
                $getgroup_sql = "SELECT group FROM " . MYSQL_PREFIX . "friends WHERE id=:id LIMIT 1";
                $getgroup = self::$db->prepare($getmsg_sql);
                $getgroup->execute(array(':id' => $this->id));
                
                if($getgroup->rowCount()) {
                    $group_obj = $getmsg->fetch(PDO::FETCH_OBJ);
                    $this->group = $group_obj->group;
                    return $this->group;
                } else {
                    return false;
                }
            }
            
            return false;
        }
    }
    
    public function save($id=null) {
        $as = $this->autosave;
        $this->autosave = false;
        
        if($this->id)
            $id = $this->id;
        
        if(!is_int($this->group)) {
            $group_id_sql = "INSERT INTO " . MYSQL_PREFIX . "groups (name) VALUES (:group)
                ON DUPLICATE KEY UPDATE group_id=LAST_INSERT_ID(group_id)";
            $group_id = self::$db->prepare($group_id_sql);
            $group_id->execute(array(':group' => $this->group));
            if(!$group_id) {
                return false;
            } else {
                $group_id = self::$db->lastInsertId();
                $this->group = $group_id;
            }
        }
        
        if(!is_int($this->user)) {
            $user = MySQL_User::find($this->user);
            if($user) {
                $this->user = $user->user_id;
            } else {
                return false;
            }
        }
        
        if(!is_int($this->friend)) {
            $friend = MySQL_User::find($this->friend);
            if($friend) {
                $this->friend = $user->user_id;
            } else {
                return false;
            }
        }
        
        if($id) {
            $savefriend_sql = "UPDATE " . MYSQL_PREFIX . "friends SET user_id=:user, friend_id=:friend, group_id=:group WHERE id=:id";
            $savefriend = self::$db->prepare($savefriend_sql);
            
            $state = $savefriend->execute(array(
                ':user' => $this->user,
                ':friend' => $this->friend,
                ':group' => $this->group
            ));
            
            if($state) {
                return $id;
            } else {
                return false;
            }
        } else {
            $savefriend_sql = "INSERT INTO " . MYSQL_PREFIX . "friends (user_id, friend_id, group_id) VALUES (:user, :friend, :group)
                ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), user_id=:user, friend_id=:friend, group_id=:group";
            $savefriend = self::$db->prepare($savefriend_sql);
            
            $state = $savefriend->execute(array(
                ':user' => $this->user,
                ':friend' => $this->friend,
                ':group' => $this->group
            ));
            
            if($state) {
                $this->id = self::$db->lastInsertId();
                return $this->id;
            } else {
                return false;
            }
        }
    }
    
    public function remove() {
    }
}

/* SQL:
CREATE TABLE `ajaxim_friends` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `friend_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ;

CREATE TABLE `ajaxim_groups` (
  `group_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ;

CREATE TABLE `ajaxim_messages` (
  `message_id` int(11) NOT NULL AUTO_INCREMENT,
  `from_id` int(11) NOT NULL,
  `to_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(2) NOT NULL,
  `sent` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ;

CREATE TABLE `ajaxim_status` (
  `status_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `status` int(11) NOT NULL,
  `message` text NOT NULL,
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ;

CREATE TABLE `ajaxim_users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(32) NOT NULL,
  `password` varchar(40) NOT NULL,
  `last_known_ip` int(11) NOT NULL,
  `last_login` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ;
*/

/* End of libraries/db/MySQL.php */