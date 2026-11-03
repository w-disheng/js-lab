import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeState } from '../dist/core.js';
import { emptyTraining, sanitizeTraining, initialSearch, searchStep } from '../dist/training-core.js';
import { days, dailyBlocks, questions } from '../dist/training-data.js';
import { lessons } from '../dist/lessons.js';
const ids=lessons.map(l=>l.id);
test('21-day plan has valid practice links, examples and four-hour task blocks',()=>{
  assert.equal(days.length,21);assert.equal(dailyBlocks.reduce((a,b)=>a+b,0),240);
  days.forEach((d,i)=>{assert.equal(d.day,i+1);assert.equal(d.tasks.length,5);assert.ok(d.analogy);assert.ok(ids.includes(d.lesson));});
});
test('training records round-trip inside existing backup without losing lesson data',()=>{
  const input={version:1,current:'closures',entries:{closures:{note:'existing note',draft:'let x = 1;'}},training:{...emptyTraining(),day:8,tasks:{'8-0':true},answers:{loading:'旧餐做好不代表新餐做好'},quiz:{loading:{choice:0,submitted:true}},note:'my note'}};
  const output=sanitizeState(JSON.parse(JSON.stringify(input)),ids);
  assert.equal(output.entries.closures.note,'existing note');
  assert.equal(output.training.day,8);assert.equal(output.training.answers.loading,input.training.answers.loading);assert.equal(output.training.tasks['8-0'],true);
});
test('legacy backups do not manufacture training data or completion',()=>{
  const data=sanitizeState({version:1,entries:{closures:{explained:true}}},ids);
  assert.equal(data.training,undefined);assert.equal(data.entries.closures.pass,null);
});
test('training import rejects malformed structures and bounds unknown or untrusted fields',()=>{
  assert.throws(()=>sanitizeTraining(null));assert.throws(()=>sanitizeTraining([]));
  const clean=sanitizeTraining({day:99,tasks:{'1-0':true,'99-1':true,'1-1':'yes'},answers:{loading:'x'.repeat(7000),unknown:'secret'},quiz:{stale:{choice:9,submitted:true},loading:{choice:0,submitted:'yes'}},explained:'yes',reviewAt:Infinity});
  assert.equal(clean.day,1);assert.deepEqual(clean.tasks,{'1-0':true});assert.equal(clean.answers.loading.length,6000);assert.equal(clean.answers.unknown,undefined);assert.equal(clean.quiz.stale,undefined);assert.equal(clean.quiz.loading.submitted,false);assert.equal(clean.explained,false);assert.equal(clean.reviewAt,0);
});
const begin=()=>searchStep(searchStep(initialSearch(),{type:'start',id:1,word:'cat'},true),{type:'start',id:2,word:'car'},true);
test('simulation demonstrates actual stale overwrite in naive mode, preserves latest in guarded mode',()=>{
  for(const guarded of [false,true]){
    const a=searchStep(begin(),{type:'success',id:2,word:'car'},guarded);
    const b=searchStep(a,{type:'success',id:1,word:'cat'},guarded);
    assert.equal(b.result,guarded?'car':'cat');assert.equal(b.loading,false);
  }
});
test('old completion while latest pending cannot turn off guarded loading',()=>{
  const current=begin();
  assert.equal(searchStep(current,{type:'success',id:1,word:'cat'},true),current);
  assert.equal(searchStep(current,{type:'failure',id:1,word:'cat'},true),current);
  assert.equal(searchStep(current,{type:'success',id:1,word:'cat'},false).loading,false);
});
test('latest failure is retained when old success or failure follows',()=>{
  const failed=searchStep(begin(),{type:'failure',id:2,word:'car'},true);
  assert.equal(failed.error,'car 请求失败');assert.equal(failed.loading,false);
  for(const type of ['success','failure'])assert.equal(searchStep(failed,{type,id:1,word:'cat'},true),failed);
});
test('same-word requests still have separate identities; a single current result is accepted',()=>{
  let s=searchStep(initialSearch(),{type:'start',id:1,word:'cat'},true);
  s=searchStep(s,{type:'success',id:1,word:'cat'},true);assert.equal(s.result,'cat');
  s=searchStep(s,{type:'start',id:2,word:'cat'},true);assert.equal(s.result,'');assert.equal(s.loading,true);
  assert.equal(searchStep(s,{type:'success',id:1,word:'cat'},true),s);
});
test('quiz feedback covers each choice without pretending to grade prose',()=>{
  assert.equal(new Set(questions.map(q=>q.id)).size,3);
  for(const q of questions){assert.equal(q.options.length,3);assert.equal(q.feedback.length,3);assert.ok(q.options[q.correct]);assert.ok(q.reference);}
});
