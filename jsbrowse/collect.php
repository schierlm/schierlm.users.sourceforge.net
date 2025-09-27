<?php

error_reporting(E_ALL);

DEFINE('IN_JSBROWSE', 1);
require('config.php');


if (!isset($_POST['data']))
	die("Data missing.");

$sql="INSERT INTO jsbrowse_nodes (name,type,value) VALUES ('','rootnode','')";

if (!mysql_query($sql))
	die('Could not insert: ' . mysql_error());

$rootid = mysql_insert_id();

$idlist = array($rootid);

$data = split("\n", $_POST['data']);
$appname = trim(array_shift($data));
$user_agent = trim($_SERVER['HTTP_USER_AGENT']);
$remote_ip = trim($_SERVER['REMOTE_ADDR']);

$sql = "INSERT INTO jsbrowse_browsers (id, name, appname, useragent, ip) values (" . 
	intval($rootid) . ", '', '" . mysql_real_escape_string($appname) . "', '" .
	mysql_real_escape_string($user_agent) . "', '" .
	mysql_real_escape_string($remote_ip) . "')";

if (!mysql_query($sql))
	die('Could not insert: ' . mysql_error());

foreach($data as $rownum => $row) {
	
	$rowfields = split(" ", $row);
	if (count($rowfields) != 4)
		die("Invalid row: "+$row);
	
	$sql="INSERT INTO jsbrowse_nodes (name,type,value) VALUES ('" . 
		mysql_real_escape_string(trim($rowfields[1])) . "', '" .
		mysql_real_escape_string(trim($rowfields[2])) . "', '" .
		mysql_real_escape_string(urldecode(trim($rowfields[3]))) . "')";
	
	if (!mysql_query($sql))
		die('Could not insert: ' . mysql_error());
	
	$newid = mysql_insert_id();
	$idlist[$rownum+1] = $newid;
	
	$sql="INSERT INTO jsbrowse_children (parentid, childid) VALUES (" . 
		intval($idlist[$rowfields[0]]) . ", " . intval($newid) .")";
	
	if (!mysql_query($sql))
		die('Could not insert: ' . mysql_error());
}
echo count($data) . " rows imported.";
echo "<br/>Import ID: " . $rootid;
echo "<br/>Your IP: " . $remote_ip;
echo "<br/>AppName: " . $appname;
echo "<br/>User-Agent: " . $user_agent;
?><hr>
Thank you for your submission!
<hr>
<a href="index.html">Back</a>