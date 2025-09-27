<?php

error_reporting(E_ALL);

DEFINE('IN_JSBROWSE', 1);
require('config.php');

if(!isset($_GET['nextid']) || !isset($_GET['ids'])) 
	die('Variable missing');

$nextid = intval($_GET['nextid']);
$ids = split('\|', $_GET['ids']);
$names=array();

for($i=0; $i < count($ids); $i++) {
	$sql="select id, name, type, value from jsbrowse_nodes where id in 
		(select childid from jsbrowse_children where parentid='".intval($ids[$i])."')";
	$result=mysql_query($sql);
	if (!$result)
		die('Could not select browsers: ' . mysql_error());
	while ($row = mysql_fetch_row($result)) {
		$id=$row[0];
		$name=$row[1];
		$info=$row[2] . " {".$row[3]."}";
		if(!isset($names[$name]))
			$names[$name] = array();
		$names[$name][$i] = array($id, $info, $row[2] == 'object');
	}
}
ksort($names);
$entries='';
foreach($names as $name => $infos) {
	$globalid=isset($infos[0]) ? $infos[0][0] : '';
	for($i=1; $i < count($ids); $i++) {
		if (!isset($infos[$i]) || $infos[$i][0] != $globalid)
			$globalid = '';
	}
	$allids = '';
	$value='';
	$isobj = false;
	for($i=0; $i < count($ids); $i++) {
		if ($i != 0) {
			$allids .="|";
			$value .= "|";
		}
		if (isset($infos[$i])) {
			$allids .= $infos[$i][0];
			$value .= $infos[$i][1];
			$isobj = $isobj | $infos[$i][2];
		} else {
			$allids .= '0';
		}
	}
	if ($globalid != '') {
		$value = $infos[0][1];
	}
	$value = htmlspecialchars($value);
	$name = htmlspecialchars($name);
	echo '<li>' . ($globalid == '' ? '<span class="diff">' : '') .
		($isobj ? 
			('<a href="javascript:expand(' . $nextid . ', \'' . $allids. 
			 '\');">'. $name . '</a>') :
			('<b>' . $name . '</b>')) .
		' (' . $value . ')'. ($globalid == '' ? '</span>' : '') .
		'<ul id="l' . $nextid . '"></ul></li>' . "\n";
	$nextid++;
}
echo '<*>' . $nextid;
?>