import {test} from 'node:test';import assert from 'node:assert/strict';import {QUIZ,AREAS,CARDS,CASES} from '../data/content.js';
test('nove aree di studio',()=>assert.equal(AREAS.length,9));
test('quiz con risposte valide e ID distinti',()=>{assert.ok(QUIZ.length>=30);assert.equal(new Set(QUIZ.map(q=>q.id)).size,QUIZ.length);for(const q of QUIZ){assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(AREAS.some(a=>a[0]===q.area));assert.ok(q.explanation&&q.source)}});
test('flashcard e casi presenti',()=>{assert.ok(CARDS.length>=10);assert.ok(CASES.length>=5)});
