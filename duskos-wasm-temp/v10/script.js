"use strict";

let keybuf = [];
let touchedfrom = 0, touchedto = 0;
let wasm = null;
let canvasContext = null;
const diskImage = [];
let diskImageAutosaveHandle = null;
let mouseX = 0, mouseY = 0, mouseButton = 0;
let transferBuf = [];
let pasteAction = null;
const jitWasmBuilder = { data: new Uint8Array(16), offs: 0, exports: [], jitExports: [], startOffs: [], funcnames: [], failed: false, revision: 1, compiling: 0, dupes: 0, pending: {} };
let displayUpdateTimeout = null, displayUpdateTimeout2 = null;
// But... why recompile the whole module every time??!
// Try for yourself by toggling this switch.
// For me, negligible speed improvement for a noticably higher memory footprint.
const useMultipleJitModules = false;
const usingFirefox = navigator.userAgent.indexOf(" Gecko/") != -1;
const jitLogLevel = 0, maxParallelCompile = usingFirefox ? 1 : 8;
let lastJitModuleEnd = 0;
let vmopAreaStart = 0, vmopAreaEnd = 0;

const vmop_WASMWORD = 5;

const vmop_JIT_CHECK = 150;
const vmop_JIT_WAIT = 151;
const vmop_JIT_WAIT_NOP = 152;
const vmop_JIT_NOP = 153;
const vmop_JIT_RUN = 154;
const vmop_JIT_CONTINUE = 155;

const KEY_ISRELEASED = 0x40000000;
const KBD_PASSTHROUGH = 0x80000000;

function getWideString(off) {
	const mem = new Uint8Array(wasm.exports.memory.buffer, 0, wasm.exports.memory.buffer.byteLength);
	let result = "";
	for (let i = 0; mem[off + i] != 0; i += 2) {
		result += String.fromCharCode(mem[off + i]);
	}
	return result;
}

function builtin_abort(message, fileName, line, column) {
	throw "ABORT " + message + " in " + getWideString(fileName) + " at " + line + ":" + column;
}

function getKey() {
	let c;
	if (keybuf.length == 0)
		c = 0;
	else {
		c = keybuf.shift();
	}
	return c >>> 0;
}

function getTicks() {
	return Date.now() | 0;
}

function diskRead(sec, dst) {
	const sector = diskImage[sec], mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
	if (sector !== undefined)
		mem.set(sector, dst);
}

function diskWrite(sec, src) {
	const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
	diskImage[sec] = new Uint8Array(mem.slice(src, src + 512));
	if (diskImageAutosaveHandle != null) {
		diskImageAutosaveHandle.createWritable().then(w => { w.write(buildImageArray().buffer).then(_ => { w.close(); }); });
	}
}

function transferOp(op, addr, len) {
	const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
	let filename = "";
	if (op > 2 && op < 6) {
		for (let i = 0; i < len; i++) {
			filename += String.fromCharCode(mem[addr + i]);
		}
	}
	switch(op) {
		case 1: // write
			transferBuf.push(mem.slice(addr, addr + len));
			return 0;
		case 2: // read
			if (transferBuf.length == 0) {
				return 0;
			} else if (transferBuf[0].length <= len) {
				mem.set(transferBuf[0], addr);
				const result = transferBuf[0].length;
				transferBuf.shift();
				return result;
			} else {
				mem.set(transferBuf[0].subarray(0, len), addr);
				transferBuf[0] = transferBuf[0].subarray(len);
				return len;
			}
		case 3: // download as file
			download(transferBuf, filename);
			transferBuf = [];
			return 0;
		case 4: // upload as file
			if (transferBuf.length > 0) {
				return 1;
			}
			const div = document.getElementById("transferinselect");
			if (div.style.display != "block") {
				div.style.display = "block";
				document.getElementById("screen").style.display = "none";
				document.getElementById("transferinname").innerText = filename;
			}
			return 0xffffffff;
		case 5: // copy to clipboard
			navigator.clipboard.writeText(filename);
			return 0;
		case 6: // retrieve from clipboard to transfer buffer
			if (transferBuf.length > 0) {
				return 1;
			}
			if (pasteAction != null) {
				return 0xffffffff;
			}
			pasteAction = function(text) {
				transferBuf.push(new TextEncoder().encode(text));
				pasteAction = null;
			};
			let deniedAction = function() {
				document.getElementById("pasteHelper").showModal();
			};
			if (navigator.clipboard.readText) {
				navigator.clipboard.readText().then(pasteAction, deniedAction);
			} else {
				deniedAction();
			}
			return 0xffffffff;
	}
}

function vidtouched(from, len) {
	if (touchedfrom == touchedto) {
		touchedfrom = from;
		touchedto = from + len - 1;
	} else {
		touchedfrom = Math.min(from, touchedfrom);
		touchedto = Math.max(from + len, touchedto);
	}
	if (displayUpdateTimeout != null) {
		clearTimeout(displayUpdateTimeout);
	}
	displayUpdateTimeout = setTimeout(displayUpdate, 50);
	if (displayUpdateTimeout2 == null)
		displayUpdateTimeout2 = setTimeout(displayUpdate, 500);
}

function displayUpdate() {
	displayUpdateTimeout2 = null;
	let from, to;
	if (touchedfrom == touchedto) {
		return;
	}
	from = touchedfrom; to = touchedto;
	touchedto = touchedfrom = 0;
	from = ((from / 2) | 0) * 2;
	to = ((to + 1) / 2 | 0) * 2;
	if (from == to) return;
	const context = canvasContext;
	const backBuffer = context.getImageData(0, 0, 1024, 512);
	const vidmem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetVidMemBase(), 1024 * 512 * 2);

	for (let i = from; i < to; i += 2) {
		const tbi1 = vidmem[i], tbi2 = vidmem[i + 1];
		const B5 = tbi1 & 0x1F;
		const G6 = (((tbi1 & 0xE0) >> 5) | ((tbi2 & 0x07) << 3)) & 0x3F;
		const R5 = (tbi2 >> 3) & 0x1F;
		const R8 = (R5 * 527 + 23) >> 6;
		const G8 = (G6 * 259 + 33) >> 6;
		const B8 = (B5 * 527 + 23) >> 6;
		backBuffer.data[i * 2] = R8;
		backBuffer.data[i * 2 + 1] = G8;
		backBuffer.data[i * 2 + 2] = B8;
		backBuffer.data[i * 2 + 3] = 255;
	}
	context.putImageData(backBuffer, 0, 0);
}

function getUint32(addr, mem) {
	return mem[addr] + (mem[addr + 1] << 8) + (mem[addr + 2] << 16) + (mem[addr + 3] << 24);
}

function getWordName(where) {
	const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
	let prefix = "";
	const len = mem[where - 5] & 0x3f;
	let name = String.fromCharCode.apply(null, mem.slice(where - 5 - len, where - 5));
	if (!/^[!-~]+$/.test(name)) name = "<unknown>";
	return prefix + name;
}

function jitchk(where) {
	const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
	doJitCheck(where, mem);
}

// can be overridden by jit.js
function doJitCheck(where, mem) {
	mem[where] = vmop_JIT_NOP;
	if (jitLogLevel >= 15) {
		console.log("JIT check for " + getWordName(where));
	}
}

function jitwait(where) {
	const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
	mem[where] = vmop_JIT_WAIT_NOP;
	jitWasmBuilder.revision++;
	updateJitWasm();
}

function jitrun(where, w, state) {
	if (jitWasmBuilder.failed)
		throw "WASM compilation has failed";
	return (jitWasmBuilder.jitExports[where])(w, state);
}

function jitvmoparea(addr, size) {
	vmopAreaStart = addr;
	vmopAreaEnd = addr + size;
}

function nativehint(where) {
	const nname = nativeName(where);
	delete jitWasmBuilder.exports[where];
	jitWasmBuilder.pending[nname] = -1;
}

function nativechk(where) {
	if (jitWasmBuilder.failed)
		throw "WASM compilation has failed";
	if (jitWasmBuilder.exports[where])
		return true;
	const nname = nativeName(where);
	if (jitWasmBuilder.pending[nname] !== undefined) {
		if (jitWasmBuilder.pending[nname] == -1) {
			jitWasmBuilder.revision++;
			const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
			for (const key in jitWasmBuilder.pending) {
				if (jitWasmBuilder.pending[key] == -1) {
					const hint = parseInt(key.substring(1), 16);
					if (mem[hint] == vmop_WASMWORD) {
						const wasmArray = [1, 3, 0x7F]; // L2 to L4 are u32
						const length = mem[hint + 1] + mem[hint + 2] * 0x100;
						wasmArray.push(...mem.slice(hint + 3, hint + 3 + length));
						wasmArray.push(0x20, 0x00, 0x0f); // return L0
						appendSubWasmFunction(nativeName(hint), wasmArray);
						jitWasmBuilder.pending[key] = jitWasmBuilder.revision;
					} else {
						console.warn("Hinted WASM block at " + hint + " has been overwritten before being compiled");
					}
				}
			}
			updateJitWasm();
		}
		return false;
	}
	if (jitWasmBuilder.funcnames.indexOf(nname) == -1 || !(jitWasmBuilder.exports[where]))
		throw "Trying to invoke native function at " + where + " which has never been hinted";
	return true;
}

function nativerun(where, w, state) {
	if (jitWasmBuilder.failed)
		throw "WASM compilation has failed";
	w = (jitWasmBuilder.exports[where])(w, state);
	return w;
}

function nativeName(where) {
	const suffix = where.toString(16);
	return "f0000000".substring(0, 8 - suffix.length) + suffix;
}

function mappedKey(e) {
	const code = e.keyCode;
	if (code === 46) { // Delete
		e.preventDefault();
		return 0xa4;
	} else if (code === 45) { // Insert
		e.preventDefault();
		return 0xa3;
	} else if (code === 38) { // Up
		e.preventDefault();
		return 0xab;
	} else if (code === 40) { // Down
		e.preventDefault();
		return 0xac;
	} else if (code === 37) { // Left
		e.preventDefault();
		return 0xa9;
	} else if (code === 39) { // Right
		e.preventDefault();
		return 0xaa;
	} else if (code === 45) { // Insert
		e.preventDefault();
		return 0xa3;
	} else if (code === 36) { // Home
		e.preventDefault();
		return 0xa6;
	} else if (code === 35) { // End
		e.preventDefault();
		return 0xa7;
	} else if (code === 33) { // Page up
		e.preventDefault();
		return 0xa7;
	} else if (code === 34) { // Page down
		e.preventDefault();
		return 0xa8;
	} else if (code >= 112 && code <= 115) { // F1-F4
		e.preventDefault();
		return code - 112 + 0x81;
	} else if (code == 16 && e.location == 1) { // left Shift
		return 0x10000;
	} else if (code == 16 && e.location == 2) { // right Shift
		return 0x20000;
	} else if (code == 17 && e.location == 1) { // left Ctrl
		return 0x40000;
	} else if (code == 17 && e.location == 2) { // right Ctrl
		return 0x80000;
	} else if (code == 18 && e.location == 1) { // left Alt
		return 0x100000;
	} else if (code == 18 && e.location == 2) { // right Alt
		return 0x200000;
	}
	return 0;
}

window.onload = function () {
	const canvas = document.getElementById("screen");
	canvas.onkeydown = function (e) {
		const code = e.keyCode;
		if (code === 8 || code === 27 || code === 9) { // Backspace, Escape, Tab
			e.preventDefault();
			keybuf.push(code | KBD_PASSTHROUGH);
		} else {
			const mapped = mappedKey(e);
			if (mapped != 0) {
				keybuf.push(mapped);
			}
		}
	};
	canvas.onkeyup = function (e) {
		const mapped = mappedKey(e);
		if (mapped != 0) {
			keybuf.push(mapped | KEY_ISRELEASED);
		}
	};
	canvas.onkeypress = function (e) {
		if (e.charCode !== 0) {
			e.preventDefault();
			if (e.charCode < 128)
				keybuf.push(e.charCode | KBD_PASSTHROUGH);
			else
				keybuf.push((e.charCode + 1024) | KBD_PASSTHROUGH);
		}
	};
	canvasContext = canvas.getContext("2d", { willReadFrequently: true });
	const updateMouse = function () {
		if (wasm !== null) wasm.exports.movemouse(mouseX, mouseY, mouseButton);
	};
	const btn = function (e) {
		if (e.button == 0) return 1;
		if (e.button == 2) return 2;
		if (e.button == 1) return 4;
		return 0;
	};
	canvas.onmousedown = function (e) {
		mouseButton |= btn(e); updateMouse();
	};
	canvas.onmouseup = function (e) {
		mouseButton &= ~btn(e); updateMouse();
	};
	canvas.onmousemove = function (e) {
		mouseX = Math.min(Math.max(e.offsetX, 0), canvas.width - 1);
		mouseY = Math.min(Math.max(e.offsetY, 0), canvas.height - 1);
		updateMouse();
	};
	canvas.oncontextmenu = function(e) {e.preventDefault();}
	document.getElementById("saveicon").onclick = function (e) {
		if (e.ctrlKey) {
			download([buildJitWasm(0, jitWasmBuilder.funcnames.length)], "duskos-jit.wasm");
		} else {
			download([buildImageArray()], "duskos-wasm.img");
		}
	};

	const transferinfile = document.getElementById("transferinfile");
	transferinfile.onchange = function() {
		const transferinFiles = transferinfile.files;
		if (transferinFiles === null || transferinFiles.length != 1)
			return;

		const transferInReader = new FileReader();
		transferInReader.onload = function () {
			transferBuf.push(new Uint8Array(this.result));
			document.getElementById("transferinselect").style.display = "none";
			canvas.style.display="block";
			canvas.focus();
		};
		transferInReader.readAsArrayBuffer(transferinFiles[0]);
		transferinfile.value = "";
	};

	document.getElementById("pasteHelperBox").addEventListener("paste", function(e) {
		e.preventDefault();
		e.stopPropagation();
		document.getElementById("pasteHelper").close();
		pasteAction(e.clipboardData.getData("text"));
	});

	if (location.protocol != "file:") {
		if (document.location.search == "?byoDisk") {
			fetch("kernel.wasm").then(r => r.arrayBuffer()).then(b => { pickDiskImage(b, false); });
		} else {
			Promise.all([fetch("wasm.img"), fetch("kernel.wasm")])
				.then(responses => Promise.all([responses[0].arrayBuffer(), responses[1].arrayBuffer()]))
				.then(buffers => { startRun(buffers[0], buffers[1]); });
		}
	} else {
		const wasmfile = document.getElementById("wasmfile");
		const wasmselect = document.getElementById("wasmselect");
		wasmfile.onchange = function () {
			const wasmFiles = wasmfile.files;
			if (wasmFiles === null || wasmFiles.length != 1)
				return;
			wasmselect.style.display = "none";
			pickDiskImage(wasmFiles[0], true);
		};
		wasmselect.style.display = "block";
	}
};

function pickDiskImage(wasmBufferOrFile, autoclick) {
	const diskimg = document.getElementById("diskimg");
	const diskselect = document.getElementById("diskselect");
	diskselect.style.display = "block";
	diskimg.onchange = function () {
		const diskFiles = diskimg.files;
		if (diskFiles === null || diskFiles.length != 1)
			return;
		diskselect.style.display = "none";
		loadAndStart(diskFiles[0], wasmBufferOrFile);
	};
	if ('showOpenFilePicker' in window) {
		const diskaccess = document.getElementById("diskaccess");
		diskaccess.style.display = "block";
		diskaccess.onclick = function () {
			window.showOpenFilePicker({ types: [{ accept: { 'application/x-disk-image': '.img' } }] }).then(handles => {
				if (handles.length != 1) return;
				const handle = handles[0];
				handle.requestPermission({ mode: "readwrite" }).then(status => {
					if (status == "granted") {
						diskselect.style.display = "none";
						diskImageAutosaveHandle = handle;
						handle.getFile().then(f => { loadAndStart(f, wasmBufferOrFile); });
					}
				});
			});
		};
	} else if (autoclick) {
		diskimg.click();
	}
}

function loadAndStart(diskImageBufferOrFile, wasmBufferOrFile) {
	if (diskImageBufferOrFile instanceof File) {
		const diskReader = new FileReader();
		diskReader.onload = function () {
			loadAndStart(this.result, wasmBufferOrFile);
		};
		diskReader.readAsArrayBuffer(diskImageBufferOrFile);
	} else if (wasmBufferOrFile instanceof File) {
		const wasmReader = new FileReader();
		wasmReader.onload = function () {
			startRun(diskImageBufferOrFile, this.result);
		};
		wasmReader.readAsArrayBuffer(wasmBufferOrFile);
	} else {
		startRun(diskImageBufferOrFile, wasmBufferOrFile);
	}
}

function startRun(diskImageBuffer, wasmBuffer) {
	for (let i = 0; i < diskImageBuffer.byteLength; i += 512) {
		diskImage[i / 512] = new Uint8Array(new Uint8Array(diskImageBuffer, i, 512));
	}

	const file = document.getElementById("wasmfile");
	if (file.files === null) return;
	WebAssembly.compile(wasmBuffer).then(module => {
		WebAssembly.instantiate(module, wasmImports).then(instance => {
			wasm = instance;
			wasm.exports.initrun();
			const bootMem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase() + 0xF00000, 0x100000);
			for (let i = 0; ; i++) {
				bootMem.set(diskImage[i + 1], i * 512);
				if (diskImage[i + 1][511] == 0)
					break;
			}
			document.getElementById("iconbar").style.display = "block";
			document.getElementById("screen").style.display = "block";
			document.getElementById("screen").focus();
			setTimeout(continueRun, 100);
		});
	});
}

function continueRun() {
	const timeout = wasm.exports.contrun() ? 100 : 1;
	setTimeout(continueRun, timeout);
}

function appendSubWasm(arr) {
	while (jitWasmBuilder.data.length < jitWasmBuilder.offs + arr.length) {
		const newData = new Uint8Array(jitWasmBuilder.data.length * 2);
		newData.set(jitWasmBuilder.data, 0);
		jitWasmBuilder.data = newData;
	}
	jitWasmBuilder.data.set(arr, jitWasmBuilder.offs);
	jitWasmBuilder.offs += arr.length;
}

function appendSubWasmFunction(name, data) {
	if (name.length != 8) throw "Name length " + name + " is not 8";
	for (let i = 0; i < jitWasmBuilder.funcnames.length; i++) {
		if (jitWasmBuilder.funcnames[i] == name) {
			jitWasmBuilder.dupes++;
			const suffix = "" + jitWasmBuilder.dupes;
			const dupename = "d0000000".substring(0, 8 - suffix.length) + suffix;
			jitWasmBuilder.funcnames[i] = dupename;
		}
	}
	jitWasmBuilder.funcnames.push(name);
	jitWasmBuilder.startOffs.push(jitWasmBuilder.offs);
	appendSubWasm(LEB128(data.length + 1));
	appendSubWasm(data);
	appendSubWasm([0x0b]);
}

function LEB128(n) {
	const result = [];
	while (n > 127) {
		result.push(128 + (n % 128));
		n >>= 7;
	}
	result.push(n);
	return result;
}

function buildJitWasm(firstFunc, funccount) {
	const startOffs = jitWasmBuilder.startOffs[firstFunc];
	const funccountL = LEB128(funccount);
	const codeSectionLength = LEB128(jitWasmBuilder.offs - startOffs + funccountL.length);
	const functionSectionLength = LEB128(funccount + funccountL.length);
	let exportSectionBodyLength = funccount * 10;
	for (let i = 0; i < funccount; i++) {
		exportSectionBodyLength += LEB128(i + 1).length;
	}
	const exportSectionLength = LEB128(exportSectionBodyLength + funccountL.length);
	const arr = new Uint8Array(39 + funccountL.length + functionSectionLength.length + funccount + 1 + exportSectionLength.length + funccountL.length + exportSectionBodyLength + 1 + funccountL.length + codeSectionLength.length + jitWasmBuilder.offs - startOffs);
	arr.set([
		0, "a".charCodeAt(0), "s".charCodeAt(0), "m".charCodeAt(0), // signature
		1, 0, 0, 0, // version
		1, 7, 1, // type section of size 7 containing 1 type
		0x60, 2, 0x7f, 0x7f, 1, 0x7f, // function (u32, u32): u32
		2, 19, 2, // import section of size 19 containing 2 imports
		1, "x".charCodeAt(0), 4, "r".charCodeAt(0), "s".charCodeAt(0), "s".charCodeAt(0), "w".charCodeAt(0), // name "x.rssw"
		0, 0, // function of type 0
		1, "x".charCodeAt(0), 3, "m".charCodeAt(0), "e".charCodeAt(0), "m".charCodeAt(0), // name "x.mem"
		2, 0, 1, // memory with minimum size 1 page
		3  // function section of size <functionSectionLength> with <FUNCCOUNT> functions
	], 0);
	arr.set(functionSectionLength, 39);
	let offs = 39 + functionSectionLength.length;
	arr.set(funccountL, offs); offs += funccountL.length,
		arr.fill(0, offs, offs + funccount); // all functions use the same type
	offs += funccount;
	arr[offs] = 7; // export section of size <exportSectionBodyLength> containing <FUNCCOUNT> exports
	offs++;
	arr.set(exportSectionLength, offs); offs += exportSectionLength.length;
	arr.set(funccountL, offs); offs += funccountL.length;
	for (let i = 0; i < funccount; i++) {
		arr.set([8, jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(0),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(1),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(2),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(3),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(4),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(5),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(6),
			jitWasmBuilder.funcnames[i + firstFunc].charCodeAt(7),
			0], offs); offs += 10;
		const iL = LEB128(i + 1);
		arr.set(iL, offs); offs += iL.length;
	}
	arr[offs] = 10; offs++;
	arr.set(codeSectionLength, offs);
	offs += codeSectionLength.length;
	arr.set(funccountL, offs); offs += funccountL.length;
	arr.set(jitWasmBuilder.data.slice(startOffs, jitWasmBuilder.offs), offs);
	offs += jitWasmBuilder.offs - startOffs;
	if (offs != arr.length) throw "Length mismatch";
	return arr;
}

function updateJitWasm() {
	const thatFunctionCounter = jitWasmBuilder.funcnames.length;
	const arr = buildJitWasm(lastJitModuleEnd, thatFunctionCounter - lastJitModuleEnd);
	const thatRevision = jitWasmBuilder.revision;
	if (jitWasmBuilder.compiling >= maxParallelCompile) {
		waitCompileWasm(arr, thatRevision);
	} else {
		compileWasm(arr, thatRevision);
	}
}

function waitCompileWasm(arr, thatRevision) {
	if (jitWasmBuilder.compiling >= maxParallelCompile) {
		setTimeout(function () { waitCompileWasm(arr, thatRevision); }, 100);
	} else {
		compileWasm(arr, thatRevision);
	}
}

function compileWasm(arr, thatRevision) {
	jitWasmBuilder.compiling++;
	WebAssembly.compile(arr).then(module => {
		WebAssembly.instantiate(module, { "x": { "mem": wasm.exports.memory, "rssw": wasm.exports.runSafeSimpleWord } }).then(instance => {
			jitWasmBuilder.compiling--;
			const mem = new Uint8Array(wasm.exports.memory.buffer, wasm.exports.GetMemBase(), 0x1000000);
			for (const name in instance.exports) {
				if (name.startsWith("f")) {
					jitWasmBuilder.exports[parseInt(name.substring(1), 16)] = instance.exports[name];
				} else if (name.startsWith("j")) {
					const where = parseInt(name.substring(1), 16);
					jitWasmBuilder.jitExports[where] = instance.exports[name];
					if (mem[where] == vmop_JIT_WAIT || mem[where] == vmop_JIT_WAIT_NOP)
						mem[where] = vmop_JIT_RUN;
				}
			}
			if (useMultipleJitModules)
				lastJitModuleEnd = thatFunctionCounter;
			for (const key in jitWasmBuilder.pending) {
				if (jitWasmBuilder.pending[key] == thatRevision) {
					delete jitWasmBuilder.pending[key];
				}
			}
		}).catch(e => {
			jitWasmBuilder.failed = true;
			throw e;
		});
	}).catch(e => {
		jitWasmBuilder.failed = true;
		if (usingFirefox && e == "out of memory") {
			document.getElementById("firefoxbug").style.display = "block";
		}
		throw e;
	});
}

function buildImageArray() {
	const imageArray = new Uint8Array(512 * diskImage.length);
	for (let i = 0; i < diskImage.length; i++) {
		imageArray.set(diskImage[i], i * 512);
	}
	return imageArray;
}

function download(arrays, filename) {
	const blob = new Blob(arrays, {
		type: "application/octet-stream"
	});
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.style.display = "none";
	document.body.appendChild(a);
	a.click();
	a.remove();
}

const wasmImports = {
	"env": { "abort": builtin_abort },
	"kernel": {
		"vidtouched": vidtouched,
		"getKey": getKey,
		"getTicks" : getTicks,
		"diskRead": diskRead,
		"diskWrite": diskWrite,
		"transferOp" : transferOp,
		"jitchk": jitchk,
		"jitwait": jitwait,
		"jitrun": jitrun,
		"jitvmoparea": jitvmoparea,
		"nativehint": nativehint,
		"nativechk": nativechk,
		"nativerun": nativerun
	}
};
