import MCQGameEngine from '../../components/MCQGameEngine/MCQGameEngine';
import { dsaMasterQuestions } from '../../data/dsaMasterQuestions';

export default function DsaMasterQuiz() {
  return (
    <MCQGameEngine
      gameSlug="dsa-master-quiz"
      gameTitle="DSA Master Quiz"
      gameIcon="🧠"
      category="Programming / DSA"
      questionBank={dsaMasterQuestions}
      codeLanguage="cpp"
      questionCount={5}
    />
  );
}
