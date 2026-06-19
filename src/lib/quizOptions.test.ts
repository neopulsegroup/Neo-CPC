import { describe, expect, it } from 'vitest';

import {
  buildQuizQuestionFromDraft,
  buildQuizDisplayMap,
  makeEmptyQuizQuestionDraft,
  mapDisplayAnswerToOriginalIndex,
  shuffleQuizOptions,
  validateQuizQuestionDrafts,
} from '@/lib/quizOptions';

describe('quizOptions', () => {
  it('builds quiz question with correct answer first', () => {
    const built = buildQuizQuestionFromDraft({
      id: 'q1',
      question: 'Pergunta?',
      correctAnswer: 'Certa',
      incorrectAnswers: ['Errada 1', 'Errada 2', ''],
    });

    expect(built).toEqual({
      id: 'q1',
      question: 'Pergunta?',
      options: ['Certa', 'Errada 1', 'Errada 2'],
      correctIndex: 0,
    });
  });

  it('validates draft with dedicated correct and incorrect answers', () => {
    expect(
      validateQuizQuestionDrafts({
        questions: [
          {
            id: 'q1',
            question: 'Pergunta?',
            correctAnswer: 'Certa',
            incorrectAnswers: ['Errada'],
          },
        ],
        passing_score: 70,
      })
    ).toBeNull();

    expect(
      validateQuizQuestionDrafts({
        questions: [
          {
            id: 'q1',
            question: 'Pergunta?',
            correctAnswer: '',
            incorrectAnswers: ['Errada'],
          },
        ],
        passing_score: 70,
      })
    ).toBe('curriculum.quiz.editor.validation.correctAnswerEmpty');
  });

  it('shuffles options while preserving original correct index mapping', () => {
    const shuffled = shuffleQuizOptions(['Certa', 'Errada 1', 'Errada 2'], () => 0.1);
    expect(shuffled.displayOptions).toHaveLength(3);
    expect(new Set(shuffled.displayOptions)).toEqual(new Set(['Certa', 'Errada 1', 'Errada 2']));

    const displayIndex = shuffled.displayOptions.findIndex((option) => option === 'Certa');
    expect(mapDisplayAnswerToOriginalIndex(displayIndex, shuffled.displayToOriginal)).toBe(0);
  });

  it('creates display map per question', () => {
    const map = buildQuizDisplayMap([
      {
        id: 'q1',
        question: 'P1',
        options: ['A', 'B'],
        correctIndex: 0,
      },
    ]);

    expect(map.q1.displayOptions).toHaveLength(2);
  });

  it('starts empty draft with one incorrect answer field', () => {
    const draft = makeEmptyQuizQuestionDraft();
    expect(draft.incorrectAnswers).toEqual(['']);
  });
});
