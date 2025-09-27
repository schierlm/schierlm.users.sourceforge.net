<?php
#
# (c) 2009 Michael Schierl
# Licensed under GNU GPL v2 or later
#
?>

table#playground {
	border: 2px solid black;
}

table#playground, table#playground table {
	border-collapse: collapse;
}
table#playground td, table#playground td table td {
	padding: 0px;
	border: none;
	overflow: hidden;
}

/* generated styles */
<?php
$leftfields = Array(
	"field0", "field1", 
	"field2", "field3", 
	"field6", "field7"
);
$rightfields = Array(
	"platform","vertical",
	"horizontal", "cross",
	"isolated", null
);

for($size = 8; $size <= 32; $size += 8) {
	echo "table#playground.size".$size." td.field { width: ".$size."; height: ".$size."; background-image: url(".$size."x".$size.".png); }\n";
	echo "table#playground.size".$size." td.field4 { background-image: none; }\n";
	for($i = 0; $i < 6; $i++) {
		$xpos = ($i % 2) * $size;
		$ypos = floor($i / 2) * $size;
		echo "table#playground.size".$size." td.".$leftfields[$i]." { background-position: -".$xpos."px -".$ypos."px; }\n";
	}
	$size2 = $size / 2;
	echo "table#playground.size".$size." td.field4 td.wallcorner { width: ".$size2."; height: ".$size2."; background-image: url(".$size."x".$size.".png); }\n";
	for($i = 0; $i < 6; $i++) {
		$xposbase = (2 + $i % 2) * $size;
		$yposbase = floor($i / 2) * $size;
		for($j = 0; $j < 4; $j++) {
			$xpos = $xposbase + ($j % 2) * $size2;
			$ypos = $yposbase + floor($j / 2) * $size2;
			echo "table#playground.size".$size." td.field4 td.".$rightfields[$i].$j." { background-position: -".$xpos."px -".$ypos."px; }\n";
		}
	}
}
?>
/* end generated styles */
