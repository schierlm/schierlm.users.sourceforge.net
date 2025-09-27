<?php
#
# (c) 2009 Michael Schierl
# Licensed under GNU GPL v2 or later
#
error_reporting(E_ALL);

DEFINE('IN_MICROBAN', 1);
require('session.php');

$message = '';
if (isset($_GET['logout'])) {
	// handled in session.php
	$message = "User logged out.";
} else if (isset($_POST['login'])) {
	$username = $_POST['user'];
	$password = $_POST['password'];
	$password = sha1($username . '|' . $password);
	$sql = 'SELECT id, name FROM '.$db_prefix."users where name='" . mysqli_real_escape_string($username) . "' and password='" . mysqli_real_escape_string($password) . "'";
	$result=mysqli_query($link,$sql);
	if (!$result)
		die('Could not select user: ' . mysqli_error($link));
	if (!($row = mysqli_fetch_row($result)))
		die('User unknown');
	$_SESSION['userid'] = $row[0];
	$_SESSION['username'] = $row[1];

	mysqli_free_result($result);

	$userid = intval($_SESSION['userid']);
	$username = $_SESSION['username'];
	$message = 'User logged in';
} else if (isset($_POST['register'])) {
	$username = $_POST['user'];
	$password = $_POST['password'];
	$password2 = $_POST['password2'];
	if ($password != $password2)
		die('Passwords do not match');
	if ($password == '')
		die('Empty password not allowed');
	$password = sha1($username . '|' . $password);
	
	$sql = 'INSERT INTO '.$db_prefix."users (name,password) VALUES ('" . mysqli_real_escape_string($username) . "', '" . mysqli_real_escape_string($password) . "')";
	$result=mysqli_query($link,$sql);
	if (!$result)
		die('Could not create user: ' . mysqli_error($link));
	$message = 'User created. Please log in now.';
} else if (isset($_POST['changepw'])) {
	if ($userid == -1) die ("Not logged in");
	$oldpassword = $_POST['oldpassword'];
	$oldpassword = sha1($username . '|' . $oldpassword);
	
	$sql = 'SELECT id FROM '.$db_prefix."users where id=" . $userid . " and name='" . mysqli_real_escape_string($username) . "' and password='" . mysqli_real_escape_string($oldpassword) . "'";
	$result=mysqli_query($link,$sql);
	if (!$result)
		die('Could not select user: ' . mysqli_error($link));
	if (!($row = mysqli_fetch_row($result)))
		die('Old password wrong');
	mysqli_free_result($result);
	
	$password = $_POST['password'];
	$password2 = $_POST['password2'];
	if ($password != $password2)
		die('Passwords do not match');
	if ($password == '')
		die('Empty password not allowed');
	$password = sha1($username . '|' . $password);

	$sql = 'UPDATE '.$db_prefix."users set password='" . mysqli_real_escape_string($password) . "' where id=" . $userid;
	$result=mysqli_query($link,$sql);
	if (!$result)
		die('Could not update user: ' . mysqli_error($link));
	$message = 'Password changed.';
}

$levelset = 0;
$levelsetname='';
$levelsetdesc='';
$solvedlevelsets = Array();

if (isset($_GET['levelset'])) {
	$levelset = intval($_GET['levelset']);
}

if ($levelset != 0) {
	if (isset($_GET['solved'])) {
		$sql = 'REPLACE INTO '.$db_prefix."solved (userid, levelsetid, levelid) VALUES (" . $userid . "," . $levelset . "," . intval($_GET['solved']) . ")";
		$result=mysqli_query($link,$sql);
		if (!$result)
			die('Could not update solved state: ' . mysqli_error($link));	
		$message = 'Level solved.';
	}

	$levels='';
	$solvedlevels = Array();
	
	$sql = 'SELECT levelid FROM '.$db_prefix.'solved where levelsetid=' . $levelset . ' and userid=' . $userid;

	$result=mysqli_query($link,$sql);
	if (!$result)
		die('Could not select levelset stats: ' . mysqli_error($link));

	while ($row = mysqli_fetch_row($result)) {
		$solvedlevels[$row[0]] = 1;
	}

	mysqli_free_result($result);
	
	$sql = 'SELECT levelid, name FROM '.$db_prefix.'levels where levelsetid=' . $levelset . ' ORDER BY levelid';

	$result=mysqli_query($link,$sql);
	if (!$result)
		die('Could not select levels: ' . mysqli_error($link));


	while ($row = mysqli_fetch_row($result)) {
		$starttag = '<b>';
		$endtag = '<b>';
		$issolved = 'No';
		if (isset($solvedlevels[$row[0]])) {
			$issolved = 'Yes';
			$starttag='';
			$endtag = '';
		}
		$levels .= '<tr><td>' . $starttag . $row[0] . $endtag .
		'</td><td><a href="play.php?' . $SID . 'levelset=' . $levelset . '&level=' . $row[0] . '">' . $starttag . htmlspecialchars($row[1]) . $endtag . '</a></td><td>' . $starttag . $issolved . $endtag . '</td></tr>';
	}

	mysqli_free_result($result);
}

$sql = 'SELECT levelsetid, count(distinct levelid) FROM ' . $db_prefix . 'solved where userid=' . $userid . ' group by levelsetid';
$result=mysqli_query($link,$sql);
if (!$result)
	die('Could not select global stats: ' . mysqli_error($link));

while ($row = mysqli_fetch_row($result)) {
	$solvedlevelsets[$row[0]] = intval($row[1]);
}

mysqli_free_result($result);

$sql = 'SELECT id, name, levelcount, description FROM '.$db_prefix.'levelsets ORDER BY id';

$result=mysqli_query($link,$sql);
if (!$result)
	die('Could not select levelsets: ' . mysqli_error($link));

$levelsets='';

while ($row = mysqli_fetch_row($result)) {
	$starttag1 = '<b>';
	$endtag1 = '</b>';
	$starttag2 = '<b>';
	$endtag2 = '</b>';
	$solvecount = 0;
	if (isset($solvedlevelsets[$row[0]])) {
		$solvecount = $solvedlevelsets[$row[0]];
		$starttag1 = '';
		$endtag1 = '';
		if ($solvecount == $row[2]) {
			$starttag2 = '';
			$endtag2 = '';
		}
	}
	if ($row[0] == $levelset) {
		$levelsetname = htmlspecialchars($row[1]);
		$levelsetdesc = str_replace('|', '<br/>',htmlspecialchars($row[3]));
		$setlink='<b>';
		$setlinkend='</b>';
	} else {
		$setlink = '<a href="index.php?' . $SID . 'levelset=' . $row[0] . '">' . $starttag1;
		$setlinkend = $endtag1 . '</a>';
	}
	$levelsets .= '<tr><td>' . $setlink . htmlspecialchars($row[1]) . $setlinkend .
	'</td><td>' . $starttag2 . $solvecount . '/' . $row[2] . $endtag2 . '</td></tr>';
}

mysqli_free_result($result);

mysqli_close($link);
?>
<html>
<head>
<title>Microban online (JavaScript only)</title>
<link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
<h1>Microban online (JavaScript only)</h1>
<p><?php echo $message;?>&nbsp;</p>
<?php if ($levelset != 0) { ?>
<h2>Select level from levelset "<?php echo $levelsetname; ?>"</h2>
<p style="border: 1px dashed gray; background-color: #ffffdd">
<?php echo $levelsetdesc; ?>
</p>
<table class="levellist">
<tr><th>Level</th><th>Name</th><th>Solved</th></tr>
<?php echo $levels; ?>
</table>
<?php } ?>
<h2>Select <?php if ($levelset != 0) echo "another "; ?>levelset</h2>
<table class="levellist">
<tr><th>Levelset</th><th>Solved</th></tr>
<?php echo $levelsets; ?>
</table>
<h2>Login</h2>
<?php if ($userid != -1) { ?>
<p>Logged in as <?php echo $username; ?> (<a href="index.php?<?php echo $SID?>logout=1">Logout</a>).</p>
<form action="index.php?<?php echo SID;?>" method="post">
<p>Old password: <input type="password" name="oldpassword" value="" /></p>
<p>New Password: <input type="password" name="password" value="" /></p>
<p>Repeat Password: <input type="password" name="password2" value="" /> <input type="submit" name="changepw" value="Change password" /></p>
</form>
<?php } else { ?>
<p>Not logged in</p>
<form action="index.php?<?php echo SID;?>" method="post">
<p>Username: <input type="text" name="user" value="" /></p>
<p>Password: <input type="password" name="password" value="" /> <input type="submit" name="login" value="Login" /></p>
<p>Repeat Password: <input type="password" name="password2" value="" /> <input type="submit" name="register" value="Create account" /></p>
</form>
<?php } ?>
<hr>
<p>&copy; 2009 Michael Schierl - <a href="source.zip">Licensed under GNU GPL v2 or later</a></p>
</html>
