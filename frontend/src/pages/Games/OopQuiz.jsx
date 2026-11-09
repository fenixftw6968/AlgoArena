import MCQGameEngine from '../../components/MCQGameEngine/MCQGameEngine';
import { oopQuestions } from '../../data/oopQuestions';

export default function OopQuiz() {
  return (
    <MCQGameEngine
      gameSlug="oop-quiz"
      gameTitle="OOPs Arena"
      gameIcon="🧱"
      category="Core CS"
      questionBank={oopQuestions}
      codeLanguage="cpp"
      questionCount={5}
      directPlay={true}
    />
  );
}

