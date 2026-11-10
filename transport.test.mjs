import test from'node:test';import assert from'node:assert/strict';import{verifyTransport,brokenTransport}from'./transport.mjs';
test('healthy socket verifies a real connected state',async()=>assert.equal(await verifyTransport({getState:async()=> 'CONNECTED'}),'CONNECTED'));
test('detached frame is recognized for reconnection instead of false connected status',async()=>{const error=Error("Attempted to use detached Frame 'example'");assert(brokenTransport(error));await assert.rejects(()=>verifyTransport({getState:async()=>{throw error;}}),e=>e.transportBroken);});
test('closed page triggers reconnect without a page evaluation',async()=>{let read=false;await assert.rejects(()=>verifyTransport({pupPage:{isClosed:()=>true},getState:async()=>{read=true;}}),e=>e.transportBroken);assert(!read);});
test('unpaired socket requires relinking rather than automatic access',async()=>await assert.rejects(()=>verifyTransport({getState:async()=> 'UNPAIRED'}),e=>e.reauthRequired&&e.transportBroken));
test('hanging health check times out and is treated as broken',async()=>await assert.rejects(()=>verifyTransport({getState:()=>new Promise(()=>{})},5),e=>e.transportBroken));
