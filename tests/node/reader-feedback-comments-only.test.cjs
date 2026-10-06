const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLoaderHarness}=require('../helpers/reader-feedback-loader-harness.cjs');
for(const english of [false,true])test(`comments-only ${english?'English':'Chinese'}: no reaction dependency or writer, guest nickname only required`,async()=>{
 const h=await createLoaderHarness({english,reactions:false});
 h.response=path=>{assert.equal(path,'/api/comment');return{errno:0,data:{count:0,data:[],page:1,pageSize:1,totalPages:0}};};
 await h.click();assert.equal(h.inits.length,1);assert.equal(h.requests.length,1);assert.equal(h.helpful.hidden,true);assert.equal(h.helpful.listenerCount('click'),0);
 assert.equal(h.inits[0].login,'disable');assert.deepEqual(Array.from(h.inits[0].requiredMeta),['nick']);assert.deepEqual(Array.from(h.inits[0].meta),['nick','mail']);assert.equal(h.inits[0].reaction,false);assert.equal(h.inits[0].pageview,false);h.assertIndependent();
 await h.helpful.dispatch('click');assert.equal(h.requests.length,1);
});
test('comments-only: failed comment load remains retryable without trying counters',async()=>{
 const h=await createLoaderHarness({reactions:false});h.httpStatus=()=>503;await h.click();h.assertRetryable();assert.equal(h.requests.length,1);h.recover();await h.click();assert.equal(h.inits.length,1);assert.equal(h.requests.length,2);assert.equal(h.helpful.listenerCount('click'),0);
});
