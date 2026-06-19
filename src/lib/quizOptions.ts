export interface QuizQuestionData {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizQuestionDraft {
  id: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
}

export const MAX_QUIZ_OPTIONS = 10;

export type ShuffledQuizOptions = {
  displayOptions: string[];
  displayToOriginal: number[];
};

function generateQuestionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeEmptyQuizQuestionDraft(): QuizQuestionDraft {
  return {
    id: generateQuestionId(),
    question: '',
    correctAnswer: '',
    incorrectAnswers: [''],
  };
}

export function buildQuizQuestionFromDraft(draft: QuizQuestionDraft): QuizQuestionData {
  const correct = draft.correctAnswer.trim();
  const incorrect = draft.incorrectAnswers.map((answer) => answer.trim()).filter(Boolean);
  return {
    id: draft.id,
    question: draft.question.trim(),
    options: [correct, ...incorrect],
    correctIndex: 0,
  };
}

export function quizQuestionDataToDraft(data: QuizQuestionData): QuizQuestionDraft {
  const correctIndex = Number.isFinite(data.correctIndex) ? data.correctIndex : 0;
  const correct = data.options[correctIndex] ?? data.options[0] ?? '';
  const incorrect = data.options.filter((_, index) => index !== correctIndex);
  return {
    id: data.id,
    question: data.question,
    correctAnswer: correct,
    incorrectAnswers: incorrect.length > 0 ? incorrect : [''],
  };
}

export function validateQuizQuestionDrafts(args: {
  questions: QuizQuestionDraft[];
  passing_score: number;
}): string | null {
  if (args.questions.length < 1) return 'curriculum.quiz.editor.validation.minQuestions';

  for (const question of args.questions) {
    if (!question.question.trim()) return 'curriculum.quiz.editor.validation.questionEmpty';
    if (!question.correctAnswer.trim()) return 'curriculum.quiz.editor.validation.correctAnswerEmpty';

    const incorrect = question.incorrectAnswers.map((answer) => answer.trim()).filter(Boolean);
    if (incorrect.length < 1) return 'curriculum.quiz.editor.validation.minIncorrectAnswers';
    if (question.incorrectAnswers.some((answer) => answer.trim().length === 0 && question.incorrectAnswers.length > 1)) {
      return 'curriculum.quiz.editor.validation.incorrectAnswerEmpty';
    }

    const totalOptions = 1 + incorrect.length;
    if (totalOptions > MAX_QUIZ_OPTIONS) return 'curriculum.quiz.editor.validation.maxOptions';
  }

  if (!Number.isFinite(args.passing_score) || args.passing_score < 0 || args.passing_score > 100) {
    return 'curriculum.quiz.editor.validation.scoreRange';
  }

  return null;
}

export function shuffleQuizOptions(options: string[], randomFn: () => number = Math.random): ShuffledQuizOptions {
  const displayToOriginal = options.map((_, index) => index);
  for (let i = displayToOriginal.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [displayToOriginal[i], displayToOriginal[j]] = [displayToOriginal[j], displayToOriginal[i]];
  }
  return {
    displayOptions: displayToOriginal.map((index) => options[index]),
    displayToOriginal,
  };
}

export function mapDisplayAnswerToOriginalIndex(displayIndex: number, displayToOriginal: number[]): number {
  return displayToOriginal[displayIndex];
}

export function buildQuizDisplayMap(questions: QuizQuestionData[]): Record<string, ShuffledQuizOptions> {
  const map: Record<string, ShuffledQuizOptions> = {};
  for (const question of questions) {
    map[question.id] = shuffleQuizOptions(question.options);
  }
  return map;
}
