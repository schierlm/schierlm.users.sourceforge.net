"use strict";

const levelsets = ["Auto","Cosmonotes","Cosmopoly","Extra","Grigr2001","Grigr2002","GrigrComet","GrigrSpecial","GrigrStar","LOMA","Mas Microban","Mas Sasquatch","Microban","Microban III","Microcosmos","Minicosmos","Nabokosmos","Original","Picokosmos","Sasquatch","Sasquatch III","Sasquatch IV","Sasquatch IX","Sasquatch V","Sasquatch VI","Sasquatch VII","Sasquatch VIII","SokEvo","SokHard","Yoshio Murase"];
const levelcounts = ["52","20","22","45","100","40","26","40","29","100","135","50","155","54","40","40","40","50","20","50","50","50","18","50","50","50","50","107","163","54"];
var solvedlevels = JSON.parse(window.localStorage["solvedlevels"] || "{}");

window.onload = function() {
	var levelset = location.search.split("?")[1];
	var target = document.getElementById("levelsets");
	for(var i=0; i<levelsets.length; i++) {
		var num = i + 1;
		var tr = document.createElement("tr");
		var solvedcount = (solvedlevels[num] || []).length;
		var td = document.createElement("td");
		var t = td;
		tr.appendChild(td);
		if (num == levelset) {
			t = document.createElement("b");
			td.appendChild(t);
		} else {
			var a = document.createElement("a");
			a.href="index.html?" + num;
			td.appendChild(a);
			t = a;
			if (solvedcount == 0) {
				t = document.createElement("b");
				a.appendChild(t);
			}
		}
		t.appendChild(document.createTextNode(levelsets[i]));
		var td = document.createElement("td");
		var t = td;
		tr.appendChild(td);
		if (solvedcount < levelcounts[i]) {
			t = document.createElement("b");
			td.appendChild(t);
		}
		t.appendChild(document.createTextNode(solvedcount+"/"+levelcounts[i]));
		target.appendChild(tr);
	}
	if (levelset !== undefined) {
		document.getElementById("levelselect").style.display = "";
		document.getElementById("another").style.display = "";
		document.getElementById("levelsetname").innerText = levelsets[levelset - 1];
		fetch("levelsets/"+levelset+".json").then(r => r.json()).then(json => {
			document.getElementById("levelsetdesc").innerHTML = json.d.join('<br/>');
			var target = document.getElementById("levels");
			let solved = solvedlevels[levelset] || [];
			for(var i=0; i < json.l.length; i += 2) {
				var num = i / 2 + 1;
				var issolved="No";
				var wrapper="b";
				if (solved.includes(num)) {
					issolved = "Yes";
					wrapper = "span";
				}
				var tr = document.createElement("tr");
				var td = document.createElement("td");
				tr.appendChild(td);
				var t = document.createElement(wrapper);
				td.appendChild(t);
				t.appendChild(document.createTextNode(num));
				td = document.createElement("td");
				tr.appendChild(td);
				var a = document.createElement("a");
				a.href = "play.html#" + json.l[i + 1] + "," + levelset +","+ num + "#" + json.l[i];
				td.appendChild(a);
				t = document.createElement(wrapper);
				a.appendChild(t);
				t.appendChild(document.createTextNode(json.l[i]));
				td = document.createElement("td");
				tr.appendChild(td);
				t = document.createElement(wrapper);
				td.appendChild(t);
				t.appendChild(document.createTextNode(issolved));
				target.appendChild(tr);
			}
		});
	}
	document.getElementById("saveexport").onclick = function() {
		var localSaveAnchor = document.getElementById("localsaveanchor");
		localSaveAnchor.href = URL.createObjectURL(new Blob([JSON.stringify(solvedlevels)],{type: "application/octet-stream"}));
		localSaveAnchor.click();
		URL.revokeObjectURL(localSaveAnchor.href);
		localSaveAnchor.removeAttribute("href");
	};
	var sel = document.getElementById("saveimportsel");
	document.getElementById("saveimport").onclick = function() {
		sel.value = "";
		sel.click();
	};
	sel.onchange = function() {
		var reader = new FileReader();
		reader.onloadend = function(evt) {
			var json = JSON.parse(new TextDecoder().decode(evt.target.result));
			window.localStorage["solvedlevels"] = JSON.stringify(json);
			location.reload();
		};
		reader.readAsArrayBuffer(sel.files[0]);
	};
}