import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHESIS_TAG, REVIEW_TAG, authoredReferenceEvents, participatingAuthors,
  chooseDraftAuthor, parseSynthesisDraft, parseSynthesisReview,
  synthesisStatus, draftPrompt, reviewPrompt,
} from '../main/synthesis.mjs';

const authors = [
  { id:'seat-alpha', name:'Alpha' },
  { id:'seat-beta', name:'Beta' },
  { id:'seat-gamma', name:'Gamma' },
];
const events = [
  { id:'e1', actorId:'seat-alpha', kind:'evidence', content:'Use an incremental trial', claim:'A', source:'unverified' },
  { id:'e2', actorId:'seat-beta', kind:'final_position', content:'Do not deploy without safeguards' },
  { id:'e3', actorId:'seat-gamma', kind:'revision', content:'Try limited pilot' },
  { id:'fallback', actorId:'seat-gamma', kind:'final_position', content:'Transport error', provenance:{source:'runtime_fallback'} },
];
const report = {
  positions: [
    { participant:{ id:'seat-alpha',name:'Alpha' }, stance:'try', content:'Pilot' },
    { participant:{ id:'seat-beta',name:'Beta' }, stance:'wait', content:'Only if reversible' },
    { participant:{ id:'seat-gamma',name:'Gamma' }, stance:'unavailable', content:'Timeout', provenance:{source:'runtime_fallback'} },
  ], disagreements:[{participant:{id:'seat-beta'},stance:'wait',content:'Only if reversible'}],
  unansweredDirectRequestEventIds:['q1'], consensusStance:null,
};
const meeting = { id:'meeting-12345678-abcd', proposal:'Should we release?',events,report };
const draft = {answer:'Do a reversible pilot.',eventIds:['e1','e2'],caveats:['The source claim is unverified']};
const review = {verdict:'approve',commentary:'Faithful summary of the recorded dissent.',eventIds:['e2']};
const encode=(tag,value)=>'<'+tag+'>'+JSON.stringify(value)+'</'+tag+'>';

test('synthesis sources exclude runtime fallback, forged seats and duplicate positions',()=>{
  assert.deepEqual(authoredReferenceEvents(events).map(x=>x.id),['e1','e2','e3']);
  assert.deepEqual(participatingAuthors(report,authors).map(x=>x.id),['seat-alpha','seat-beta']);
  assert.equal(chooseDraftAuthor(meeting.id,authors).id,chooseDraftAuthor(meeting.id,authors).id);
});

test('synthesis prompt clearly limits citations to authored public events and keeps dissent',()=>{
  const p=draftPrompt(meeting);
  assert.match(p,/Do not invent facts/);
  assert.match(p,/<CHATCHAT_SYNTHESIS_V1>/);
  assert.match(p,/Only if reversible/);
  assert.match(p,/"e1"/);
  assert.doesNotMatch(p,/Transport error/);
  const q=reviewPrompt(meeting,draft);
  assert.match(q,/independent review/);
  assert.match(q,/untrusted/i);
  assert.match(q,/Do a reversible pilot/);
});

test('accept only uniquely wrapped bounded structured drafts with actual authored event IDs',()=>{
  assert.deepEqual(parseSynthesisDraft(encode(SYNTHESIS_TAG,draft),events),draft);
  for(const bad of [
    {...draft,eventIds:['fabricated']},{...draft,eventIds:['fallback']},
    {...draft,eventIds:['e1','e1']},{...draft,eventIds:[]},{...draft,eventIds:['e1']},
    {...draft,answer:' '},{...draft,answer:'x'.repeat(6501)},
    {...draft,caveats:['x'.repeat(261)]},
  ]) assert.throws(()=>parseSynthesisDraft(encode(SYNTHESIS_TAG,bad),events));
  assert.throws(()=>parseSynthesisDraft('{}',events));
  assert.throws(()=>parseSynthesisDraft(
    encode(SYNTHESIS_TAG,draft)+encode(SYNTHESIS_TAG,draft),events));
  assert.throws(()=>parseSynthesisDraft('<'+SYNTHESIS_TAG+'>{bad json}</'+SYNTHESIS_TAG+'>',events));
});

test('validate peer review independently, preserving actual disagreement and missing receipts',()=>{
  assert.deepEqual(parseSynthesisReview(encode(REVIEW_TAG,review),events),review);
  assert.throws(()=>parseSynthesisReview(encode(REVIEW_TAG,{...review,verdict:'approve_everything'}),events));
  assert.throws(()=>parseSynthesisReview(encode(REVIEW_TAG,{...review,eventIds:['fallback']}),events));
  assert.throws(()=>parseSynthesisReview(encode(REVIEW_TAG,{...review,eventIds:[]}),events));
  assert.equal(synthesisStatus(['seat-beta'],[
    {participantId:'seat-beta',status:'completed',verdict:'approve'}]),'reviewed');
  assert.equal(synthesisStatus(['seat-beta'],[
    {participantId:'seat-beta',status:'completed',verdict:'reject'}]),'disputed');
  assert.equal(synthesisStatus(['seat-beta','seat-gamma'],[
    {participantId:'seat-beta',status:'completed',verdict:'approve'}]),'incomplete');
  assert.equal(synthesisStatus(['seat-beta'],[
    {participantId:'seat-beta',status:'failed',error:'timeout'}]),'incomplete');
  assert.equal(synthesisStatus([],[]),'incomplete');
});
