"use strict";

let keybuf = "";
let touchedfrom = 0, touchedto = 0;
let wasm = null;
let canvasContext = null;
const diskImage = [];
let diskImageAutosaveHandle = null;
let mouseX = 0, mouseY = 0, mouseButton = 0;
let lastTimestamp = 0;
const jitWasmBuilder = { data: new Uint8Array(16), offs: 0, exports: [], jitExports: [], startOffs: [], funcnames: [], failed: false, revision: 1, compiling: 0, dupes: 0, pending: {} };
let displayUpdateTimeout = null, displayUpdateTimeout2 = null;
// But... why recompile the whole module every time??!
// Try for yourself by toggling this switch.
// For me, negligible speed improvement for a noticably higher memory footprint.
const useMultipleJitModules = false;
const jitLogLevel = 0, maxParallelCompile = 4;
let lastJitModuleEnd = 0;
let vmopAreaStart = 0, vmopAreaEnd = 0;

const vmop_WASMWORD = 6;

const vmop_JIT_CHECK = 150;
const vmop_JIT_WAIT = 151;
const vmop_JIT_WAIT_NOP = 152;
const vmop_JIT_NOP = 153;
const vmop_JIT_RUN = 154;
const vmop_JIT_CONTINUE = 155;

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
	if (keybuf == "")
		c = -1;
	else {
		c = keybuf.charCodeAt(0);
		keybuf = keybuf.substring(1);
	}
	return c >>> 0;
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
	if (mem[where - 9] == 0x7f && (mem[where - 4] & 0xFE) == 0x10) { // code16/code8
		prefix = mem[where - 4] == 0x11 ? "<code16> of " : "<code8> of ";
		where = getUint32(where - 13, mem);
	}
	const len = mem[where - 9] & 0x3f;
	let name = String.fromCharCode.apply(null, mem.slice(where - 9 - len, where - 9));
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

window.onload = function () {
	const canvas = document.getElementById("screen");
	canvas.onkeydown = function (e) {
		const code = e.keyCode;
		if (code === 8) {
			e.preventDefault();
			keybuf += String.fromCharCode(code);
		}
	};
	canvas.onkeypress = function (e) {
		if (e.charCode !== 0) {
			e.preventDefault();
			keybuf += String.fromCharCode(e.charCode);
		}
	};
	canvasContext = canvas.getContext("2d", { willReadFrequently: true });
	const updateMouse = function () {
		if (wasm !== null) wasm.exports.movemouse(mouseX, mouseY, mouseButton);
	};
	const btn = function (e) {
		if (e.button == 1) return 1;
		if (e.button == 3) return 2;
		if (e.button == 2) return 4;
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
			download(buildJitWasm(0, jitWasmBuilder.funcnames.length), "duskos-jit.wasm");
		} else {
			download(buildImageArray(), "duskos-wasm.img");
		}
	};

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
			lastTimestamp = Date.now();
			document.getElementById("iconbar").style.display = "block";
			document.getElementById("screen").style.display = "block";
			document.getElementById("screen").focus();
			setTimeout(continueRun, 100);
		});
	});
}

function continueRun() {
	const timestamp = Date.now();
	let ticksElapsed = timestamp - lastTimestamp;
	lastTimestamp = timestamp;
	const timeout = wasm.exports.contrun(ticksElapsed) ? 100 : 1;
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
			for (var name in instance.exports) {
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

function download(array, filename) {
	const blob = new Blob([array], {
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
		"diskRead": diskRead,
		"diskWrite": diskWrite,
		"jitchk": jitchk,
		"jitwait": jitwait,
		"jitrun": jitrun,
		"jitvmoparea": jitvmoparea,
		"nativehint": nativehint,
		"nativechk": nativechk,
		"nativerun": nativerun
	}
};
