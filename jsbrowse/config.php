<?php

if (!defined('IN_JSBROWSE')) 
	die('Hacking attempt.');

$link = mysql_connect('mysql-s', 's507732rw', '*redacted*');
if (!$link)
	die('Could not connect: ' . mysql_error());

if (!mysql_select_db('s507732_jsbrowse', $link))
    die ('Can\'t select db : ' . mysql_error());

?>
