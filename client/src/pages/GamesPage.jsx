import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const slangQuestions = [
  {
    q: "What does 'No cap' mean?",
    options: ["No hat", "For real", "No money"],
    answer: 1,
    explanation: "No cap means 'I am being honest' or 'for real'.",
  },
  {
    q: "What does 'Sus' mean?",
    options: ["Suspicious", "Super", "Sad"],
    answer: 0,
    explanation: "Sus is short for suspicious.",
  },
  {
    q: "What does 'W' mean in chat?",
    options: ["Win", "Wait", "Wrong"],
    answer: 0,
    explanation: "A W means a win or something positive.",
  },
  {
    q: "What does 'Lowkey' usually mean?",
    options: ["Loudly", "Secretly or slightly", "In low volume"],
    answer: 1,
    explanation: "Lowkey often means secretly, quietly, or slightly.",
  },
];

const diceDotMap = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const rpsEmoji = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

const DiceFace = ({ value, isRolling, variant }) => {
  const activeDots = diceDotMap[value] || [];

  return (
    <div className={`dice-face ${variant} ${isRolling ? "rolling" : ""}`}>
      {Array.from({ length: 9 }).map((_, index) => {
        const spot = index + 1;
        return <span key={spot} className={`dot ${activeDots.includes(spot) ? "show" : ""}`} />;
      })}
    </div>
  );
};

const GamesPage = () => {
  const [activeGame, setActiveGame] = useState("dice");
  const [sidebarFeature, setSidebarFeature] = useState(null); // null, 'call', or 'chat'

  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [lastRoll, setLastRoll] = useState({ player: 1, bot: 1 });
  const [isRolling, setIsRolling] = useState(false);

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizLocked, setQuizLocked] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);

  const [rpsPlayerChoice, setRpsPlayerChoice] = useState("rock");
  const [rpsBotChoice, setRpsBotChoice] = useState("rock");
  const [rpsResult, setRpsResult] = useState({ text: "Pick rock, paper, or scissors", type: "draw" });
  const [rpsScore, setRpsScore] = useState({ player: 0, bot: 0, draw: 0 });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const quizQuestion = useMemo(() => slangQuestions[quizIndex], [quizIndex]);
  const quizProgress = useMemo(
    () => Math.round(((quizDone ? slangQuestions.length : quizIndex) / slangQuestions.length) * 100),
    [quizDone, quizIndex],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (text, type = "info") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 1700);
  };

  const switchTab = (tab) => {
    setActiveGame(tab);
    showToast(tab === "dice" ? "🎲 Dice ready" : tab === "slang" ? "🧠 Quiz started" : "✊ RPS battle on");
  };

  const rollDice = () => {
    if (isRolling) {
      return;
    }

    setIsRolling(true);

    setTimeout(() => {
      const randomValues = crypto.getRandomValues(new Uint32Array(2));
      const player = (randomValues[0] % 6) + 1;
      const bot = (randomValues[1] % 6) + 1;
      setLastRoll({ player, bot });
      setPlayerScore((prev) => prev + player);
      setBotScore((prev) => prev + bot);
      setIsRolling(false);

      const resultText = player === bot ? "Round draw" : player > bot ? "You won this roll" : "Bot won this roll";
      showToast(`🎲 ${resultText}`);
    }, 520);
  };

  const pickQuizOption = (optionIndex) => {
    if (quizDone || quizLocked) {
      return;
    }

    const isCorrect = optionIndex === quizQuestion.answer;
    setSelectedOption(optionIndex);
    setQuizLocked(true);
    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      showToast("✅ Correct answer", "success");
    } else {
      showToast("❌ Not quite", "error");
    }
  };

  const goNextQuestion = () => {
    if (quizIndex === slangQuestions.length - 1) {
      setQuizDone(true);
      showToast("🏁 Quiz completed", "success");
      return;
    }

    setQuizIndex((prev) => prev + 1);
    setSelectedOption(null);
    setQuizLocked(false);
    setLastAnswerCorrect(null);
  };

  const restartQuiz = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setQuizDone(false);
    setSelectedOption(null);
    setQuizLocked(false);
    setLastAnswerCorrect(null);
    showToast("🔁 Quiz restarted");
  };

  const getQuizAssessment = () => {
    const ratio = quizScore / slangQuestions.length;
    if (ratio === 1) {
      return "Gen Z slang master 💯";
    }

    if (ratio >= 0.75) {
      return "Great slang energy ⚡";
    }

    if (ratio >= 0.5) {
      return "Nice attempt, keep leveling up 📈";
    }

    return "Good start, run it again and learn more 🚀";
  };

  const playRps = (choice) => {
    const options = ["rock", "paper", "scissors"];
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const botChoice = options[randomValue % options.length];
    setRpsPlayerChoice(choice);
    setRpsBotChoice(botChoice);

    if (choice === botChoice) {
      setRpsResult({ text: `Draw: both picked ${choice}`, type: "draw" });
      setRpsScore((prev) => ({ ...prev, draw: prev.draw + 1 }));
      showToast("🤝 Round draw");
      return;
    }

    const wins =
      (choice === "rock" && botChoice === "scissors") ||
      (choice === "paper" && botChoice === "rock") ||
      (choice === "scissors" && botChoice === "paper");

    if (wins) {
      setRpsResult({ text: `You win! ${choice} beats ${botChoice}`, type: "win" });
      setRpsScore((prev) => ({ ...prev, player: prev.player + 1 }));
      showToast("🏆 You won this round", "success");
      return;
    }

    setRpsResult({ text: `Bot wins! ${botChoice} beats ${choice}`, type: "lose" });
    setRpsScore((prev) => ({ ...prev, bot: prev.bot + 1 }));
    showToast("🤖 Bot wins this round", "error");
  };

  return (
    <div className="center-screen">
      <div className="feature-shell refresh-shell glass">
        {toast && <div className={`game-toast ${toast.type}`}>{toast.text}</div>}

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

        <div className="games-main-row">
          <div className="games-main-area">
            <div className="game-tabs">
              <button type="button" data-game="dice" className={activeGame === "dice" ? "active" : ""} onClick={() => switchTab("dice")}>🎲 Ludo Dice</button>
              <button type="button" data-game="quiz" className={activeGame === "slang" ? "active" : ""} onClick={() => switchTab("slang")}>🧠 Learn Gen Z Slang</button>
              <button type="button" data-game="rps" className={activeGame === "rps" ? "active" : ""} onClick={() => switchTab("rps")}>✊ Rock Paper Scissors</button>
            </div>

            {activeGame === "dice" && (
              <section className="game-panel game-panel-dice">
                <h3>🎰 Ludo Dice Battle</h3>
                <p>Roll the dice and race to the higher total score.</p>

                <div className="dice-stage">
                  <div className="dice-card">
                    <span>You</span>
                    <DiceFace value={lastRoll.player} isRolling={isRolling} variant="player-die" />
                  </div>
                  <div className="dice-card">
                    <span>Bot</span>
                    <DiceFace value={lastRoll.bot} isRolling={isRolling} variant="bot-die" />
                  </div>
                </div>

                <div className="score-cards">
                  <div className="score-card player">
                    <span>Your Score</span>
                    <strong>{playerScore}</strong>
                  </div>
                  <div className="score-card bot">
                    <span>Bot Score</span>
                    <strong>{botScore}</strong>
                  </div>
                </div>

                <p className="mono">Last roll: You {lastRoll.player} · Bot {lastRoll.bot}</p>
                <button type="button" className="solid-link action-btn" onClick={rollDice}>
                  {isRolling ? "Rolling..." : "Roll Dice"}
                </button>
              </section>
            )}

            {activeGame === "slang" && (
              <section className="game-panel">
                <h3>🎮 Gen Z Slang Quiz</h3>
                <div className="quiz-progress-wrap">
                  <div className="quiz-progress-bar" style={{ width: `${quizProgress}%` }} />
                </div>

                {!quizDone ? (
                  <>
                    <p>{quizQuestion.q}</p>
                    <div className="quiz-options">
                      {quizQuestion.options.map((option, index) => (
                        <button
                          type="button"
                          key={option}
                          className={`quiz-option ${
                            quizLocked
                              ? index === quizQuestion.answer
                                ? "correct"
                                : index === selectedOption
                                  ? "wrong"
                                  : ""
                              : ""
                          }`}
                          onClick={() => pickQuizOption(index)}
                          disabled={quizLocked}
                        >
                          <span>{option}</span>
                          {quizLocked && index === quizQuestion.answer && <b>✔</b>}
                          {quizLocked && index === selectedOption && index !== quizQuestion.answer && <b>✖</b>}
                        </button>
                      ))}
                    </div>

                    {quizLocked && (
                      <div className="quiz-explain">
                        <strong>{lastAnswerCorrect ? "💡 Nice!" : "💡 Quick learn"}</strong>
                        <p>{quizQuestion.explanation}</p>
                      </div>
                    )}

                    <p className="mono">Question {quizIndex + 1}/{slangQuestions.length}</p>

                    <button type="button" className="solid-link action-btn" onClick={goNextQuestion} disabled={!quizLocked}>
                      {quizIndex === slangQuestions.length - 1 ? "Finish Quiz" : "Next Question"}
                    </button>
                  </>
                ) : (
                  <div className="quiz-complete">
                    <h4>Quiz Completed ✅</h4>
                    <p>Your score: {quizScore}/{slangQuestions.length}</p>
                    <p className="mono">{getQuizAssessment()}</p>
                    <button type="button" className="solid-link action-btn" onClick={restartQuiz}>Restart Quiz</button>
                  </div>
                )}
              </section>
            )}

            {activeGame === "rps" && (
              <section className="game-panel game-panel-rps">
                <h3>👆 Rock Paper Scissors</h3>

                <div className="rps-stage">
                  <div className="rps-hand">{rpsEmoji[rpsPlayerChoice]}</div>
                  <span className="rps-vs">VS</span>
                  <div className="rps-hand">{rpsEmoji[rpsBotChoice]}</div>
                </div>

                <div className={`rps-result ${rpsResult.type}`}>
                  {rpsResult.text}
                </div>

                <div className="rps-score">
                  <span>You: {rpsScore.player}</span>
                  <span>Bot: {rpsScore.bot}</span>
                  <span>Draw: {rpsScore.draw}</span>
                </div>

                <div className="rps-actions">
                  <button type="button" className="rps-btn rock" onClick={() => playRps("rock")}>✊ Rock</button>
                  <button type="button" className="rps-btn paper" onClick={() => playRps("paper")}>✋ Paper</button>
                  <button type="button" className="rps-btn scissors" onClick={() => playRps("scissors")}>✌️ Scissors</button>
                </div>
              </section>
            )}
          </div>

          <aside className="games-sidebar glass">
            <div className="sidebar-toggles">
              <button
                type="button"
                className={`sidebar-btn ${sidebarFeature === "call" ? "active" : ""}`}
                onClick={() => setSidebarFeature(sidebarFeature === "call" ? null : "call")}
                title="Open Voice Call"
              >
                🎤 Voice
              </button>
              <button
                type="button"
                className={`sidebar-btn ${sidebarFeature === "chat" ? "active" : ""}`}
                onClick={() => setSidebarFeature(sidebarFeature === "chat" ? null : "chat")}
                title="Open Text Chat"
              >
                💬 Chat
              </button>
            </div>

            {sidebarFeature === "call" && (
              <div className="sidebar-content">
                <h4>Voice Call</h4>
                <p>Connect with random strangers via video call.</p>
                <Link to="/call" className="solid-link action-btn">
                  Start Voice Call
                </Link>
              </div>
            )}

            {sidebarFeature === "chat" && (
              <div className="sidebar-content">
                <h4>Text Chat</h4>
                <p>Anonymous text chat with anyone.</p>
                <Link to="/message" className="solid-link action-btn">
                  Go to Chat
                </Link>
              </div>
            )}

            {!sidebarFeature && (
              <div className="sidebar-content">
                <p className="mono">Click a button to access voice or text features.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="home-actions">
          <Link to="/" className="ghost-link">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default GamesPage;
