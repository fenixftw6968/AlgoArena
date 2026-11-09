import MCQGameEngine from '../../components/MCQGameEngine/MCQGameEngine';
import { osQuestions } from '../../data/osQuestions';

export default function OsQuiz() {
  return (
    <MCQGameEngine
      gameSlug="os-quiz"
      gameTitle="Operating Systems Arena"
      gameIcon="🖥️"
      category="Core CS"
      questionBank={osQuestions}
      codeLanguage="c"
      questionCount={5}
      directPlay={true}
    />
  );
}

