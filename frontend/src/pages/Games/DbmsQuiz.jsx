import MCQGameEngine from '../../components/MCQGameEngine/MCQGameEngine';
import { dbmsQuestions } from '../../data/dbmsQuestions';

export default function DbmsQuiz() {
  return (
    <MCQGameEngine
      gameSlug="dbms-quiz"
      gameTitle="DBMS Arena"
      gameIcon="🗄️"
      category="Core CS"
      questionBank={dbmsQuestions}
      codeLanguage="sql"
      questionCount={5}
      directPlay={true}
    />
  );
}

