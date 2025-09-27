<?php
#
# (c) 2009 Michael Schierl
# Licensed under GNU GPL v2 or later
#
error_reporting(E_ALL);

DEFINE('IN_MICROBAN', 1);
require('session.php');

$levelset = intval($_GET['levelset']);
$level = intval($_GET['level']);

$sql = 'SELECT name, width, playerx, playery, field FROM '.$db_prefix.'levels where levelsetid=' . $levelset . ' and levelid='. $level;

$result=mysqli_query($link,$sql);
if (!$result)
	die('Could not select level: ' . mysqli_error($link));

if (!($row = mysqli_fetch_row($result)))
	die('Level not found: ' . mysqli_error($link));

$levelname = $row[0];
$levelwidth= intval($row[1]);
$playerx = intval($row[2]);
$playery = intval($row[3]);
$levelfield = $row[4];

mysqli_free_result($result);
mysqli_close($link);
?>
<html>
<head>
<title><?php echo $levelname;?> &ndash; Microban online (JavaScript only)</title>
<link rel="stylesheet" type="text/css" href="style.css" />
<link rel="stylesheet" type="text/css" href="playground.css.php" />
<script type="text/javascript">
var playerx = <?php echo $playerx; ?>;
var playery = <?php echo $playery; ?>;
var width = <?php echo $levelwidth; ?>;
var field = '<?php echo $levelfield; ?>';
var height = field.length / width;
</script>
<script type="text/javascript" src="microban.js"></script>
</head>
<body onload="drawField()">
<h1><?php echo $levelname;?> &ndash; Microban online (JavaScript only)</h1>
<p><i>
<?php
if ($userid != -1) {
	echo "Logged in as " . $username;
} else {
	echo "Not logged in.";
}
?>
</i></p>
<p>
	Tile size: <a href="javascript:setSize(8)">small</a> 
	&ndash; <a href="javascript:setSize(16)">normal</a>
	&ndash; <a href="javascript:setSize(24)">large</a> 
	&ndash; <a href="javascript:setSize(32)">huge</a>
</p>
<p>
	<a href="javascript:doUndo()">Undo last push</a> 
	<span id="solved" style="display:none;"> &ndash; <a href="<?php echo "index.php?" . $SID . "levelset=" . $levelset . "&solved=" . $level; ?>">Solved!</a></span>
	&ndash; <a href="index.php?<?php echo $SID . "levelset=" . $levelset?>" />Back to list</a>
</p>
<table id="playground" class="size16"><tr><th>Loading...</th></tr></table>
</html>