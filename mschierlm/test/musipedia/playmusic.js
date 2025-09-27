var keyboardLayouts = {
    de: "01234qwertzuiopüasdfghjklöäQWERTZUIOPÜASDFGHJKLÖÄx56789",
    us: "01234qwertyuiop[asdfghjkl;]QWERTYUIOP{ASDFGHJKL:}x56789",
    fr: "à&é\"'azertyuiop^qsdfghjklmùAZERTYUIOP¨QSDFGHJKLM%x(-è_ç"
};

var notes = 
    [{digits: "00", flats: "00",  name: "r",     keyindex: [0]},
     {digits: "01", flats: "01",  name: "c'",    keyindex: [16]},
     {digits: "02", flats: "02b", name: "cis'",  keyindex: [6]},
     {digits: "03", flats: "03",  name: "d'",    keyindex: [17]},
     {digits: "04", flats: "04b", name: "dis'",  keyindex: [7]},
     {digits: "05", flats: "05",  name: "e'",    keyindex: [18]},
     {digits: "06", flats: "06",  name: "f'",    keyindex: [19]},
     {digits: "07", flats: "07b", name: "fis'",  keyindex: [9]},
     {digits: "08", flats: "08",  name: "g'",    keyindex: [20]},
     {digits: "09", flats: "09b", name: "gis'",  keyindex: [10]},
     {digits: "10", flats: "10",  name: "a'",    keyindex: [21]},
     {digits: "11", flats: "11b", name: "ais'",  keyindex: [11]},
     {digits: "12", flats: "12",  name: "b'",    keyindex: [22]},
     {digits: "13", flats: "13",  name: "c''",   keyindex: [23,38]},
     {digits: "14", flats: "14b", name: "cis''", keyindex: [13, 28]},
     {digits: "15", flats: "15",  name: "d''",   keyindex: [24, 39]},
     {digits: "16", flats: "16b", name: "dis''", keyindex: [14, 29]},
     {digits: "17", flats: "17",  name: "e''",   keyindex: [25, 40]},
     {digits: "18", flats: "18",  name: "f''",   keyindex: [26, 41]},
     {digits: "19", flats: "19b", name: "fis''", keyindex: [31]},
     {digits: "20", flats: "20",  name: "g''",   keyindex: [42]},
     {digits: "21", flats: "21b", name: "gis''", keyindex: [32]},
     {digits: "22", flats: "22",  name: "a''",   keyindex: [43]},
     {digits: "23", flats: "23b", name: "ais''", keyindex: [33]},
     {digits: "24", flats: "24",  name: "b''",   keyindex: [44]}
     ];

var lengths= ["8", "4", "4.", "2", "32", "16", "8.", "2.", "1"];
var delays = [250, 500, 750, 1000, 62, 125, 375, 1500, 2000];

var current = [], aftercursor=[];
var kbd = keyboardLayouts.us;
var flats = false;

function setlayout() {
    kbd = keyboardLayouts[document.getElementById("layout").value];
}

function handleNote(note, add) {
    var idx = kbd.indexOf(note);
    if (kbd == -1) return false;
    for(var i=0; i< notes.length; i++) {
        for(var j=0; j< notes[i].keyindex.length; j++) {
            if(notes[i].keyindex[j] == idx) {
                if (add) {
                    play(i, 1);
                } else {
                    test(i)
                }
                return true;
            }
        }
    }
    return false;
}

function test(n) {
    soundManager.play("t"+notes[n].digits);
}

function play(n, l) {
    test(n);
    current.push({n: n, l: l});
    updateView();
}

function deleteNote() {
    if (current.length > 0) current.pop();
    updateView();
}

function updateView() {
    var s="", spos=0;
    var c = '<img src="clef.gif" onclick="setCursor(0);" />';
    for(var i=0;i<current.length;i++) {
        c+=noteImage(current[i], i+1);
        s+=noteText(current[i])+" ";
    }
    c+='<img src="cursor.gif" />';
    for(var i=0;i<aftercursor.length;i++) {
        c+=noteImage(aftercursor[i], i+1+current.length);
        s+=noteText(aftercursor[i])+" ";
    }
    document.getElementById("current").innerHTML=c;
    document.getElementById("music").value=s;
}

function noteText(note) {
    if (note.l == 0) {
        return note.name;
    } else {
        return notes[note.n].name+lengths[note.l-1];
    }
}

function handleKey(keychar) {
    if (keychar == ' ') {
        if (current.length>0) {
            var nn =current[current.length-1];
            if (nn.l<4) {
                nn.l++;
            } else {
                play(0, 1);
            }
        }
    } else if (keychar == kbd[49]) {
        deleteNote();
    } else if (keychar == kbd[1]) {
        setLength(1);
    } else if (keychar == kbd[2]) {
        setLength(2);
    } else if (keychar == kbd[3]) {
        setLength(3);
    } else if (keychar == kbd[4]) {
        setLength(4);
    } else if (keychar == kbd[50]) {
        setLength(5);
    } else if (keychar == kbd[51]) {
        setLength(6);
    } else if (keychar == kbd[52]) {
        setLength(7);
    } else if (keychar == kbd[53]) {
        setLength(8);
    } else if (keychar == kbd[54]) {
        setLength(9);
    }
    updateView();
}

function setLength(len) {
    if (current.length>0) current[current.length-1].l=len;
    updateView();
}

function noteImage(note, pos) {
    return '<img src="note/'+
        (flats ? notes[note.n].flats : notes[note.n].digits)+
        '_'+ note.l+'.gif" onclick="setCursor('+pos+');" />';
}

var playing = [];

function playAll() {
    if(playing.length==0) {
        for(var i=0; i<current.length;i++) {
            playing.push(current[i]);
        }
        for(var i=0; i<aftercursor.length; i++) {
            playing.push(aftercursor[i]);
        }
        playArray();
    } else {
        alert("Still playing!");
    }
}

function playArray() {
    if (playing.length==0) return;
    var n = playing.shift();
    if (n.l==0) {
        playArray();
    } else {
        test(n.n);
        setTimeout(playArray, delays[n.l-1]);
    }
}


function musipedia() {
    document.location.href='http://www.musipedia.org/?lily='+
        document.getElementById("music").value.replace(/ /g,"+");
}

function parse() {
    var newnotes = [];
    var nn = document.getElementById("music").value.split(/ /g);
    for(var i = 0; i< nn.length;i++) {
        if(nn[i] == "") continue;
        var found=0;
        for(var nt=0; nt<notes.length; nt++) {
            var nname = notes[nt].name;
            if (nn[i].substring(0, nname.length) == nname) {
                for (var len = 1; len <=lengths.length; len++) {
                    if (nn[i] == nname + lengths[len-1]) {
                        newnotes.push({n: nt, l:len});
                        found=1;
                        break;
                    }
                }
            }
            if (found==1) break;
        }
        if (found == 0) {
            newnotes.push({n: 0, l: 0, name: nn[i]});
        }
    }
    aftercursor = [];
    current = newnotes;
    updateView();
}

function setCursor(newpos) {
    var toadd = newpos - current.length;
    for(var i=0; i<toadd; i++) {
        current.push(aftercursor.shift());
    }
    for(var i=0; i<-toadd; i++) {
        aftercursor.unshift(current.pop());
    }
    updateView();
}

function shiftNote(diff) {
    if(current.length > 0) {
        var nn = current[current.length-1];
        if (nn.n == 0) return;
        nn.n += diff;
        if (nn.n<1) nn.n=1;
        if (nn.n>24) nn.n=24;
        test(nn.n);
        updateView();
    }
}

function setFlats() {
    flats = document.getElementById("flats").checked;
    updateView();
}

// initialization code

var kb = '<select name="layout" id="layout" onchange="setlayout()">';
for(var k in keyboardLayouts) {
    kb+='<option'+ (kbd==keyboardLayouts[k] ? ' selected="selected"':'') +'>'+k+'</option>';
}
kb+='</select>';
document.getElementById("kbdlayout").innerHTML=kb;

document.getElementById("test").onkeypress = function(evt) {
    evt = (evt) ? evt : ((event) ? event : null);
    var c = String.fromCharCode((evt.charCode != null) ? evt.charCode : evt.keyCode);
    handleNote(c, false);
    return false;
};

document.getElementById("real").onkeypress = function(evt) {
    evt = (evt) ? evt : ((event) ? event : null);
    var c = String.fromCharCode((evt.charCode != null) ? evt.charCode : evt.keyCode);
    if (!handleNote(c, true)) handleKey(c);
    return false;
};

document.getElementById("real").onkeydown = function(evt) {
    evt = (evt) ? evt : ((event) ? event : null);
    switch(evt.keyCode) {
    case 33: shiftNote(12); break;
    case 38: shiftNote(1); break;
    case 40: shiftNote(-1); break;
    case 34: shiftNote(-12); break;
    case 8: deleteNote(); break;
    case 37: if (current.length > 0) aftercursor.unshift(current.pop()); updateView(); break;
    case 39: if (aftercursor.length > 0) current.push(aftercursor.shift()); updateView(); break;
    default: return true;
    }
    return false;
}

updateView();
soundManagerInit();
