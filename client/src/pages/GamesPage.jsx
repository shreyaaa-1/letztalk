import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

const DicePips = ({ value, isRolling, variant }) => {
  const activeDots = diceDotMap[value] || [];

  return (
    <div className={`dice-neon-cube ${variant} ${isRolling ? "rolling" : ""}`} aria-label={`Dice shows ${value}`}>
      {Array.from({ length: 9 }).map((_, index) => {
        const spot = index + 1;
        return <span key={spot} className={`dice-neon-dot ${activeDots.includes(spot) ? "show" : ""}`} />;
      })}
    </div>
  );
};

const GamesPage = () => {
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);

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
      try {
        const hasCrypto = typeof window !== "undefined" && window.crypto?.getRandomValues;
        const player = hasCrypto ? (window.crypto.getRandomValues(new Uint32Array(1))[0] % 6) + 1 : Math.floor(Math.random() * 6) + 1;
        const bot = hasCrypto ? (window.crypto.getRandomValues(new Uint32Array(1))[0] % 6) + 1 : Math.floor(Math.random() * 6) + 1;
        setLastRoll({ player, bot });
        setPlayerScore((prev) => prev + player);
        setBotScore((prev) => prev + bot);

        const resultText = player === bot ? "Round draw" : player > bot ? "You won this roll" : "LetzTalk won this roll";
        showToast(`🎲 ${resultText}`);
      } finally {
        setIsRolling(false);
      }
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
  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
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

    setRpsResult({ text: `LetzTalk wins! ${botChoice} beats ${choice}`, type: "lose" });
    setRpsScore((prev) => ({ ...prev, bot: prev.bot + 1 }));
    showToast("🤖 LetzTalk wins this round", "error");
  };

  const selectedTab = activeGame || "dice";

  return (
    <div className="center-screen games-page-screen">
      <div className="feature-shell refresh-shell glass games-zone-embed">
        {toast && <div className={`game-toast ${toast.type}`}>{toast.text}</div>}
        <div className="games-zone-glow" aria-hidden="true" />

        <header className="feature-header games-zone-topbar">
          <button type="button" className="ghost-link games-zone-back-link" onClick={onBack} aria-label="Back">
            ← Back
          </button>
          <h2 className="games-zone-kicker">GAMES ZONE</h2>
          <div className="games-zone-top-spacer" aria-hidden="true" />
        </header>

        <div className="games-main-row">
          <div className="games-main-area">
            
            {activeGame === null ? (
              <>
                <div className="games-zone-hero">
                  <div className="games-zone-icon" aria-hidden="true">🎮</div>
                  <h3>PLAY & CONNECT</h3>
                  <p>Break the ice with arcade-style games!</p>
                </div>

                <div className="games-selector-row games-zone-tabs">
                  <button
                    type="button"
                    className={`game-chip game-zone-chip ${selectedTab === "dice" ? "active" : ""}`}
                    onClick={() => { setActiveGame("dice"); showToast("🎲 Dice ready"); }}
                  >
                    🎲 LUDO DICE
                  </button>
                  <button
                    type="button"
                    className={`game-chip game-zone-chip ${selectedTab === "slang" ? "active" : ""}`}
                    onClick={() => { setActiveGame("slang"); showToast("🧠 Quiz started"); }}
                  >
                    🧠 GEN Z SLANG
                  </button>
                  <button
                    type="button"
                    className={`game-chip game-zone-chip ${selectedTab === "rps" ? "active" : ""}`}
                    onClick={() => { setActiveGame("rps"); showToast("✊ RPS battle on"); }}
                  >
                    ✊ RPS
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="games-panel-top-actions">
                  <button type="button" className="ghost-btn small" onClick={() => setActiveGame(null)}>
                    ← All Games
                  </button>
                </div>

                <div className="game-stage-active game-zone-stage glass">
                  {activeGame === "dice" && (
                    <article className="games-3d-card game-stage-card dice-neon-stage">
                      <h4 className="dice-neon-title">🎲 Ludo Dice Battle</h4>

                      <div className="dice-neon-duel">
                        <div className="dice-neon-player">
                          <span className="dice-neon-tag you">PLAYER 1</span>
                          <DicePips value={lastRoll.player} isRolling={isRolling} variant="you" />
                        </div>
                        <span className="dice-neon-vs">VS</span>
                        <div className="dice-neon-player">
                          <span className="dice-neon-tag bot">PLAYER 2</span>
                          <DicePips value={lastRoll.bot} isRolling={isRolling} variant="bot" />
                        </div>
                      </div>

                      <div className="dice-neon-score-grid">
                        <div className="dice-neon-score you">
                          <span>🏆</span>
                          <p>Player 1 Score</p>
                          <strong>{playerScore}</strong>
                        </div>
                        <div className="dice-neon-score bot">
                          <span>🏆</span>
                          <p>Player 2 Score</p>
                          <strong>{botScore}</strong>
                        </div>
                      </div>

                      <p className="dice-result-note">
                        {lastRoll.player === lastRoll.bot 
                          ? "Draw round — both rolled the same." 
                          : lastRoll.player > lastRoll.bot 
                            ? "You win this roll! 🎉" 
                            : "LetzTalk wins this roll."}
                      </p>
                      <button type="button" className="solid-link action-btn room-ad-btn dice-roll-btn" onClick={rollDice} aria-busy={isRolling}>
                        {isRolling ? "Waiting for partner..." : "🎲 Roll Dice"}
                      </button>
                    </article>
                  )}

                  {activeGame === "rps" && (
                    <article className="games-3d-card game-stage-card rps-neon-stage">
                      <h4 className="rps-neon-title">✋ Rock Paper Scissors</h4>

                      <div className="dice-neon-duel">
                        <div className="dice-neon-player">
                          <span className="dice-neon-tag you">PLAYER 1</span>
                          <div className="rps-neon-cube">
                            {rpsPlayerChoice === "rock" ? "✊" : rpsPlayerChoice === "paper" ? "✋" : "✌️"}
                          </div>
                        </div>
                        <span className="dice-neon-vs">VS</span>
                        <div className="dice-neon-player">
                          <span className="dice-neon-tag bot">PLAYER 2</span>
                          <div className="rps-neon-cube">
                            {rpsBotChoice === "rock" ? "✊" : rpsBotChoice === "paper" ? "✋" : "✌️"}
                          </div>
                        </div>
                      </div>

                      <div className="dice-neon-score-grid">
                        <div className="dice-neon-score you">
                          <span>🏆</span>
                          <p>Player 1 Wins</p>
                          <strong>{rpsScore.player}</strong>
                        </div>
                        <div className="dice-neon-score bot">
                          <span>🏆</span>
                          <p>Player 2 Wins</p>
                          <strong>{rpsScore.bot}</strong>
                        </div>
                      </div>

                      <p className="dice-result-note">{rpsResult.text}</p>
                      <div className="rps-neon-actions">
                        <button type="button" className="rps-neon-btn rock" onClick={() => playRps("rock")}>✊</button>
                        <button type="button" className="rps-neon-btn paper" onClick={() => playRps("paper")}>✋</button>
                        <button type="button" className="rps-neon-btn scissors" onClick={() => playRps("scissors")}>✌️</button>
                      </div>
                    </article>
                  )}

                  {activeGame === "slang" && (
                    <article className="games-3d-card game-stage-card quiz-neon-stage">
                      <h4 className="rps-neon-title">🧠 Gen Z Slang</h4>
                      
                      <div className="quiz-progress-wrap">
                        <div className="quiz-progress-bar" style={{ width: `${quizProgress}%` }} />
                      </div>

                      {!quizDone ? (
                        <>
                          <p className="quiz-mini-question">{quizQuestion.q}</p>
                          <div className="quiz-mini-options">
                            {quizQuestion.options.map((option, index) => (
                              <button 
                                key={option} 
                                type="button" 
                                className={`ghost-btn small ${quizLocked && index === quizQuestion.answer ? 'correct-glow' : ''}`}
                                onClick={() => pickQuizOption(index)} 
                                disabled={quizLocked}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          
                          {quizLocked && (
                            <div className="quiz-explain">
                              <strong>{lastAnswerCorrect ? "💡 Nice!" : "💡 Quick learn"}</strong>
                              <p>{quizQuestion.explanation}</p>
                            </div>
                          )}

                          <p className="dice-result-note">Question {quizIndex + 1}/{slangQuestions.length}</p>
                          <button type="button" className="solid-link action-btn room-ad-btn" onClick={goNextQuestion} disabled={!quizLocked}>
                            {quizIndex === slangQuestions.length - 1 ? "Finish Quiz" : "Next Question"}
                          </button>
                        </>
                      ) : (
                        <div className="quiz-complete">
                          <h4>Quiz Completed ✅</h4>
                          <p>Your score: {quizScore}/{slangQuestions.length}</p>
                          <p className="dice-result-note">{getQuizAssessment()}</p>
                          <button type="button" className="solid-link action-btn room-ad-btn" onClick={restartQuiz}>Restart Quiz</button>
                        </div>
                      )}
                    </article>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamesPage;
