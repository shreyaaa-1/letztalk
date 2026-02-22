import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const slangQuestions = [
  { q: "What does 'No cap' mean?", options: ["No hat", "For real", "No money"], answer: 1 },
  { q: "What does 'Sus' mean?", options: ["Suspicious", "Super", "Sad"], answer: 0 },
  { q: "What does 'W' mean in chat?", options: ["Win", "Wait", "Wrong"], answer: 0 },
];

const GamesPage = () => {
  const [activeGame, setActiveGame] = useState("dice");

  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [lastRoll, setLastRoll] = useState({ player: 0, bot: 0 });

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  const [rpsResult, setRpsResult] = useState("Pick rock, paper, or scissors");

  const quizQuestion = useMemo(() => slangQuestions[quizIndex], [quizIndex]);

  const rollDice = () => {
    const player = Math.floor(Math.random() * 6) + 1;
    const bot = Math.floor(Math.random() * 6) + 1;
    setLastRoll({ player, bot });
    setPlayerScore((prev) => prev + player);
    setBotScore((prev) => prev + bot);
  };

  const pickQuizOption = (optionIndex) => {
    if (quizDone) {
      return;
    }

    if (optionIndex === quizQuestion.answer) {
      setQuizScore((prev) => prev + 1);
    }

    if (quizIndex === slangQuestions.length - 1) {
      setQuizDone(true);
      return;
    }

    setQuizIndex((prev) => prev + 1);
  };

  const restartQuiz = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setQuizDone(false);
  };

  const playRps = (choice) => {
    const options = ["rock", "paper", "scissors"];
    const botChoice = options[Math.floor(Math.random() * options.length)];

    if (choice === botChoice) {
      setRpsResult(`Draw: both picked ${choice}`);
      return;
    }

    const wins =
      (choice === "rock" && botChoice === "scissors") ||
      (choice === "paper" && botChoice === "rock") ||
      (choice === "scissors" && botChoice === "paper");

    setRpsResult(wins ? `You win! ${choice} beats ${botChoice}` : `Bot wins! ${botChoice} beats ${choice}`);
  };

  return (
    <div className="center-screen">
      <div className="feature-shell glass">
        <header className="feature-header">
          <div>
            <h1>Games Zone</h1>
            <p>Play mini games: Ludo Dice, Gen Z Slang Quiz, and Rock Paper Scissors.</p>
          </div>
          <div className="header-actions">
            <Link className="ghost-link small-link" to="/call">Call</Link>
            <Link className="ghost-link small-link" to="/message">Message</Link>
            <Link className="ghost-link small-link" to="/rooms">Rooms</Link>
          </div>
        </header>

        <div className="game-tabs">
          <button type="button" className={activeGame === "dice" ? "active" : ""} onClick={() => setActiveGame("dice")}>Ludo Dice</button>
          <button type="button" className={activeGame === "slang" ? "active" : ""} onClick={() => setActiveGame("slang")}>Learn Gen Z Slang</button>
          <button type="button" className={activeGame === "rps" ? "active" : ""} onClick={() => setActiveGame("rps")}>Rock Paper Scissors</button>
        </div>

        {activeGame === "dice" && (
          <section className="game-panel glass">
            <h3>Ludo Dice Battle</h3>
            <p>Roll dice and race to the higher total score.</p>
            <p className="mono">Last roll: You {lastRoll.player} · Bot {lastRoll.bot}</p>
            <p className="mono">Score: You {playerScore} · Bot {botScore}</p>
            <button type="button" className="solid-link action-btn" onClick={rollDice}>Roll Dice</button>
          </section>
        )}

        {activeGame === "slang" && (
          <section className="game-panel glass">
            <h3>Gen Z Slang Quiz</h3>
            {!quizDone ? (
              <>
                <p>{quizQuestion.q}</p>
                <div className="quiz-options">
                  {quizQuestion.options.map((option, index) => (
                    <button type="button" key={option} className="ghost-link" onClick={() => pickQuizOption(index)}>
                      {option}
                    </button>
                  ))}
                </div>
                <p className="mono">Question {quizIndex + 1}/{slangQuestions.length}</p>
              </>
            ) : (
              <>
                <p>Your score: {quizScore}/{slangQuestions.length}</p>
                <button type="button" className="solid-link action-btn" onClick={restartQuiz}>Restart Quiz</button>
              </>
            )}
          </section>
        )}

        {activeGame === "rps" && (
          <section className="game-panel glass">
            <h3>Rock Paper Scissors</h3>
            <p>{rpsResult}</p>
            <div className="quiz-options">
              <button type="button" className="ghost-link" onClick={() => playRps("rock")}>Rock</button>
              <button type="button" className="ghost-link" onClick={() => playRps("paper")}>Paper</button>
              <button type="button" className="ghost-link" onClick={() => playRps("scissors")}>Scissors</button>
            </div>
          </section>
        )}

        <div className="home-actions">
          <Link to="/" className="ghost-link">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default GamesPage;
