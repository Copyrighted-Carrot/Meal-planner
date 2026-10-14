import React, { createContext, useState, useContext, useEffect } from "react";
import carrotGuide from "../assets/carrot-guide.png";
import strawberryGuide from "../assets/strawberry-guide.png";
import "../App.css"; // Reuse existing CSS

const CarrotContext = createContext();

export const useCarrot = () => useContext(CarrotContext);

export const CarrotProvider = ({ children }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [activeCharacter, setActiveCharacter] = useState("carrot");
    const [dialogue, setDialogue] = useState("");
    const [bubbleClass, setBubbleClass] = useState("");
    const [battleMode, setBattleMode] = useState(false);
    const [quiz, setQuiz] = useState(null);
    const [score, setScore] = useState(0);
    const [bonusFact, setBonusFact] = useState("");
    const [showNextStop, setShowNextStop] = useState(false);
    const [showStrawberryOptions, setShowStrawberryOptions] = useState(false); // NEW: Strawberry interactions

    // Typing Effect Ref to clear intervals if needed (simpler with state for now)

    // Initial Greeting - REMOVED


    // Data Content
    const mealTips = [
        "Dark Humor is like food. Not everyone gets it.",
        "⚪Where do idlies go to get drunk? Sam - Bar🍲 ",
        "🍳 Breakfast is the most important meal of the day!",
        "🎂 A Cake is a Cake even if its a Cup Cake🧁"
    ];

    const foodQuiz = [
        { question: "What vitamin is most in carrots?", choices: ["C", "A", "B12"], correct: "A" },
        { question: "Which is a spice?", choices: ["Basil", "Cinnamon", "Salt"], correct: "Cinnamon" }
    ];

    const strawberryTips = [
        "🍓 Strawberries & dark chocolate = BEST combo!",
        "🥞 Try me on pancakes with honey—so good!"
    ];

    const bonusFacts = [
        "🍓 Bonus Fact: Did you know strawberries are the only fruit with seeds on the outside?",
        "🍓 Bonus Fact: Bananas are technically berries, but strawberries aren't!",
        "🍓 Bonus Fact: The average strawberry has about 200 seeds!",
        "🍓 Bonus Fact: Strawberries are a member of the rose family!",
        "🍓 Bonus Fact: Strawberries are the first fruit to ripen in spring!"
    ];

    const getStreakMessage = (streakCount) => {
        if (streakCount === 5) return "🔥 You're on fire! A 5-question streak!";
        if (streakCount === 10) return "🔥🔥 Incredible! 10 questions in a row!";
        if (streakCount === 15) return "🔥🔥🔥 Unstoppable! 15-question streak!";
        if (streakCount === 20) return "🏆 LEGENDARY! 20 questions! You're a food GENIUS!";
        if (streakCount > 20 && streakCount % 5 === 0) return `🏆🔥 PHENOMENAL! ${streakCount}-question streak! You're breaking records!`;
        return `🔥 Current streak: ${streakCount}`;
    };

    const typeText = (text, character) => {
        let i = 0;
        let typedText = "";
        setBubbleClass(character === "carrot" ? "carrot-bubble" : "strawberry-bubble");
        setDialogue(""); // Reset first

        // Clear any existing intervals? (Ideally yes, but for now simple overwrite works visually)

        const interval = setInterval(() => {
            if (i < text.length) {
                typedText += text.charAt(i);
                setDialogue(typedText);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 50);
    };

    // Exposed method for other components
    const say = (text, character = "carrot") => {
        setActiveCharacter(character);
        typeText(text, character);
    };

    const handleCarrotClick = () => {
        setShowMenu(!showMenu);
        setActiveCharacter("carrot");
    };

    const handleMealTip = () => {
        setShowMenu(false);
        setActiveCharacter("carrot");
        typeText("🥕 " + mealTips[Math.floor(Math.random() * mealTips.length)], "carrot");
    };

    const startCarrotBattle = () => {
        setShowMenu(false);
        const randomQuiz = foodQuiz[Math.floor(Math.random() * foodQuiz.length)];
        setActiveCharacter("carrot");
        typeText("🥕 Get ready for the challenge!", "carrot");
        setTimeout(() => {
            setQuiz(randomQuiz);
            setBattleMode(true);
            setDialogue("");
        }, 2700);
    };

    const handleStrawberryTip = () => {
        setShowMenu(false);
        setShowStrawberryOptions(false); // Reset
        setActiveCharacter("strawberry");
        typeText("🍓 Hey there! I'm Copyrighted_Strawberry!", "strawberry");
        setTimeout(() => {
            typeText("🍓 " + strawberryTips[Math.floor(Math.random() * strawberryTips.length)], "strawberry");
            // Show options after tip
            setTimeout(() => {
                setShowStrawberryOptions(true);
            }, 2000);
        }, 2000);
    };

    const handleAnotherStrawberryTip = () => {
        setShowStrawberryOptions(false);
        typeText("🍓 " + strawberryTips[Math.floor(Math.random() * strawberryTips.length)], "strawberry");
        // Show options again after tip
        setTimeout(() => {
            setShowStrawberryOptions(true);
        }, 2000);
    };

    const handleBackToCarrot = () => {
        setShowStrawberryOptions(false);
        setActiveCharacter("carrot");
        typeText("🥕 I'm back! Did you miss me?", "carrot");
        setTimeout(() => setDialogue(""), 2000);
    };

    // Placeholder for smart fridge - can be overridden or connected by parent
    const [smartFridgeCallback, setSmartFridgeCallback] = useState(null);

    const handleSmartFridge = () => {
        setShowMenu(false);
        setActiveCharacter("carrot");
        typeText("🥕 Checking the fridge... Let's see what we can cook!", "carrot");
        setTimeout(() => {
            if (smartFridgeCallback) smartFridgeCallback();
            else typeText("🥕 Smart Fridge logic not connected yet!", "carrot");
        }, 1500);
    };

    const checkAnswer = (selectedAnswer) => {
        setQuiz(null);
        setBattleMode(false);

        let newScore = score;
        let newBonusFact = "";

        if (selectedAnswer === quiz.correct) {
            newScore += 1;
            setScore(newScore);

            // Check bonus fact every 3 correct
            if (newScore % 3 === 0) {
                newBonusFact = bonusFacts[Math.floor(Math.random() * bonusFacts.length)];
            }
            setBonusFact(newBonusFact);

            setActiveCharacter("strawberry");
            typeText(`🍓 Correct! Score: ${newScore}`, "strawberry");

            // Trigger advanced flow
            setTimeout(() => {
                handleCorrectAnswerFlow(newScore, newBonusFact);
            }, 2500);

        } else {
            setScore(0);
            setBonusFact("");
            setActiveCharacter("carrot");
            typeText(`🥕 Oops! The correct answer was: ${quiz.correct}.`, "carrot");

            setTimeout(() => {
                setActiveCharacter("carrot");
                typeText("🥕 Want another question?", "carrot");
                setShowNextStop(true);
            }, 2500);
        }
    };

    const handleCorrectAnswerFlow = (newScore, newBonusFact) => {
        // Is this a streak milestone?
        const isStreakMilestone = newScore === 5 || newScore === 10 || newScore === 15 ||
            newScore === 20 || (newScore > 20 && newScore % 5 === 0);

        if (isStreakMilestone) {
            // Show streak message from carrot
            setActiveCharacter("carrot");
            typeText(getStreakMessage(newScore), "carrot");

            // Then maybe bonus, then next
            setTimeout(() => {
                if (newBonusFact) {
                    setActiveCharacter("strawberry");
                    typeText(newBonusFact, "strawberry");
                    setTimeout(() => {
                        setActiveCharacter("carrot");
                        typeText("🥕 Want another question?", "carrot");
                        setShowNextStop(true);
                    }, 4500);
                } else {
                    setActiveCharacter("carrot");
                    typeText("🥕 Want another question?", "carrot");
                    setShowNextStop(true);
                }
            }, 2500);
        } else {
            // Not a streak milestone
            if (newBonusFact) {
                setActiveCharacter("strawberry");
                typeText(newBonusFact, "strawberry");

                // After full bonus fact
                setTimeout(() => {
                    setActiveCharacter("carrot");
                    typeText("🥕 Want another question?", "carrot");
                    setShowNextStop(true);
                }, 4500); // Increased delay after bonus fact by 1 second
            } else {
                // No bonus fact, delay before asking next question
                setTimeout(() => {
                    setActiveCharacter("carrot");
                    typeText("🥕 Want another question?", "carrot");
                    setShowNextStop(true);
                }, 1000); // Decreased delay by 0.5 seconds
            }
        }
    };

    const handleNext = () => {
        setShowNextStop(false);
        startCarrotBattle();
    };

    const handleStop = () => {
        setShowNextStop(false);
        setBattleMode(false);
        setQuiz(null);
        setScore(0);
        setActiveCharacter("carrot");
        typeText("🥕 Alright! Come back anytime!", "carrot");
        setTimeout(() => setDialogue(""), 2500);
    };

    // Close logic
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!event.target.closest(".carrot-container")) {
                setShowMenu(false);
                // Only clear dialogue if not in battle mode or critical interaction
                if (!battleMode && !showNextStop && !showStrawberryOptions) {
                    setDialogue("");
                }
            }
        };

        document.addEventListener("click", handleOutsideClick);
        return () => {
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [battleMode, showNextStop, showStrawberryOptions]);


    return (
        <CarrotContext.Provider value={{ say, setSmartFridgeCallback }}>
            {children}

            {/* GLOBAL OVERLAY */}
            <div className="carrot-container">
                {activeCharacter === "carrot" ? (
                    <img
                        src={carrotGuide}
                        alt="Carrot"
                        className="carrot-guide"
                        onClick={handleCarrotClick}
                    />
                ) : (
                    <img
                        src={strawberryGuide}
                        alt="Strawberry"
                        className="strawberry-guide"
                        onClick={handleCarrotClick}
                    />
                )}

                {(dialogue || showNextStop || showStrawberryOptions) && (
                    <div className={`thought-bubble ${bubbleClass}`}>
                        {dialogue && <p className="mb-2">{dialogue}</p>}

                        {showNextStop && (
                            <div className="d-grid gap-2 mt-2">
                                <button className="btn btn-sm btn-success" onClick={handleNext}>Give me another! 🎉</button>
                                <button className="btn btn-sm btn-secondary" onClick={handleStop}>I'm done for now! 🏁</button>
                            </div>
                        )}

                        {showStrawberryOptions && activeCharacter === "strawberry" && (
                            <div className="d-grid gap-2 mt-2">
                                <button className="btn btn-sm btn-danger" onClick={handleAnotherStrawberryTip}>Another Tip! 🍓</button>
                                <button className="btn btn-sm btn-warning" onClick={handleBackToCarrot} style={{ color: 'white' }}>Call Carrot Back! 🥕</button>
                            </div>
                        )}
                    </div>
                )}

                {showMenu && (
                    <div className="carrot-menu">
                        <p>{activeCharacter === "carrot" ? "🥕 Hi! I'm Carrot!" : "🍓 Hi! I'm Strawberry!"}  How may I help?</p>
                        <button onClick={handleMealTip}>Meal Tip ✅</button>
                        <button onClick={startCarrotBattle}>Carrot Battle 🥊</button>
                        <button onClick={handleStrawberryTip}>Strawberry's Dessert Tips 🍓</button>
                        <button onClick={handleSmartFridge}>Smart Fridge 🧊</button>
                    </div>
                )}

                {battleMode && quiz && !showNextStop && (
                    <div className="carrot-quiz">
                        <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>{quiz.question}</p>
                        {quiz.choices.map(c => (
                            <button key={c} className="btn btn-sm btn-light d-block w-100 mb-1" style={{ border: '1px solid #ddd' }} onClick={() => checkAnswer(c)}>{c}</button>
                        ))}
                    </div>
                )}
            </div>
        </CarrotContext.Provider>
    );
};
