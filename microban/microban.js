var moveHistory = [];

function drawCorner(x, y, dx, dy, cls) {
	var here = field.charAt(x + y * width) == '4';
	var above = y+dy >= 0 && y + dy < height && field.charAt(x + (y + dy) * width) == '4';
	var left = x+dx >= 0 && x + dx < width && field.charAt((x + dx) + y * width) == '4';
	var diagonal = x+dx >= 0 && x + dx < width && y+dy >= 0 && y + dy < height && field.charAt((x + dx) + (y + dy) * width) == '4';
	var kind;
	if (!above && !left) {
		kind="isolated";
	} else if (above && !left) {
		kind="vertical";
	} else if (left && ! above) {
		kind = "horizontal";
	} else if (left && above && !diagonal) {
		kind = "cross";
	} else {
		kind = "platform";
	}
	return '<td class="wallcorner ' + kind + cls +'"></td>';
}

function drawField() {
	var html = '';
	for(var i = 0; i < height; i++) {
		html += '<tr>';
		for(var j = 0; j < width; j++) {
			var cc = field.charAt(i * width + j);
			if (playerx == j && playery == i) {
				if (cc == '0') cc = '6';
				else if (cc == '1') cc = '7';
				else html+="***Unsupported player position ***";
			}
			var inner = '';
			if (cc == '4') { // build fancy walls
				inner = '<table><tr>' + drawCorner(j, i, -1, -1, 0) + drawCorner(j, i, 1, -1, 1) +
					'</tr><tr>' + drawCorner(j, i, -1, 1, 2) + drawCorner(j, i, 1, 1, 3) + '</tr></table>';
			}
			html +='<td onclick="javascript:doClick('+ j +','+ i +')" class="field field' + cc +'">'+inner+'</td>';
		}
		html += '</tr>';
	}
	document.getElementById("playground").innerHTML = html;
}

function isReachable(x, y, stack) {
	var pos = x + y * width;
	if (stack.indexOf(pos) != -1) return false;
	stack.push(pos);
	if (x == playerx && y == playery) return true;
	var ch = field.charAt(pos);
	if (ch != '0' && ch != '1') return false;
	if (x > 0 && isReachable(x-1,y,stack)) return true;
	if (x + 1 < width && isReachable(x+1,y,stack)) return true;
	if (y > 0 && isReachable(x,y-1,stack)) return true;
	if (y + 1 < height && isReachable(x,y+1,stack)) return true;
	return false;
}

function setField(x, y, ch) {
	var pos = x + y * width;
	field = field.substring(0, pos) + ch + field.substring(pos+1);
}

function doPush(ch, x, y, x2, y2) {
	var ch2 = field.charAt(x2 + y2 * width);
	if (ch2 == '0' || ch2 == '1') {
		moveHistory.push([playerx, playery, x, y, x2, y2]);
		setField(x2, y2, "" + (ch2 - -2));
		setField(x, y, "" + (ch - 2));
		playerx = x;
		playery = y;
		if (ch == '2' && ch2 == '1') {
			if (field.indexOf('2') == -1 && field.indexOf('1') == -1) {
				document.getElementById("solved").style.display="inline";
			}
		}
	}
}

function doClick(x, y) {
	var ch = field.charAt(x + y * width);
	if ((ch == '0' || ch == '1') && isReachable(x, y, [])) {
		playerx = x;
		playery = y;
	} else if (ch == '2' || ch == '3') {
		if (playerx == x) {
			if (playery == y + 1 && y > 0) {
				doPush(ch, x, y, x, y-1);
			} else if (playery == y -1 && y + 1 < height) {
				doPush(ch, x, y, x, y+1);
			}
		}
		if (playery == y) {
			if (playerx == x + 1 && x > 0) {
				doPush(ch, x, y, x-1, y);
			} else if (playerx == x - 1 && x + 1 < width) {
				doPush(ch, x, y, x+1, y);
			}
		}
	}
	drawField();
}

function setSize(newsize) {
	document.getElementById("playground").className = "size" + newsize;
}

function doUndo() {
	if (moveHistory.length > 0) {
		var item = moveHistory.pop();
		doPush(field.charAt(item[4] + item[5] * width), item[4], item[5], item[2], item[3])
		moveHistory.pop(); // the undo move
		playerx = item[0];
		playery = item[1];
		drawField();
	}
}