import MCQGameEngine from '../../components/MCQGameEngine/MCQGameEngine';
import { cnQuestions } from '../../data/cnQuestions';

export default function CnQuiz() {
  return (
    <MCQGameEngine
      gameSlug="cn-quiz"
      gameTitle="Computer Networks Arena"
      gameIcon="🌐"
      category="Core CS"
      questionBank={cnQuestions}
      codeLanguage="text"
      questionCount={5}
      directPlay={true}
    />
  );
}

