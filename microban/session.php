<?php
#
# (c) 2009 Michael Schierl
# Licensed under GNU GPL v2 or later
#
if (!defined('IN_MICROBAN')) 
	die('Hacking attempt.');

// php4 compatibility
if (!function_exists('mysqli_connect')) {

	function mysqli_connect($db_host, $db_user, $db_password, $db_schema)
	{
		$link = mysql_connect($db_host, $db_user, $db_password);
		if (!$link)
			die('Could not connect: ' . mysql_error());

		if (!mysql_select_db($db_schema, $link))
			die ('Can\'t select db : ' . mysql_error());

		return $link;
	}
	
	function mysqli_close($link) {
		mysql_close();
	}
	
	function mysqli_error($link) {
		return mysql_error();
	}
	
	function mysqli_fetch_row($result) {
		return mysql_fetch_row($result);
	}

	function mysqli_free_result($result) {
		return mysql_free_result($result);
	}
	
	function mysqli_query($link, $sql) {
		return mysql_query($sql);
	}
	
	function mysqli_real_escape_string($s) {
		return mysql_real_escape_string($s);
	}
}

require('config.php');

$link = mysqli_connect($db_host, $db_user, $db_password, $db_schema);
if (mysqli_connect_errno())
	die('Could not connect: ' . mysqli_connect_error($link));

ini_set("session.use_cookies", "0");
ini_set("session.use_trans_sid", "false");

if(isset($_GET['PHPSESSID'])) {
	session_id($_GET['PHPSESSID']);
}

session_start();
$SID = SID . '&';

if(isset($_GET['logout'])) {
	$_SESSION['userid'] = -1;
	$_SESSION['username'] = '';
}

$userid=-1;
$username = '';

if (isset($_SESSION['userid'])) {
	$userid = intval($_SESSION['userid']);
	$username = $_SESSION['username'];
}
?>
