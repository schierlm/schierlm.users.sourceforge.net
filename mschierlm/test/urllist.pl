#!/usr/bin/perl
sub printlastlink {
        if ($lastlink=~/./) {

	    $count++;
	    print OUT "<a href=\"#$count\">$lastlink</a> ($links) - \n";
	}

}
open(OUT,">urllist.htm");
open(IN, "<urllist.txt");
print OUT <<EOF;
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<HTML><head><title>Meine fette Linkliste</title>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<meta name="robots" content="noindex"></meta>
<style type="text/css">body {font-family: verdana, arial, sans-serif; font-size: 75%;}</style>
</head><body bgcolor="#eeeeee">
<h1>URL-Liste (by Michael Schierl)</h1>
<hr>Diese Liste wurde erstellt von <a href="urllist.pl">urllist.pl</a> aus <a href="urllist.txt">urllist.txt</a><hr>
<h2>Inhalt</h2> - 
EOF
$_=<IN>;
$_=<IN>;
$_=<IN>;
$run=1;
$links=0;
$linkstotal=0;
$lastlink="";
while ($run && ($_=<IN>)) {
    s/\r//g;
    chop;
    s/&/&amp;/g;
    s/</&lt;/g;
    s/"/&quot;/g;
    if (m/^=/) {
        printlastlink();
	$run=0;
    } 
    if (m/^\$/) {
	printlastlink();
	s/^\$//;
	print OUT "<br><br><b>$_</b> - \n";
	$lastlink="";
    } elsif (m/^[^ =\$]/) {
	printlastlink();
	s/:$//;
	$lastlink=$_;
	$links=0;
    }
    if (m/^ /) {
	$links++;
	$linkstotal++;
    }
}
printlastlink();
print OUT "<hr><i>Insgesamt: $linkstotal Links</i><hr>\n";
close(IN);
open(IN,"<urllist.txt");
$_=<IN>;
$_=<IN>;
$_=<IN>;
$run=1;
$count=0;
$printed=0;
$heading="";
while ($run && ($_=<IN>)) {
    s/\r//g;
    chop;
    s/&/&amp;/g;
    s/</&lt;/g;
    s/"/&quot;/g;
    if (m/^=/) {
	$run=0;
    } 
    if (/^\$/) {
	print OUT "</ul><hr>";
	s/^\$//;
	$heading=$_;
	$printed=0;
    } elsif (/^[^ =\$]/) {
	$count++;
	s/:$//;
	print OUT "</ul>" if ($printed == 1);
	print OUT "<h2><a name=\"$count\">$heading$_</a></h2><ul>\n";
	$printed=1;
    }
    if (/^ /) {
	s#((https?|ftp):[^ ]*)#<a href="\1">\1</a>#g;
	s#news:([^ ]*)#<a href="http://groups.google.de/groups?selm=\1">news:\1</a>#g;
	print OUT "<li>$_</li>\n";
    }
}
print OUT <<EOF;
</ul><HR><center><font size="-1">(c) 2003-2008 Michael Schierl</font></center>
EOF
