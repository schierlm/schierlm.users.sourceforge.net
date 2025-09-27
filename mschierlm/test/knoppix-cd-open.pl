#!/usr/bin/perl -w
open(H, "</dev/cdrom") or die("Can't open: $!");
ioctl(H, 0x5329 , 0) or die("Can't ioctl: $!");
close(H) or die("Can't close: $!");
