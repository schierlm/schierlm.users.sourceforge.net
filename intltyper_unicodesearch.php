<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: https://intltyper.sourceforge.io');
    header('Access-Control-Allow-Methods: POST, GET, DELETE, PUT, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: X-Requested-With, Content-Type');
    header('Access-Control-Max-Age: 1728000');
    header('Content-Length: 0');
    header('Content-Type: text/plain');
    die();
}

header('Access-Control-Allow-Origin: https://intltyper.sourceforge.io');

header("Content-Type: text/xml");
error_reporting(E_ALL);
function buildFilter($word) {
	if (preg_match('~^!~', $word)) {
		return 'NOT ('. buildFilter(substr($word, 1)) . ')';
	}
	if(preg_match('~#[A-FX0-9]{1,4}$~', $word)) {
		$pattern = substr('0000' . str_replace('X', '_', $word), -4);
		return '`codepointhex` LIKE ' . "'" . $pattern. "'";
	}
	if (preg_match('~^#([A-F0-9]{1,4})-([A-F0-9]{1,4})$~', $word, $twopart)) {
		return '`codepoint` >= ' . hexdec($twopart[1]) . ' AND `codepoint` <= ' . hexdec($twopart[2]);
	}
	if (preg_match('~[^*()A-Z0-9 -]~', $word)) {
		return '1=0';
	}
	return '`charname` LIKE '. "'% " . str_replace('*', '%', $word) . " %'";
}

$dbhost='mysql-i';
$dbuser='i127523ro';
$dbpass='*redacted*';
$dbname='i127523_unicodedata';
$link = mysqli_connect($dbhost, $dbuser, $dbpass, $dbname);
if (!$link) {
    die(mysqli_error($link));
}
if (!isset($_GET["q"])) die('No query given');
$query = $_GET["q"];
$result = array();
if (preg_match("~^,[0-9,]+,$~", $query)) {
	$cp=array();
	foreach(split(',',$query) as $codepoint) {
		if ($codepoint != '') $cp[] = $codepoint;
	}
	$sql = '`codepoint` in(' . implode(',',$cp) . ')';
} else {
	$sql = '1';
	$query = strtoupper($query);
	if (preg_match("~^[0-9][A-FX0-9]{1,3}$~", $query))
		$query = '#' . $query;
	$words = explode(' ', $query);
	foreach($words as $word) {
		$sql .= ' AND ' . buildFilter($word);
	}
}
$result = mysqli_query($link,'select `codepointhex`, `charname` from `unicodedata` WHERE '
		. $sql . ' order by `codepointhex` limit 251');
if (!$result) {
    die(mysqli_error($link));
}
echo '<results>';
while($row = mysqli_fetch_row($result)) {
	$name=trim(substr($row[1],0, -1));
	echo '<r c="' . $row[0] . '">' . $name . '</r>';
}
echo '</results>';
mysqli_close($link);
?>

