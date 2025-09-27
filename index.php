<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: Verdana, Arial, Helvetica, sans-serif;}
dt {font-weight: bold; float:left; clear:left; width: 10em;}
dd {margin-left: 10em; margin-bottom: 1em;}
span.dload {font-weight: normal; font-size: 80%;}
span.german {color:gray;}
</style>
<meta charset="UTF-8">
<meta name="Author" content="Michael Schierl">
<title>Michael Schierl - about me</title>
<script type="text/javascript" src="http://static.hab.la/js/wc.js"></script>
<script type="text/javascript"> 
wc_init("3082-99810228-10-7822");
</script>
</head>
<body>
<h1>About me</h1>

<?php
if(isset($_GET["nogerman"])) {
$nogerman=1
?>
<p><a href="?">Show German-only information again.</a></p>
<?php
} else {
$nogerman=0;
?>
<p><a href="?nogerman=1">Hide all German-only information.</a></p>
<?php
}
?>

<h2>General</h2>

<div style="float:right; border: 1px dotted; padding: 1em;">
<img src="http://schierlm.users.sourceforge.net/mschierlm/michaelneu.jpg" width="120" height="150">
</div>

<dl>
<dt>Nickname:</dt>
	<dd><img src="http://pouet.net/avatars/glider_by_mihi.gif" width="16" height="16" style="border: none; padding: 2px; vertical-align: middle;" />mihi</dd>
<dt>Name:</dt>
	<dd>Michael Schierl</dd>
<dt>Address:</dt>
	<dd>Ignaz-Baldauf-Str. 5<br/>
	D-86551 Aichach<br/>
	Germany</dd>
<dt>E-Mail:</dt>
	<dd><a href="mailto:schierlm%40gmx.de">schierlm&#64;gmx.de</a>  (<a href="#email-pgp">PGP</a> preferred)</dd>
<dt>Date of Birth:</dt>
	<dd>July 9, 1981</dd>
<dt>Jabber:</dt>
	<dd><a href="ttp://wwj.jabberstudio.org/schierlm@jabber.ccc.de">schierlm&#64;jabber.ccc.de</a> (<a href="#jabber-pgp">PGP</a> preferred)</dd>
<dt>ICQ:</dt>
	<dd><a href="http://wwp.icq.com/31020687">31020687</a></dd>
<dt>AIM:</dt>
	<dd>i31020687</dd>
<dt>YIM:</dt>
	<dd>mschierlm</dd>
<dt>MSN:</dt>
	<dd>schierlm-public@gmx.de</dd>
<dt>Mastodon:</dt>
	<dd><a rel="me" href="https://infosec.exchange/@mihi">@mihi@infosec.exchange</a></dd>
<dt>Keybase:</dt>
	<dd><a href="https://keybase.io/mihi">mihi</a></dd>
<dt>Keyoxide:</dt>
	<dd><a href="https://keyoxide.org/aspe:keyoxide.org:NJ6HT4CKBT6FQEOAH5QQN562XA"><tt>aspe:keyoxide.org:NJ6HT4CKBT6FQEOAH5QQN562XA</tt></a></dd>
<dt id="email-pgp">PGP (E-Mail):<br/><span class="dload">(<a href="http://schierlm.users.sourceforge.net/mschierlm/mschierlm.asc">Download</a>)</span></dt>
	<dd><tt>Key ID: <a href="http://pgpkeys.pca.dfn.de/pks/lookup?op=vindex&search=0x9D87759F58B48CDD">0x58B48CDD</a><br/>
	Size: 2048 (RSA)<br/>
	Fingerprint: 68 CE B8 07 E3 15 D1 4B  74 61 55 39 C9 0F 7C C8</tt></dd>
<dt>GnuPG:<br/><span class="dload">(<a href="http://schierlm.users.sourceforge.net/mschierlm/mschierlm-gpg.asc">Download</a>)</span></dt>
	<dd><i>(Note: The PGP key above should work as well with recent
	    GnuPG versions)</i><br/>
	<tt>Key ID: <a href="http://pgpkeys.pca.dfn.de/pks/lookup?op=vindex&search=0x3210C6E2874B263E">0x2874B263E</a><br/>
	  Size:  1024/2048 (DSS/ElGamal)<br/>
	  Fingerprint: 0D98 4174 92F4 15D3 31E3  5F9C 3210 C6E2 874B 263E</tt><dd>
<dt id="jabber-pgp">PGP (Jabber):</dt>
	<dd><tt>Key ID: <a href="http://pgpkeys.pca.dfn.de/pks/lookup?op=vindex&search=0x7F2DB66BF61E0C93">0xF61E0C93</a><br/>
	  Size:  1024/1024 (DSS/ElGamal)<br/>
	  Fingerprint: 656A 7BA0 4EF9 C156 4736  D4BF 7F2D B66B F61E 0C93</tt><dd>
</dl>

<h2>Other profiles about me</h2>

<ul>
<li><a href="http://www.linkedin.com/in/michaelschierl">LinkedIn</a></li>
<li><a href="http://schierlm.users.sourceforge.net/index.html">sourceforge user page</a> (<a href="http://sourceforge.net/users/schierlm">Developer Profile</a>, <a href="http://sourceforge.net/people/viewprofile.php?user_id=729958">Skills Profile</a>)</li>
<li><a href="http://github.com/schierlm/">GitHub</a></li>
<li><a href="http://del.icio.us/schierlm">del.icio.us</a></li>
<li><a href="http://www.orkut.com/Main#Profile.aspx?rl=ls&uid=4668179917253508234">orkut</a></li>
<li><a href="http://www.netvibes.com/mihi">netvibes</a></li>
<li><a href="http://stackoverflow.com/users/90203/mihi">Stackoverflow</a> / <a href="http://serverfault.com/users/2305/mihi">Serverfault</a> / <a href="http://superuser.com/users/1724/mihi">SuperUser</a></li>
<li><a href="http://www.ohloh.net/accounts/schierlm">Ohloh</a></li>
<li><a href="http://www.whohub.com/mihi">Interview in Whohub</a></li>

<li><a href="http://www.hacker.org/forum/profile.php?mode=viewprofile&u=7657">hacker.org</a> / <a href="http://www.wechall.net/profile/mihi">wechall.net</a></li>

<li><a href="http://public.box.net/mihi">Box.net</a></li>
<li><i>My old homepage:</i> <a href="http://schierlm.users.sourceforge.net/mschierlm/sm-soft/index.htm">SM<i>soft</i> Freeware Download Page</a></li>
<?php if($nogerman) {?>
</ul>

<?php } else { ?>
<li><span class="german">[German]</span> <a href="https://www.xing.com/profile/Michael_Schierl2">Xing</a></li>
<li><span class="german">[German]</span> <a href="http://schierlm.users.sourceforge.net/mschierlm/sm-soft/kontakt.htm">Meine alte Profilseite</a> <i>(mit "Jahres-Blog")</i></li>
<li><span class="german">[German]</span> <a href="http://michael.schierl.meinguter.name/">Mein guter Name</a>
<li><span class="german">[German]</span> <a href="http://michael-schierl.myonid.de/">myON-ID</a>
<li><span class="german">[German]</span> <a href="http://www.yasni.de/index.php?action=webprofile&name=Michael+Schierl&number=15665">Yasni</a>
<li><span class="german">[German]</span> <a href="http://www.stayfriends.de/h/668076/Bayern/Aichach/Gymnasium/Deutschherren-Gymnasium/Michael_Schierl.html">StayFriends</a></li>
</ul>

<h2>Lebenslauf in Hyperlinks <span class="german">[German only]</span></h2>
<dl>
<dt>1988-1992</dt> <dd><a href="http://www.ludwig-steub-grundschule.de/">Grundschule Aichach</a></dd>
<dt>1992-2001</dt> <dd><a href="http://www.deutschherren-gymnasium.de/">Deutschheren-Gymnasium-Aichach</a></dd>
<dt>1996-2000</dt> <dd><a href="http://www.bwinf.de/">Bundeswettbewerb Informatik</a></dd>
<dt>2001-2001</dt> <dd><a href="http://abijahrgang-2001.de/">Abitur 2001</a></dd>
<dt>2001-2006</dt> <dd><a href="http://www.uni-augsburg.de/">Universität Augsburg</a></dd>
<dt>2003-2006</dt> <dd><a href="http://studentenforum.uni-augsburg.de/">studentenforum der Universität Augsburg</a> (2004 Praktikum)</dd>
<dt>2006-2008</dt> <dd><a href="http://www.costxpert.de/">Cost Xpert AG</a></dd>
<dt>2008-</dt> <dd><a href="http://www.onesto.de/">Onesto GmbH</a></dd>
</dl>
<?php } ?>

<h2>Security related articles</h2>
<ul>
<li><a href="avevasion.html">Facts and myths about antivirus evasion with Metasploit</a></li>
<li><a href="CVE-2011-3544.html">CVE-2011-3544 / ZDI-11-305 – Oracle Java Applet Rhino Script Engine Remote Code Execution</a></li>
<li><a href="TypeConfusion.html">Exploiting Type Confusion Vulnerabilities in Oracle JRE (CVE-2011-3521/CVE-2012-0507)</a></li>
<li><a href="CVE-2012-1723.html">CVE-2012-1723 – Oracle Java Applet Field Bytecode Verifier Cache Remote Code Execution [CVE-2012-1723 OpenJDK: insufficient field accessibility checks (HotSpot, 7152811)]</a></li>
<li><a href="CVE-2013-0422.html">CVE-2013-0422 &ndash; aka: Java 2013 0day 1 &ndash; and inofficial patch</a></li>
</ul>

<h2>Various</h2>
<ul>
<li><a href="smallestjs.html">Unicode based JavaScript obfuscator</a></li>
<li><a href="testpage/">Test page for browser screenshot services</a></li>
<li><a href="5letters.html">5 Letters: A search engine experiment</a></li>
<li><a href="other/history/main.html">Save information (supercookie) in browser history [older browsers only]</a></li>
<li><a href="vulnerable-javadoc/">JavaDoc vulnerable to CVE-2013-1571</a> (<a href="vulnerable-javadoc/index.html?//www.bing.de/">Example link</a>)</li>
</ul>

<!-- TODO
<h2>Websites i visit daily:</h2>

TODO
+ more URL lists
-->
</body>
</html>
