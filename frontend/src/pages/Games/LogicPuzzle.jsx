import MCQGameEngine from '../../components/MCQGameEngine/MCQGameEngine';
import { logicPuzzleQuestions } from '../../data/logicPuzzleQuestions';

export default function LogicPuzzle() {
  return (
    <MCQGameEngine
      gameSlug="logic-puzzle"
      gameTitle="Logic Puzzle"
      gameIcon="🧩"
      category="Reasoning"
      questionBank={logicPuzzleQuestions}
      questionCount={5}
    />
  );
}
