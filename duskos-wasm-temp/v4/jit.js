"use strict";

const jitPartChangesRSP = [];
const jitFunctionNeverReturns = [];

const vmop_BR = 0;
const vmop_CALL = 1;
const vmop_RET = 2;
const vmop_BRA = 3;
const vmop_BRC = 4;
// already declared: const vmop_WASMWORD = 5;
const vmop_RSP_META = 6;
const vmop_COMPOP = 7;
const vmop_COMPBINOP = 8;
const vmop_WRITECOPY = 9;
const vmop_CELL = 10;

const rspmeta_ANYTHING = 0xffffffff | 0;
const rspmeta_ADD = 0x01000000;
const rspmeta_ACCESS = 0x02000000;
const rspmeta_PRE_ACCESS = 0x04000000;

function LEB128s(n) {
    const result = [];
    while (n > 63 || n < -64) {
        result.push(128 + ((n >>> 0) % 128));
        n >>= 7;
    }
    result.push(n);
    return result;
}

/** Return error string, or null if successful. */
function doJit(where, mem) {
    const segments = {};
    const pendingOffsets = [{ o: 1, rsp: 0 }];
    let rspAnyChange = false, rspOffsetMismatch = false, rspMaxAccess = -4;
    while (pendingOffsets.length > 0) {
        const offsetData = pendingOffsets.shift();
        const offset = offsetData.o;
        let rspOffset = offsetData.rsp;
        if (offset == -1) {
            if (rspOffset != 0)
                rspOffsetMismatch = true;
            continue;
        }
        if (segments[offset] !== undefined) {
            if (rspOffset != segments[offset].rspOffset)
                rspOffsetMismatch = true;
            continue;
        }
        const segment = { start: offset, rspOffset: rspOffset, next: offset, code: [] };
        segments[offset] = segment;
        switch (mem[where + offset]) {
            case vmop_BR:
                segment.next = getUint32(where + offset + 1, mem) - where;
                if (segment.next <= 0) return "Branch beyond start of word";
                break;
            case vmop_CALL:
                segment.next = offset + 5;
                const callTarget = getUint32(where + offset + 1, mem);
                if (mem[callTarget] == vmop_JIT_CHECK) {
                    jitchk(callTarget);
                }
                if (jitFunctionNeverReturns[callTarget])
                    return "Calls a function that never returns (messes with RSP)";
                let useEmulation = false;
                if (mem[callTarget] == vmop_JIT_RUN || mem[callTarget] == vmop_JIT_WAIT || mem[callTarget] == vmop_JIT_WAIT_NOP) {
                    const wordIndex = jitWasmBuilder.funcnames.indexOf("j" + nativeName(callTarget).substring(1));
                    if (wordIndex == -1)
                        throw "JITed word " + getWordName(callTarget) + " does not appear in funcnames";
                    if (jitPartChangesRSP[callTarget] === undefined) {
                        throw "JITed word " + getWordName(callTarget) * " does not declare ChangesRSP";
                    }
                    if (jitPartChangesRSP[callTarget]) {
                        if (jitLogLevel >= 5) {
                            console.log("Emulated call from " + getWordName(where) + " to " + getWordName(callTarget) + " which messes with RSP or contains emulated calls");
                        }
                        useEmulation = true;
                    } else {
                        segment.code = [
                            new Uint8Array([
                                0x20, 0, // local.get 0
                                0x20, 1, // local.get 1
                                0x10, // call <wordIndex>
                            ]), LEB128(wordIndex + 1), new Uint8Array([
                                0x21, 0, // local.set 0
                            ])
                        ];
                    }
                } else {
                    if (mem[callTarget] == vmop_JIT_NOP) {
                        if (jitLogLevel >= 5)
                            console.log("Emulated call from " + getWordName(where) + " to " + getWordName(callTarget) + " which cannot be JITed");
                    } else if (mem[callTarget] != vmop_JIT_RUN && mem[callTarget] != vmop_JIT_WAIT && mem[callTarget] != vmop_JIT_WAIT_NOP) {
                        if (jitLogLevel >= 3)
                            console.log("Emulated call from " + getWordName(where) + " to " + getWordName(callTarget) + " due to missing word mark");
                    }
                    useEmulation = true;
                }
                if (useEmulation) {
                    segment.vmops = [mem.slice(where + offset, where + offset + 5)];
                }
                break;
            case vmop_RET:
                segment.next = -1;
                segment.code = [new Uint8Array([
                    0x20, 1, //local.get 1
                    0x41, 4 * 4, // i32.const state.T (4 * 4)
                    0x6A, // i32.add
                    0x41, 0, // i32.const 0
                    0x36, 0, 0, // i32.store
                    0x20, 0, // local.get 0
                    0x0f // ret
                ])];
                break;
            case vmop_BRC:
                segment.next = offset + 5;
                segment.condNext = getUint32(where + offset + 1, mem) - where;
                segment.code = [new Uint8Array([
                    0x20, 1, // local.get 1
                    0x41, 4 * 4, // i32.const state.T (4 * 4)
                    0x6A, // i32.add
                    0x28, 0, 0 // i32.load
                ])];
                if (segment.condNext < 0) return "Conditional branch beyond start of word";
                pendingOffsets.push({ o: segment.condNext, rsp: rspOffset });
                break;
            case vmop_BRA:
                if (jitLogLevel >= 5)
                    console.log("Emulated indirect call to Register A " + getWordName(where));
                segment.next = -1;
                segment.vmops = [mem.slice(where + offset, where + offset + 1)];
                break;
            case vmop_RSP_META:
                let rspmeta = getUint32(where + offset + 1, mem);
                if (rspmeta == rspmeta_ANYTHING) {
                    rspAnyChange = true;
                } else if ((rspmeta & 0xFF000000) == rspmeta_ACCESS) {
                    const accessedOffset = rspOffset + ((rspmeta << 8) >> 8);
                    if (accessedOffset > rspMaxAccess) rspMaxAccess = accessedOffset;
                } else if ((rspmeta & 0xFF000000) == rspmeta_ADD) {
                    rspOffset += (rspmeta << 8) >> 8;
                } else if ((rspmeta & 0xFF000000) == (rspmeta_ADD | rspmeta_ACCESS)) {
                    rspOffset += (rspmeta << 8) >> 8;
                    if (rspOffset > rspMaxAccess) rspMaxAccess = rspOffset;
                } else if ((rspmeta & 0xFF000000) == (rspmeta_ADD | rspmeta_PRE_ACCESS)) {
                    if (rspOffset > rspMaxAccess) rspMaxAccess = rspOffset;
                    rspOffset += (rspmeta << 8) >> 8;
                } else {
                    throw "Unsupported RSP metadata: " + rspmeta;
                }
                segment.next = offset + 5;
                break;
            case vmop_WASMWORD:
                const len = mem[where + offset + 1] + (mem[where + offset + 2] << 8);
                segment.next = offset + 3 + len;
                segment.code = [mem.slice(where + offset + 3, where + offset + 3 + len)];
                break;
            case vmop_CELL:
                // CELL pushes RSP top, therefore it returns somewhere different
                jitFunctionNeverReturns[where] = true;
                return "Unsupported opcode CELL";
            default:
                return "Unsupported opcode " + mem[where + offset];
        }
        pendingOffsets.push({ o: segment.next, rsp: rspOffset });
    }

    let done = false;
    while (!done) {
        done = true;
        for (const offs in segments) {
            segments[offs].prevCount = 0;
        }
        segments[1].prevCount = 1;
        for (const offs in segments) {
            if (segments[offs].next != -1) {
                segments[segments[offs].next].prevCount++;
            }
            if (segments[offs].condNext !== undefined) {
                segments[segments[offs].condNext].prevCount++;
            }
        }
        for (const offs in segments) {
            const next = segments[offs].next;
            if (next != -1 && segments[offs].vmops === undefined && segments[next].vmops === undefined && segments[offs].condNext === undefined && segments[next].prevCount == 1) {
                segments[offs].code.push(...segments[next].code);
                segments[offs].next = segments[next].next;
                segments[offs].condNext = segments[next].condNext;
                delete segments[next];
                done = false;
                break;
            } else if (next != -1 && segments[offs].vmops !== undefined && segments[next].vmops !== undefined && segments[next].prevCount == 1) {
                segments[offs].vmops.push(...segments[next].vmops);
                segments[offs].next = segments[next].next;
                segments[offs].condNext = segments[next].condNext;
                delete segments[next];
                done = false;
                break;
            } else if (segments[offs].condNext !== undefined && segments[offs].next != segments[offs].condNext) {
                const condNext = segments[offs].condNext;
                if (condNext == offs || next == offs) {
                    segments[offs].code.unshift(new Uint8Array([
                        0x03, 0x40 // loop
                    ]));
                    if (next == offs) { // loop if condition is false
                        segments[offs].next = condNext;
                        segments[offs].code.push(new Uint8Array([
                            0x45 // i32.eqz
                        ]));
                    }
                    segments[offs].code.push(new Uint8Array([
                        0x0D, 0x00, // br_if 0 (continue innermost loop if condition is true)
                        0x0B // end
                    ]));
                    segments[offs].condNext = undefined;
                    done = false;
                    break;
                } else if (segments[next].next == offs && segments[next].condNext === undefined && segments[next].vmops === undefined && segments[next].prevCount == 1) {
                    segments[offs].code.unshift(new Uint8Array([
                        0x02, 0x40, // block
                        0x03, 0x40 // loop
                    ]));
                    segments[offs].code.push(new Uint8Array([
                        0x0D, 0x01, // br_if 1 (break block if condition is true)
                    ]), ...segments[next].code, new Uint8Array([
                        0x0C, 0x00, // br 0 (continue innermost loop unconditionally)
                        0x0B, // end (loop)
                        0x0B // end (block)
                    ]));
                    segments[offs].next = condNext;
                    segments[offs].condNext = undefined;
                    delete segments[next];
                    done = false;
                    break;
                } else if (segments[condNext].next == offs && segments[condNext].condNext === undefined && segments[condNext].vmops === undefined && segments[condNext].prevCount == 1) {
                    segments[offs].code.unshift(new Uint8Array([
                        0x02, 0x40, // block
                        0x03, 0x40 // loop
                    ]));
                    segments[offs].code.push(new Uint8Array([
                        0x45, // i32.eqz
                        0x0D, 0x01, // br_if 1 (break block if condition is true)
                    ]), ...segments[condNext].code, new Uint8Array([
                        0x0C, 0x00, // br 0 (continue innermost loop unconditionally)
                        0x0B, // end (loop)
                        0x0B // end (block)
                    ]));
                    segments[offs].condNext = undefined;
                    delete segments[condNext];
                    done = false;
                    break;
                } else if (segments[next].next != -1 && segments[next].next == segments[condNext].next && segments[next].prevCount == 1 && segments[condNext].prevCount == 1 && segments[next].vmops === undefined && segments[next].condNext === undefined && segments[condNext].vmops === undefined && segments[condNext].condNext === undefined) {
                    segments[offs].code.push(new Uint8Array([
                        0x04, 0x40 // if
                    ]), ...segments[condNext].code, new Uint8Array([
                        0x05 // else
                    ]), ...segments[next].code, new Uint8Array([
                        0x0B // end
                    ]));
                    segments[offs].next = segments[next].next;
                    segments[offs].condNext = undefined;
                    delete segments[next];
                    delete segments[condNext];
                    done = false;
                    break;
                } else if (segments[next].next == condNext && segments[next].prevCount == 1 && segments[condNext].prevCount == 2 && segments[next].condNext === undefined && segments[next].vmops === undefined) {
                    segments[offs].code.push(new Uint8Array([
                        0x45, // i32.eqz
                        0x04, 0x40 // if
                    ]), ...segments[next].code, new Uint8Array([
                        0x0B // end
                    ]));
                    segments[offs].next = condNext;
                    segments[offs].condNext = undefined;
                    delete segments[next];
                    done = false;
                    break;
                } else if (segments[condNext].next == next && segments[condNext].prevCount == 1 && segments[next].prevCount == 2 && segments[condNext].vmops === undefined && segments[condNext].condNext === undefined) {
                    segments[offs].code.push(new Uint8Array([
                        0x04, 0x40 // if
                    ]), ...segments[condNext].code, new Uint8Array([
                        0x0B // end
                    ]));
                    segments[offs].condNext = undefined;
                    delete segments[condNext];
                    done = false;
                    break;
                }
            }
        }
    }

    const nname = "j" + nativeName(where).substring(1);
    const wasmArray = [];
    const keys = Object.keys(segments).map(k => +k);
    const hasVmops = Object.values(segments).some(v => v.vmops !== undefined);
    if (keys.length == 1 && segments[1] !== undefined && segments[1].start === 1 && segments[1].prevCount === 1 && segments[1].next === -1 && segments[1].vmops === undefined && segments[1].condNext === undefined) {
        wasmArray.push(1, 3, 0x7F); // L2 to L4 are u32
        for (const c of segments[1].code) {
            wasmArray.push(...c);
        }
    } else {
        if (keys[0] != 1) throw "Invalid segment structure";
        wasmArray.push(1, 4, 0x7F); // L2 to L5 are u32
        if (hasVmops) {
            wasmArray.push(
                0x20, 1, // local.get 1
                0x41, 4 * 4, // i32.const state.T (4 * 4)
                0x6A, // i32.add
                0x28, 0, 0, // i32.load
            );
        } else {
            wasmArray.push(0x41, 0); // i32.const 0
        }
        wasmArray.push(
            0x21, 5, // local.set 5
            0x03, 0x40 // loop (main_loop)
        );
        let loopDepth = 0;
        for (let i = 0; i < keys.length; i++) {
            wasmArray.push(0x02, 0x40); // block
            loopDepth++;
        }
        wasmArray.push(
            0x02, 0x40, // block
            0x02, 0x40, // block
            0x20, 5, // local.get 5
            0x0E, ...LEB128(keys.length), ...keys.flatMap((elem, index) => LEB128(index + 1)), 0x00, // br.table
            0x0B, // end (block)
            0x00, // unreachable
            0x0B, // end (block)
        );
        for (let i = 0; i < keys.length; i++) {
            const segment = segments[keys[i]];
            if (segment.vmops !== undefined) {
                const flatOps = segment.vmops.flatMap(v => [...v]);
                if (segment.next != -1) {
                    const nextIdx = keys.indexOf(segment.next);
                    if (nextIdx == -1) throw "Invalid next pointer";
                    flatOps.push(
                        vmop_JIT_CONTINUE,
                        where & 0xff,
                        (where >>> 8) & 0xff,
                        (where >>> 16) & 0xff,
                        (where >>> 24) & 0xff,
                        nextIdx & 0xff,
                        (nextIdx >>> 8) & 0xff,
                        (nextIdx >>> 16) & 0xff,
                        (nextIdx >>> 24) & 0xff
                    );
                }
                if (vmopAreaStart + flatOps.length > vmopAreaEnd)
                    return "JIT Vmop Area full";
                mem.set(flatOps, vmopAreaStart);

                wasmArray.push(
                    0x20, 1, //local.get 1
                    0x41, 4 * 4, // i32.const state.T (4 * 4)
                    0x6A, // i32.add
                    0x41, ...LEB128s(vmopAreaStart), // i32.const 0
                    0x36, 0, 0, // i32.store
                    0x20, 0, // local.get 0
                    0x0f, // ret
                    0x00 // unreachable
                );

                vmopAreaStart += flatOps.length;
            } else {
                for (const c of segment.code) {
                    wasmArray.push(...c);
                }
                if (segment.condNext === undefined) {
                    if (segment.next == -1) {
                        wasmArray.push(0x00); // unreachable
                    } else {
                        const nextIdx = keys.indexOf(segment.next);
                        if (nextIdx == -1) throw "Invalid next pointer";
                        wasmArray.push(
                            0x41, ...LEB128s(nextIdx), // i32.const <next>
                            0x21, 5, // local.set 5
                            0x0C, ...LEB128(loopDepth), // br <loopDepth> (continue main_loop unconditionally)
                        );
                    }
                } else {
                    const nextIdx = keys.indexOf(segment.next);
                    const condNextIdx = keys.indexOf(segment.condNext);
                    if (segment.next == -1 || segment.condNext == -1 || nextIdx == -1 || condNextIdx == -1) throw "Invalid next pointer";
                    wasmArray.push(
                        0x04, 0x40, // if
                        0x41, ...LEB128s(condNextIdx), // i32.const <condNext>
                        0x21, 5, // local.set 5
                        0x05, // else
                        0x41, ...LEB128s(nextIdx), // i32.const <next>
                        0x21, 5, // local.set 5
                        0x0B, // end
                        0x0C, ...LEB128(loopDepth) // br <loopDepth> (continue main_loop unconditionally)
                    );
                }
            }
            wasmArray.push(
                0x0B, // end (block)
            );
            loopDepth--;
        }
        if (loopDepth != 0) throw "Invalid block nesting";
        wasmArray.push(
            0x0B, // end (loop main_loop)
            0x00 // unreachable
        );
    }
    if (jitLogLevel >= 20)
        console.log(nname, wasmArray);
    appendSubWasmFunction(nname, wasmArray);
    let rspChangeReason = null;
    if (rspAnyChange) {
        rspChangeReason = "Direct RSP register access";
    } else if (rspOffsetMismatch) {
        rspChangeReason = "RSP offset inconsistent on different code branches";
    } else if (rspMaxAccess > -4) {
        rspChangeReason = "Memory access to [RSP+" + rspMaxAccess + "]";
    }
    jitPartChangesRSP[where] = false;
    if (rspChangeReason != null) {
        if (jitLogLevel >= 2) {
            console.log("Direct call to " + getWordName(where) + " impossible: " + rspChangeReason);
        }
        jitPartChangesRSP[where] = true;
    } else if (hasVmops) {
        jitPartChangesRSP[where] = true;
    }
    return null;
}

function doJitCheck(where, mem) {
    const wordName = jitLogLevel >= 2 ? getWordName(where) : "";
    if (jitLogLevel >= 15) {
        console.log("Starting initial JIT check for " + wordName);
    }
    mem[where] = vmop_JIT_NOP; // in case of reentrance
    const error = doJit(where, mem);
    if (error == null) {
        if (jitLogLevel >= 10) {
            console.log("JIT succeeded for " + wordName);
        }
        mem[where] = vmop_JIT_WAIT;
    } else {
        if (jitLogLevel >= 1) {
            console.log("JIT failed for " + wordName + " due to " + error);
        }
    }
}
