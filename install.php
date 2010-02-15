<!DOCTYPE html>
<html>
    <head>
        <title>Ajax IM &mdash; Instant Messaging Framework</title>
        <script type="text/javascript" src="js/jquery-1.3.2.js"></script>
        <style type="text/css">
            html, body {
                margin: 0;
                padding: 0;
            }
            
            body {
                background: #fff;
                font: 62.5% Helvetica Neue, Helvetica, Arial, Tahoma, sans-serif;
            }
            
            input, button, select {
                font: 1.25em/1.25em Helvetica Neue, Helvetica, Arial, Tahoma, sans-serif;
            }
            
            input:focus {
                outline: none;
            }
            
            code {
                font-size: 1.1em;
                font-family: Consolas, Inconsolata, Courier New, Courier, monospace;
            }
            
            /* [begin] Upper */
            div.upper {
                display: block;
                width: 100%;
                padding: 1em 0;
                margin: 0 0 2em;
                background: #444;
                color: #fff;
            }
            /* [end] Upper */
            
            /* [begin] Header */
            div#header {
                display: block;
                margin: 0 0 0 6.67em;
                font-size: 1.5em;
                line-height: 1em;
                overflow: hidden;
            }
            
                div#header a {
                    font-weight: 700;
                    color: #444;
                }
                
            h1 {
                text-indent: -10000px;
                /*background: url(http://ajaxim.com/images/logo.png?install);*/
                background: url(site/demo/images/logo.png);
                width: 146px;
                height: 44px;
                margin: 0 0.5em 0 0;
                padding: 0;
                float: left;
            }
            
            h2 {
                margin: 0;
                font-size: 1.2em;
                line-height: 41px;
            }
            /* [end] Header */
            
            /* [begin] Install form */
            form {
                font-size: 1.5em;
                margin-left: 6.67em;
            }
            
                form fieldset {
                    position: relative;
                    border: 0;
                    font-size: 1em;
                    padding: 0 0 0.5em;
                    margin: 0 0 2em;
                    background: #eee;
                    width: 600px;
                }
                
                    form fieldset legend {
                        background: #eee;
                        padding: 0.6em 1em 1em;
                        font-weight: 700;
                    }
                    
                    form fieldset p {
                        margin: 0;
                        padding: 0 1em 1.25em 1em;
                    }
                    
                        form fieldset p label {
                            display: block;
                            font-weight: 700;
                        }
                        
                        form fieldset p span:first-child {
                            font-weight: 700;
                        }
                        
                        form fieldset p span.desc {
                            display: block;
                            font-weight: 200;
                            font-size: 0.8em;
                            margin-bottom: 0.25em;
                        }
                        
                        input#install_db + label {
                            display: inline;
                        }
                        

                form fieldset ul li {
                    margin: 1em 0 0;
                }
                                        
                        form fieldset ul li p {
                            padding: 0;
                        }
                        
                        form fieldset ul li pre {
                            border-left: 2px solid #dedede;
                            padding-left: 1em;
                            margin-left: -1em;
                            width: 540px;
                        }
                        
                fieldset#mysql-config, fieldset#nodejs-config, p#please-install-db {
                    display: none;
                }
    
                form h3 {
                    font-size: 2em;
                    margin: 0 0 0.5em;
                }
                
                p#install {
                    text-align: right;
                    width: 600px;
                    margin: 0 0 3em;
                }
                
                    p#install input {
                        font-size: 2em;
                    }
            /* [end] Install form */
            
            /* [begin] Footer */
            p#footer {
                font-size: 1.2em;
                color: #666;
                margin-left: 8.307em;
            }
            
                p#footer a {
                    color: #777;
                }
                
                p#footer a:visited {
                    color: #666;
                }
            /* [end] Footer */
        </style>
        <script type="text/javascript">
            $(function() {
                $('#server, #db').click();
                
                $('#cookie_length, #session_length').change(function() {
                    if(parseFloat($('#session_length').val()) < parseFloat($('#cookie_length').val())) {
                        $('#session_length').val($('#cookie_length').val());
                    }
                }).keypress();
            });
        </script>
    </head>
    
    <body>
        <div class="upper">
            <div id="header">
                <h1>Ajax IM</h1>
                <h2>instant messaging framework</h2>
            </div>
        </div>
<?php
// file_array() by Jamon Holmgren. Exclude files by putting them in the $exclude
// string separated by pipes. Returns an array with filenames as strings.
function file_array($path, $exclude = ".|..", $recursive = false) {
    $path = rtrim($path, "/") . "/";
    $folder_handle = opendir($path);
    $exclude_array = explode("|", $exclude);
    $result = array();
    while(false !== ($filename = readdir($folder_handle))) {
        if(!in_array(strtolower($filename), $exclude_array)) {
            if(is_dir($path . $filename . "/")) {
                if($recursive) $result[] = file_array($path, $exclude, true);
            } else {
                $result[] = $filename;
            }
        }
    }
    return $result;
}

function library_array($path, $exclude, $recursive = false) {
    $files = file_array($path, $exclude, $recursive);
    $libs = array();
    foreach($files as $f) {       
        $library_src = preg_replace('/[\n\r]+/', "\n", file_get_contents(rtrim($path, "/") . "/" . $f));
        preg_match('/^<' . '\?php[^\/]*\/\*(.+?)\*\//sm', $library_src, $library_header);
                    
        $header_data = array(
            'Library' => $f,
            'Author' => 'Unknown',
            'Version' => '1.0',
            'Date' => '',
            'Description' => '',
            'Requirements' => array()
        );
        
        if(strlen($library_header[1])) {
            $header_keys = array('Library', 'Author', 'Version', 'Date', 'Description', 'Requirements');
            $header_lines = explode("\n", $library_header[1]);
            
            $last_key = false;
            foreach($header_lines as $ln) {
                $ln_kv = explode(':', substr($ln, 3), 2);
                $key = ucwords(strtolower($ln_kv[0]));
                if(in_array($key, $header_keys)) {
                    $header_data[$ln_kv[0]] = trim($ln_kv[1]);
                    $last_key = $key;
                } else if($last_key && strlen(trim($ln)) > 0) {
                    $header_data[$last_key] .= substr($ln, 3) . ' ';
                }
            }
            
            if(strlen($header_data['Requirements'])) {
                $reqs = explode(',', $header_data['Requirements']);
                foreach($reqs as &$req) $req = trim($req);
                $header_data['Requirements'] = $reqs;
            }
        }
        
        $libs[$f] = $header_data;
    }
    
    return $libs;
}

function get_available_servers() {
    return library_array('./libraries/server', '.|..|base.php');
}

function get_available_db_engines() {
    return library_array('./libraries/db', '.|..|base.php');
}

if($_SERVER['REQUEST_METHOD'] == 'POST') {
    $configphp = file_get_contents('config.php');
    
    // Replace the server type
    $configphp = preg_replace("/define\('(IM_LIBRARY)', '[^']+?'\);/", "define('$1', '" . str_replace('.php', '', $_POST['server']) . "');", $configphp);
    
    // Replace the database type
    $configphp = preg_replace("/define\('(DB_ENGINE)', '[^']+?'\);/", "define('$1', '" . str_replace('.php', '', $_POST['db']) . "');", $configphp);
    
    // Replace the cookie name
    $configphp = preg_replace("/define\('(COOKIE_NAME)', '[^']+?'\);/", "define('$1', '" . $_POST['cookie'] . "');", $configphp);
    
    // Replace the cookie storage length
    $configphp = preg_replace("/define\('(COOKIE_PERIOD)', [^)]+?\);/", "define('$1', '" . $_POST['cookie_length'] . "');", $configphp);
    
    // Replace the MySQL information
    $configphp = preg_replace("/define\('(MYSQL_DATABASE)', '[^']+?'\);/", "define('$1', '" . $_POST['mysqldb'] . "');", $configphp);
    $configphp = preg_replace("/define\('(MYSQL_HOSTNAME)', '[^']+?'\);/", "define('$1', '" . $_POST['mysqlhost'] . "');", $configphp);
    $configphp = preg_replace("/define\('(MYSQL_USERNAME)', '[^']+?'\);/", "define('$1', '" . $_POST['mysqluser'] . "');", $configphp);
    $configphp = preg_replace("/define\('(MYSQL_PASSWORD)', '[^']+?'\);/", "define('$1', '" . $_POST['mysqlpass'] . "');", $configphp);
    $configphp = preg_replace("/define\('(MYSQL_PREFIX)', '[^']+?'\);/", "define('$1', '" . $_POST['mysqlprefix'] . "');", $configphp);

    if(intval($_POST['needs_nodejs']) == 1) {
        $configjs = preg_replace("/[\r\n]+/", "\n", file_get_contents('server/config.js'));
        
        // Replace the cookie name
        $configjs = preg_replace("/(name: )'[^']+?',/", "$1'" . $_POST['cookie'] . "',", $configjs);

        // Replace the session period
        $configjs = preg_replace("/(period: )\d{1,6}/", "period: " . round(floatval($_POST['session_length']) * 24), $configjs);
                
        // Replace the host and port numbers
        $public_host = strlen(trim($_POST['public_host'])) ? "'" . trim($_POST['public_host']) . "'" : "null";
        $private_host = strlen(trim($_POST['private_host'])) ? "'" . trim($_POST['private_host']) . "'" : "null";
        $configjs = preg_replace("/(public: )\[8000, 'localhost'\],/", "$1[" . $_POST['public_port'] . ", " . $public_host . "],", $configjs);
        $configjs = preg_replace("/(private: )\[11998, 'localhost'\]/", "$1[" . $_POST['private_port'] . ", " . $private_host . "],", $configjs);
        
        $cjs = fopen('server/config.js', 'w');
        fwrite($cjs, $configjs);
        fclose($cjs);
        
        $configphp = preg_replace('/(\$nodejs_memcache_server = array)\(\'[^\']+\', [^)]+\);/', "$1('" . ($private_host == 'null' ? 'localhost' : $_POST['private_host']) . "', " . $_POST['private_port'] . ");", $configphp);
        
        if(!strlen(trim($_POST['public_host']))) {
            $url = parse_url($_POST['url']);
            $_POST['public_host'] = $url['host'];
        }
        
        $node_url = $_POST['public_host'] . ":" . $_POST['public_port'];
            
        $imloadjs = file_get_contents('js/im.load.js');
        $imloadjs = preg_replace("/(var nodehost = )'';/", "$1'" . $node_url . "';", $imloadjs);
        $imljs = fopen('js/im.load.js', 'w');
        fwrite($imljs, $imloadjs);
        fclose($imljs);
    }
        
    $cphp = fopen('config.php', 'w');
    fwrite($cphp, $configphp);
    fclose($cphp);
    
    if(isset($_POST['install_db'])) {
        // Get DB src from file, run against database
        $db_library_src = preg_replace("/[\r\n]+/", "\n", file_get_contents('libraries/db/MySQL.php'));
        preg_match('/\/\*\s+SQL:(.+?)\*\//sm', $db_library_src, $db_sql);
        $db_sql = explode(';', str_replace("\n", '', $db_sql[1]));
        
        $sql = new PDO('mysql:dbname=' . $_POST['mysqldb'] . ';host=' . $_POST['mysqlhost'], $_POST['mysqluser'], $_POST['mysqlpass']);
        foreach($db_sql as $statement) {
            $sql->exec(str_replace('ajaxim_', $_POST['mysqlprefix'], $statement));
        }
    }
?>
        <form method="post">
            <h3>Installation</h3>
            
            <fieldset>
                <legend>Installation has completed successfully!</legend>
                <ul>
                    <li>For security purposes, please delete <code>install.php</code>.</li>
                
                    <?php if(!$_POST['need_nodejs'] == 1) { ?>
                    <li>The Node.js server host has been added to <code>js/im.load.js</code>; please confirm that the URL generated is correct.</li>
                    <li>
                        <p>To get the standalone Node.js server running, you will need to run the following command on the command line of your server:</p>
                        <pre>node server/server.js</pre>
                        
                        <p>However, it is recommended that you move the <code>server</code> folder outside of the main installation directory before going live.</p>
                    </li>
                    <li>
                        <p>Now that Ajax IM is installed, please see the <a href="http://ajaxim.com/documentation/basics/quick-start-nodejs/">Quick Start with Node.js</a> guide to complete set up.</p>
                    </li>
                    <?php } else { ?>
                    <li>Since you did <strong>not</strong> setup Ajax IM with the Node.js server, it is recommended that you delete the <code>server</code> folder (containing the files <code>config.js</code> and <code>server.js</code>).</li>
                    <li>
                        <p>Now that Ajax IM is installed, please see the <a href="http://ajaxim.com/documentation/basics/quick-start/">Quick Start</a> guide to complete set up.</p>
                    </li>
                    <?php } ?>
                </ul>
            </fieldset>
        </form>
<?php
} else {
?>
        <form method="post">
            <h3>Installation</h3>

            <p>For assistance, please see the <a href="http://ajaxim.com/installation/">installation tutorial</a>.</p>
            
            <fieldset>
                <legend>Basic Configuration</legend>
                
                <p>
                    <span>Is <code>config.php</code> writable?</span>
                    <?php if(is_writable('config.php')): ?>
                    <span class="writable">Yes.</span>
                    <?php else: ?>
                    <span class="problem"><strong>No.</strong> Please change the permissions of <code>config.php</code> to "writable" or 755 (on Unix-based systems) before continuing!</span>
                    <?php endif; ?>
                </p>
                
                <p>
                    <span>Is <code>js/im.load.js</code> writable?</span>
                    <?php if(is_writable('js/im.load.js')): ?>
                    <span class="writable">Yes.</span>
                    <?php else: ?>
                    <span class="problem"><strong>No.</strong> Please change the permissions of <code>js/im.load.js</code> to "writable" or 755 (on Unix-based systems) before continuing!</span>
                    <?php endif; ?>
                </p>
                
                <p>
                    <label for="url">What is the URL of the installation?</label>
                    <input type="text" size="50" name="url" id="url" value="<?php print ($_SERVER['HTTPS'] ? 'https' : 'http') . '://' . $_SERVER['SERVER_NAME'] . str_replace('install.php', '', $_SERVER['REQUEST_URI']); ?>">
                </p>
                
                <p>
                    <label for="server">Please select a server type.</label>
                    <select name="server" id="server">
                    <?php $servers = get_available_servers();
                          foreach($servers as $file => $server):
                    ?>
                        <option value="<?php print $file; ?>"><?php print $server['Library'] . ' &mdash; ' . $server['Version']; ?> (by <?php print $server['Author']; ?>)</option>
                   
                    <?php endforeach; ?>
                    </select>
                    <input type="hidden" name="needs_nodejs" id="needs_nodejs" value="0">
                    <script type="text/javascript">
                    var servers = <?php print json_encode($servers); ?>;
                    servers['None'] = {Description: 'None', Requirements: ['None']};
                    var selected_server = servers['None'];
                    var update_server_list =  function(e) {
                        if(!(server = $('#server').val()))
                            server = 'None';
                            
                        $('#server-select .description').text(servers[server].Description);
                        $('#server-select .requirements').text(servers[server].Requirements.join(', '));
                        
                        selected_server = servers[server];
                    };
                    $('#server').live('click', update_server_list).live('change', update_server_list);
                    </script>
                </p>
                
                <p id="server-select">
                    <em>Description:</em> <span class="description">None</span><br>
                    <em>Requirements:</em> <span class="requirements">None</span>
                </p>
                
                <p>
                    <label for="db">If you will be using a database engine, please select one.</label>
                    <select name="db" id="db">
                        <option value="">No database engine selected</option>
                    <?php $dbs = get_available_db_engines();
                          foreach($dbs as $file => $db):
                    ?>
                        <option value="<?php print $file; ?>"><?php print $db['Library'] . ' &mdash; ' . $db['Version']; ?> (by <?php print $db['Author']; ?>)</option>
                    <?php endforeach; ?>
                    </select>
                    <script type="text/javascript">
                    var db_engines = <?php print json_encode($dbs); ?>;
                    var engine = 'None';
                    db_engines['None'] = {Description: 'None', Requirements: ['None']};
                    var update_db_list = function(e) {
                        if(!(engine = $('#db').val()))
                            engine = 'None';
                            
                        $('#db-select .description').text(db_engines[engine].Description);
                        $('#db-select .requirements').text(db_engines[engine].Requirements.join(', '));
                    };
                    $('#db').live('click', update_db_list).live('change', update_db_list);
                    
                    var update_reqs = function() {
                        setTimeout(function() {
                            if(engine == 'MySQL.php' && $.inArray('Database', selected_server.Requirements) != -1) {
                                $('#please-install-db').fadeIn();
                                $('#mysql-config').slideDown();
                            } else {
                                $('#please-install-db').fadeOut();
                                $('#mysql-config').slideUp();
                            }
                            
                            if($.inArray('Node.js', selected_server.Requirements) != -1) {
                                $('#nodejs-config').slideDown();
                                $('#needs_nodejs').val('1');
                            } else {
                                $('#nodejs-config').slideUp();
                                $('#needs_nodejs').val('0');
                            }
                        }, 100);
                    };
                    $('#db, #server').live('click', update_reqs).live('change', update_reqs);
                    </script>
                </p>
                
                <p id="db-select">
                    <em>Description:</em> <span class="description">None</span><br>
                    <em>Requirements:</em> <span class="requirements">None</span>
                </p>
                
                <p id="please-install-db">
                    <input type="checkbox" name="install_db" id="install_db" value="yes" checked="checked">
                    <label for="install_db">Please install the database for me.</label>
                </p>
                
                <p>
                    <label for="cookie">Cookie name</label>
                    <span class="desc">Ajax IM uses a cookie to keep track of the authenticated user's session. You can set the cookie name and session storage length.</span>
                    <input type="text" name="cookie" id="cookie" value="ajaxim_session">
                </p>
                
                <p>
                    <label for="cookie_length">Cookie storage length</label>
                    <span class="desc">The number of days for which to store the cookie. Setting it to 0 makes it a session cookie (deleted when the browser is closed). If Ajax IM is integrated with another authentication system, this cookie should be kept as long or longer than that cookie.</span>
                    <input type="text" maxlength="4" size="4" name="cookie_length" id="cookie_length" value="365"> days
                </p>
            </fieldset>
            
            <fieldset id="mysql-config">
                <legend>MySQL Configuration</legend>
                
                <p>                    
                    <label for="mysqldb">Database</label>
                    <input type="text" name="mysqldb" id="mysqldb">
                </p>
                
                <p>
                    <label for="mysqlhost">Hostname</label>
                    <span class="desc">Note: Usually, you will not need to change this value.</span>
                    <input type="text" name="mysqlhost" id="mysqlhost" value="localhost">
                </p>
                
                <p>
                    <label for="mysqluser">Username</label>
                    <input type="text" name="mysqluser" id="mysqluser">
                </p>
                
                <p>
                    <label for="mysqlpass">Password</label>
                    <input type="text" name="mysqlpass" id="mysqlpass">
                </p>
                
                <p>
                    <label for="mysqluser">Table Prefix</label>
                    <input type="text" name="mysqlprefix" id="mysqlprefix" value="ajaxim_">
                </p>
            </fieldset>
            
            <fieldset id="nodejs-config">
                <legend>Standalone (Node.js) Server Configuration</legend>
                
                <p>After configuration is complete, please see the <a href="http://ajaxim.com/installation">installation tutorial</a> to complete the standalone server setup.</p>
                
                <p>
                    <span>Is <code>server/config.js</code> writable?</span>
                    <?php if(is_writable('server/config.js')) { ?>
                    <span class="writable">Yes.</span>
                    <?php } else { ?>
                    <span class="problem"><strong>No.</strong> Please change the permissions of <code>server/config.js</code> to "writable" or 755 (on Unix-based systems) before continuing!</span>
                    <?php } ?>
                </p>
                
                <p>
                    <label for="public_port">Public host and port</label>
                    <span class="desc">Host is optional; set to blank for none. This is the port number that the client will use to communicate with the server.</span>
                    <input type="text" size="15" name="public_host" id="public_host" value="localhost"> : 
                    <input type="text" maxlength="5" size="5" name="public_port" id="public_port" value="31411">
                </p>
                
                <p>
                    <label for="public_port">Private (API) host and port</label>
                    <span class="desc">Host is optional; set to blank for none. This is the port number that the <code>server.php</code> script will use, as well as the port you will use for the <a href="http://ajaxim.com/documentation/api">Memcache-based API</a>.</span>
                    <input type="text" size="15" name="private_host" id="private_host" value="localhost"> : 
                    <input type="text" maxlength="5" size="5" name="private_port" id="private_port" value="11211">
                </p>
                
                <p>
                    <label for="session_length">Session storage length</label>
                    <span class="desc">The number of days for which to store the session &mdash; which is different than the cookie. The cookie holds on to the session identifier, but if the session doesn't exist any longer, the cookie is useless. Therefore, the session needs to be kept as long, or longer, than the cookie. Minimum 0.042 days (approx. one hour).</span>
                    <input type="text" maxlength="4" size="4" name="session_length" id="session_length" value="365"> days
                </p>
            </fieldset>
            
            <p id="install"><input type="submit" value="Install" name="install"></p>
        </form>
<?php } ?>
        
        <p id="footer"><a href="http://ajaxim.com">Ajax IM</a> &copy; 2005&thinsp;&ndash;&thinsp;2010, <a href="http://unwieldy.net">Joshua Gross</a></p></p>
    </body>
</html>