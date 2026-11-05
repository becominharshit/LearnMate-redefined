import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSampleChapterDocument,
  isSampleNumericalAnswer,
  SAMPLE_CHAPTER_ID,
  SAMPLE_CHAPTER_TITLE,
  SAMPLE_CONCEPTS,
  SAMPLE_FLASHCARDS,
  SAMPLE_QUESTIONS,
  sampleText,
  type SampleNumerical,
} from './sampleChapter';

test('sample chapter is complete and ready to add to an account', () => {
  const document = buildSampleChapterDocument();
  assert.equal(document.id, SAMPLE_CHAPTER_ID);
  assert.equal(document.pageCount, 4);
  assert.equal(document.pages.length, 4);
  assert.equal(document.topics.length, 4);
  assert.ok(document.title.startsWith(SAMPLE_CHAPTER_TITLE));
  assert.ok(document.overview.includes('no AI'));
  assert.equal(SAMPLE_CONCEPTS.length, 4);
  assert.equal(SAMPLE_QUESTIONS.length, 4);
  assert.equal(SAMPLE_FLASHCARDS.length, 6);
});

test('every MCQ has a valid correct option and every question has an explanation', () => {
  for (const question of SAMPLE_QUESTIONS) {
    assert.ok(question.explanation.en.length > 10, `${question.id} needs an English explanation`);
    assert.ok(question.explanation.hi.length > 10, `${question.id} needs a Hinglish explanation`);
    if (question.kind === 'mcq') {
      assert.ok(question.options.length >= 2);
      assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
    } else {
      assert.ok(question.answer.length > 0);
      assert.ok(question.accepted.length > 0);
    }
  }
});

test('sample text switches between English and Hinglish', () => {
  assert.equal(sampleText({ en: 'English text', hi: 'Hinglish text' }, 'en'), 'English text');
  assert.equal(sampleText({ en: 'English text', hi: 'Hinglish text' }, 'hi'), 'Hinglish text');
});

test('numerical answers accept fractions, decimals, rounding and percent forms', () => {
  const conditional = SAMPLE_QUESTIONS.find(
    (question): question is SampleNumerical => question.id === 'conditional-number'
  );
  const bayes = SAMPLE_QUESTIONS.find(
    (question): question is SampleNumerical => question.id === 'disease-test'
  );
  assert.ok(conditional);
  assert.ok(bayes);

  assert.equal(isSampleNumericalAnswer(conditional, '0.5'), true);
  assert.equal(isSampleNumericalAnswer(conditional, '1/2'), true);
  assert.equal(isSampleNumericalAnswer(conditional, ' 0.50 '), true);
  assert.equal(isSampleNumericalAnswer(conditional, '0.4'), false);

  assert.equal(isSampleNumericalAnswer(bayes, '1/6'), true);
  assert.equal(isSampleNumericalAnswer(bayes, '0.167'), true);
  assert.equal(isSampleNumericalAnswer(bayes, '0.166'), true);
  assert.equal(isSampleNumericalAnswer(bayes, '16.7%'), true);
  assert.equal(isSampleNumericalAnswer(bayes, '0.5'), false);
  assert.equal(isSampleNumericalAnswer(bayes, ''), false);
});
