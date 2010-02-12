<?php
// = ajaxim.php =
//
// **Copyright &copy; 2005 &ndash; 2010 Joshua Gross**\\
// //MIT Licensed//
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

require_once('config.php');
require_once('libraries/db/base.php');
require_once('libraries/server/base.php');

# import the database library
require_once('libraries/db/' . DB_ENGINE . '.php');
$db_class = DB_ENGINE . '_Database';

if (!function_exists('class_alias')) {
    // Allows us to alias Database library classes to standardized names
    function class_alias($original, $alias) {
        eval('class ' . $alias . ' extends ' . $original . ' {}');
    }
}

class_alias(DB_ENGINE . '_Database', 'Database');
class_alias(DB_ENGINE . '_User', 'User');
class_alias(DB_ENGINE . '_Status', 'Status');
class_alias(DB_ENGINE . '_Message', 'Message');
class_alias(DB_ENGINE . '_Friend', 'Friend');

// Fix problems with magic_quotes_gpc/sybase
if(function_exists('get_magic_quotes_gpc') && get_magic_quotes_gpc()) {
    $syb = strtolower(ini_get('magic_quotes_sybase'));
    if(empty($syb) || $syb == 'off') {
        foreach($_POST as $key => $val) $_POST[$key] = stripslashes($val);
        foreach($_GET as $key => $val) $_GET[$key] = stripslashes($val);
        foreach($_COOKIE as $key => $val) $_COOKIE[$key] = stripslashes($val);
    } else {
        foreach($_POST as $key => $val) $_POST[$key] = str_replace("''", "'", $val);
        foreach($_GET as $key => $val) $_GET[$key] = str_replace("''", "'", $val);
        foreach($_COOKIE as $key => $val) $_COOKIE[$key] = str_replace("''", "'", $val);            
    }
}

// import the server library
require_once('libraries/server/' . IM_LIBRARY . '.php');
$im_class = IM_LIBRARY . '_IM';
$im = new $im_class();
$action = preg_replace('/^' . preg_quote($_SERVER['SCRIPT_NAME'], '/') . '\/(.+?)(\?.+)?$/', '\1', $_SERVER['REQUEST_URI']);

if(substr($action, 0, 1) != '_' && method_exists($im, $action))
    if($action == 'poll') {
        if($_GET['method'] == 'comet') {
            $im->poll('comet');
        } else {
            print $_GET['callback'] . '(' . json_encode($im->poll($_GET['method'])) . ')';
        }
    } else {
        $execute = call_user_func_array(array($im, $action), $_POST);
        if($execute)
            print json_encode($execute !== false ? $execute : array('e'=>'wrong args'));
    }
else
    print json_encode(array('e'=>'no method'));

/* End of ajaxim.php */