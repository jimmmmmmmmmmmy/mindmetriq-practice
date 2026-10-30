const { test }=require('node:test');
const assert=require('node:assert/strict');
const history=require('../js/storage');
const record={mode:'test',score:2,total:3,time:7,date:1234,acc:67};
const storage=value=>({getItem:()=>value,setItem(k,v){value=v;}});
test('malformed, non-array and injected history is ignored',()=> {
  for(const raw of ['oops','{}','null','42',JSON.stringify([{...record,mode:'<img onerror=alert(1)>'}]),JSON.stringify([{...record,score:'2'}]),JSON.stringify([{...record,total:-1}])])assert.deepEqual(history.read('net',storage(raw)),[]);
  const s=storage(JSON.stringify([{...record,acc:'<script>'}]));
  assert.equal(history.read('net',s)[0].acc,67);
});
test('storage denial does not prevent reading or saving',()=> {
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('full');}};
  assert.deepEqual(history.read('net',denied),[]); assert.doesNotThrow(()=>history.save('net',record,denied));
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('SecurityError');}});
  try { assert.deepEqual(history.read('net'),[]); assert.doesNotThrow(()=>history.save('net',record)); } finally { delete globalThis.localStorage; }
});
test('history recovers after corrupt data, keeps 50 runs and separates hard drill from test',()=> {
  const s=storage('{}');history.save('net',record,s);
  for(let i=0;i<60;i++)history.save('net',{...record,date:i+1},s);
  assert.equal(history.read('net',s).length,50);
  assert.equal(history.read('net',s)[0].date,11);
  assert.deepEqual(history.best([{...record,mode:'hard',score:3},record]),record);
  assert.equal(history.best([{...record,time:8},{...record,time:6}]).time,6);
});
