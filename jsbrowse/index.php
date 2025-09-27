<?php
error_reporting(E_ALL);

DEFINE('IN_JSBROWSE', 1);
require('config.php');

$sql="select id, name, appname, useragent from jsbrowse_browsers";

$unapproved = isset($_GET['unapproved']);

if (!$unapproved) {
	$sql .= " where name <> ''";
}

$result=mysql_query($sql . ' order by name, appname');
if (!$result)
	die('Could not select browsers: ' . mysql_error());

$browserhtml='';
$browserids='';

while ($row = mysql_fetch_row($result)) {
	if ($browserids != '')
		$browserids .= ',';
	$browserids .= $row[0];
	$browserhtml .= '<li><input type="checkbox" name="b' . $row[0] . 
	'" onclick="toggleBrowser();"><b>'. $row[1] . "</b>";
	if ($unapproved)
		$browserhtml .= ' <i>(' . $row[2] . ', ' . $row[3] . ')</i>';
	$browserhtml .= '</li>' . "\n";
}
?>
<html>
<head>
<title>JSBrowse &ndash; browse and compare the JavaScript DOM tree</title>
<style>
body {
	font-family: verdana, arial, helvetica, sans-serif;
	font-size: 10pt;
}
.diff {
	color: #c00;
}
</style>
<script type="text/javascript">

var browserids = [<?php echo $browserids;?>];
var nextid=1;

function loadNode(node, ids) {
	var req = new XMLHttpRequest();  
	req.open('GET', './load.php?nextid=' + nextid + "&ids=" + ids, true);  
	req.onreadystatechange = function (aEvt) {  
		if (req.readyState != 4) 
			return; 
		if(req.status == 200) {
			var vars = req.responseText.split('<*>');
			document.getElementById('l'+node).innerHTML = vars[0];
			nextid = vars[1]-0;
		} else {
			alert("Error loading page:" + req.status); 
		} 
	};  
	req.send(null); 
}

function toggleBrowser() {
	nextid=1;
	var browsers='';
	for(var j=0; j<browserids.length; j++) {
		i = browserids[j];
		if (document.forms.selectform["b"+i].checked) {
			if(browsers.length > 0) {
				browsers += '|';
			}
			browsers += i;
		}
	}
	loadNode(0, browsers);
}

function expand(node, ids) {
	if (document.getElementById('l'+node).innerHTML=='') {
		loadNode(node, ids);
	} else {
		document.getElementById('l'+node).innerHTML='';
	}
}
</script>
</head>
<body>
<h1>JSBrowse &ndash; browse and compare the JavaScript DOM tree</h1>

<p>This website is designed for Firefox 3, but you can, of course, browse
DOM trees of other browsers. It still looks a bit ugly, but that will
hopefully change at a not so distant time in the future.</p>

<p>If you want to submit your own browser data (for a browser not listed here),
please go to <a href="collect.html">this website</a>, let it run until it has
collected all data, and submit it. Send me an e-mail with the output of the
result page (including information about your browser, your OS, and possibly
installed extensions), so that I can incorporate the data into this website.</p>

<h2>Supported browsers</h2>
<form name=selectform>
<ul>
<?php echo $browserhtml;?>
</ul>
</form>

<h2>Browse below</h2>
<ul id="l0">
<li><i>(Select browsers above to compare)</i></li>
</ul>
<hr>
<span style="font-size: small">Michael Schierl, Ignaz-Baldauf-Str. 5, 86551 Aichach; 
mailto bplaced punkt mihi42 klammeraffe safersignup punkt com</span>
</body>
</html>

