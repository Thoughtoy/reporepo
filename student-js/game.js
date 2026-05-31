import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const profileBtn = document.getElementById("profileBtn");
const profileInitial = document.getElementById("profileInitial");
const pointsText = document.getElementById("pointsText");
const backBtn = document.getElementById("backBtn");

const profileScreen = document.getElementById("profileScreen");
const arenaScreen = document.getElementById("arenaScreen");
const gameResultScreen = document.getElementById("gameResultScreen");

const editProfileBtn = document.getElementById("editProfileBtn");
const gameLevelText = document.getElementById("gameLevelText");
const latestBadgeText = document.getElementById("latestBadgeText");
const pointsPillText = document.getElementById("pointsPillText");
const achievementGrid = document.getElementById("achievementGrid");
const badgeList = document.getElementById("badgeList");
const startGameBtn = document.getElementById("startGameBtn");

const arenaTitle = document.getElementById("arenaTitle");
const arenaSubtitle = document.getElementById("arenaSubtitle");
const timerText = document.getElementById("timerText");
const roundCount = document.getElementById("roundCount");
const progressFill = document.getElementById("progressFill");
const comboText = document.getElementById("comboText");
const comboBonusText = document.getElementById("comboBonusText");
const categoryChip = document.getElementById("categoryChip");
const arenaQuestionText = document.getElementById("arenaQuestionText");
const arenaAnswersList = document.getElementById("arenaAnswersList");
const xpPanel = document.getElementById("xpPanel");
const xpPanelTitle = document.getElementById("xpPanelTitle");
const xpPanelSubtitle = document.getElementById("xpPanelSubtitle");
const xpValue = document.getElementById("xpValue");
const factText = document.getElementById("factText");
const nextRoundBtn = document.getElementById("nextRoundBtn");

const gameFinalXP = document.getElementById("gameFinalXP");
const gameFinalDetails = document.getElementById("gameFinalDetails");
const playAgainBtn = document.getElementById("playAgainBtn");
const backProfileBtn = document.getElementById("backProfileBtn");

let currentUser = null;

let categories = [];
let topicMap = {};
let questions = [];

let gameProfile = {
  points: 0,
  level: "Beginner",
  latestBadge: "New Challenger",
  achievements: [],
  streakDays: 0
};

let activeQuestions = [];
let currentIndex = 0;
let roundLimit = 15;
let earnedXP = 0;
let correctCount = 0;
let combo = 0;
let bestCombo = 0;
let selectedAnswer = null;
let answered = false;

let timerInterval = null;
let timeLeft = 34;
let gameStartedAt = null;

const ACHIEVEMENTS = [
  {
    id: "master-gened",
    title: "Master GenEd",
    icon: "🏆",
    condition: () => correctCount >= 5
  },
  {
    id: "topic-finisher",
    title: "Topic Finisher",
    icon: "🏅",
    condition: () => currentIndex + 1 >= roundLimit
  },
  {
    id: "major-specialist",
    title: "Major Specialist",
    icon: "⭐",
    condition: () => earnedXP >= 100
  },
  {
    id: "subject-expert",
    title: "Subject Expert",
    icon: "🥇",
    condition: () => bestCombo >= 3
  },
  {
    id: "master-profed",
    title: "Master ProfEd",
    icon: "🏆",
    condition: () => correctCount >= 10
  },
  {
    id: "points-collector",
    title: "Points Collector",
    icon: "🏵️",
    condition: () => earnedXP >= 150
  }
];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./student-login.html";
    return;
  }

  currentUser = user;

  const name = user.displayName || user.email?.split("@")[0] || "Student";
  profileInitial.textContent = getInitial(name);

  await loadCategories();
  await loadQuestions();
  await loadGameProfile();

  renderProfileScreen();
});

async function loadCategories() {
  try {
    const snap = await getDocs(
      query(collection(db, "categories"), orderBy("order", "asc"))
    );

    categories = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    topicMap = {};

    for (const catDoc of snap.docs) {
      const topicSnap = await getDocs(
        query(
          collection(db, "categories", catDoc.id, "topics"),
          orderBy("order", "asc")
        )
      );

      topicMap[catDoc.id] = topicSnap.docs.map((topicDoc) => ({
        id: topicDoc.id,
        ...topicDoc.data()
      }));
    }
  } catch (error) {
    console.error("Failed to load categories/topics:", error);
    categories = [];
    topicMap = {};
  }
}

async function loadQuestions() {
  try {
    const snap = await getDocs(collection(db, "questions"));

    questions = snap.docs
      .map((docSnap, index) => ({
        id: docSnap.id,
        order: index,
        ...docSnap.data()
      }))
      .filter((q) => q.published !== false && q.questionText && Array.isArray(q.choices))
      .filter((q) => q.type === "Multiple Choice" || !q.type)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  } catch (error) {
    console.error("Failed to load questions:", error);
    questions = [];
  }
}

async function loadGameProfile() {
  try {
    const ref = doc(db, "gameProfiles", currentUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const starterProfile = {
        studentId: currentUser.uid,
        studentEmail: currentUser.email || "",
        points: 0,
        level: "Beginner",
        latestBadge: "New Challenger",
        achievements: [],
        streakDays: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(ref, starterProfile);

      gameProfile = {
        points: 0,
        level: "Beginner",
        latestBadge: "New Challenger",
        achievements: [],
        streakDays: 0
      };

      return;
    }

    gameProfile = {
      points: Number(snap.data().points || 0),
      level: snap.data().level || "Beginner",
      latestBadge: snap.data().latestBadge || "New Challenger",
      achievements: Array.isArray(snap.data().achievements) ? snap.data().achievements : [],
      streakDays: Number(snap.data().streakDays || 0)
    };
  } catch (error) {
    console.error("Failed to load game profile:", error);
  }
}

function renderProfileScreen() {
  profileScreen.classList.remove("hidden");
  arenaScreen.classList.add("hidden");
  gameResultScreen.classList.add("hidden");

  pointsText.textContent = `${gameProfile.points} ⚡`;
  pointsPillText.textContent = `${gameProfile.points}pts`;
  gameLevelText.textContent = getLevelName(gameProfile.points);
  latestBadgeText.textContent = gameProfile.latestBadge || "New Challenger";

  renderAchievements();
  renderBadgeList();
}

function renderAchievements() {
  achievementGrid.innerHTML = ACHIEVEMENTS.map((item) => {
    const unlocked = gameProfile.achievements.includes(item.id);

    return `
      <div class="achievement-item ${unlocked ? "unlocked" : "locked"}">
        <div class="achievement-icon">${unlocked ? item.icon : "🔒"}</div>
        <strong>${escapeHtml(item.title)}</strong>
      </div>
    `;
  }).join("");
}

function renderBadgeList() {
  const points = Number(gameProfile.points || 0);

  badgeList.innerHTML = `
    <div class="badge-row">
      <span class="badge-shape gold"></span>
      <span>Gold</span>
      <small>${points >= 1000 ? "Unlocked" : "1000 - Points Goal"}</small>
    </div>

    <div class="badge-row">
      <span class="badge-shape silver"></span>
      <span>Silver</span>
      <small>${points >= 650 ? "Unlocked" : "650 - Points Goal"}</small>
    </div>

    <div class="badge-row">
      <span class="badge-shape bronze"></span>
      <span>Bronze</span>
      <small>${points >= 300 ? "Unlocked" : "300 - Points Goal"}</small>
    </div>
  `;
}

function startGame() {
  if (questions.length === 0) {
    alert("No game questions available yet. Please add published multiple-choice questions first.");
    return;
  }

  activeQuestions = shuffleArray(questions).slice(0, roundLimit);
  currentIndex = 0;
  earnedXP = 0;
  correctCount = 0;
  combo = 0;
  bestCombo = 0;
  selectedAnswer = null;
  answered = false;
  gameStartedAt = Date.now();

  profileScreen.classList.add("hidden");
  gameResultScreen.classList.add("hidden");
  arenaScreen.classList.remove("hidden");

  xpPanel.classList.add("hidden");
  nextRoundBtn.classList.add("hidden");

  renderArenaQuestion();
}

function renderArenaQuestion() {
  clearTimer();

  selectedAnswer = null;
  answered = false;

  const q = activeQuestions[currentIndex];

  if (!q) {
    finishGame();
    return;
  }

  const categoryName = resolveCategoryName(q.categoryId);
  const topicName = resolveTopicName(q.categoryId, q.topicId);

  arenaTitle.textContent = "LeafLET Arena";
  arenaSubtitle.textContent = `${categoryName} - Round ${currentIndex + 1}`;
  roundCount.textContent = `Q${currentIndex + 1}/${activeQuestions.length}`;
  progressFill.style.width = `${Math.round(((currentIndex + 1) / activeQuestions.length) * 100)}%`;

  comboText.textContent = combo > 0 ? `${combo}x Combo!` : "Build your combo!";
  comboBonusText.textContent = combo > 0 ? `+${combo * 2} XP Bonus` : "+0 XP Bonus";

  categoryChip.textContent = topicName;
  arenaQuestionText.textContent = q.questionText;

  xpPanel.classList.add("hidden");
  nextRoundBtn.classList.add("hidden");

  renderArenaAnswers(q);
  startTimer();
}

function renderArenaAnswers(q) {
  arenaAnswersList.innerHTML = "";

  const letters = ["A.", "B.", "C.", "D.", "E.", "F."];

  (q.choices || []).forEach((choice, index) => {
    if (!String(choice).trim()) return;

    const button = document.createElement("button");
    button.className = "answer-btn";
    button.type = "button";
    button.dataset.index = index;

    button.innerHTML = `
      <span class="letter">${letters[index] || `${index + 1}.`}</span>
      <span class="answer-text">${escapeHtml(choice)}</span>
    `;

    button.addEventListener("click", () => selectAnswer(button, q));

    arenaAnswersList.appendChild(button);
  });
}

function selectAnswer(button, q) {
  if (answered) return;

  selectedAnswer = Number(button.dataset.index);
  answered = true;

  clearTimer();

  const correctIndexes = q.correctIndexes || [];
  const isCorrect = correctIndexes.includes(selectedAnswer);

  document.querySelectorAll("#arenaAnswersList .answer-btn").forEach((item) => {
    const itemIndex = Number(item.dataset.index);

    item.disabled = true;

    if (correctIndexes.includes(itemIndex)) {
      item.classList.add("correct");
    }

    if (itemIndex === selectedAnswer && !isCorrect) {
      item.classList.add("wrong");
    }
  });

  applyRoundResult(isCorrect);
}

function applyRoundResult(isCorrect) {
  let roundXP = 0;

  if (isCorrect) {
    correctCount++;
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    roundXP = 20 + combo * 2;
    earnedXP += roundXP;

    xpPanelTitle.textContent = "CORRECT! Combo Bonus Applied!";
    xpPanelSubtitle.textContent = "You earned points for this round.";
    xpValue.textContent = `+${roundXP}XP`;
    factText.textContent =
      "The XP bonuses you accumulate can be used to unlock new badges and improve your achievement level.";
  } else {
    combo = 0;
    roundXP = 5;
    earnedXP += roundXP;

    xpPanelTitle.textContent = "Nice try! Keep going!";
    xpPanelSubtitle.textContent = "You still earned participation XP.";
    xpValue.textContent = `+${roundXP}XP`;
    factText.textContent =
      "Mistakes help you identify what to review next. Keep answering to build your learning streak.";
  }

  comboText.textContent = combo > 0 ? `${combo}x Combo!` : "Combo Reset";
  comboBonusText.textContent = combo > 0 ? `+${combo * 2} XP Bonus` : "+0 XP Bonus";

  xpPanel.classList.remove("hidden");
  nextRoundBtn.classList.remove("hidden");
}

function startTimer() {
  timeLeft = 34;
  updateTimer();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();

    if (timeLeft <= 0) {
      clearTimer();
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (answered) return;

  answered = true;
  combo = 0;
  earnedXP += 3;

  const q = activeQuestions[currentIndex];
  const correctIndexes = q.correctIndexes || [];

  document.querySelectorAll("#arenaAnswersList .answer-btn").forEach((item) => {
    const itemIndex = Number(item.dataset.index);
    item.disabled = true;

    if (correctIndexes.includes(itemIndex)) {
      item.classList.add("correct");
    }
  });

  xpPanelTitle.textContent = "Time's up!";
  xpPanelSubtitle.textContent = "You still earned effort XP.";
  xpValue.textContent = "+3XP";
  factText.textContent =
    "Try answering faster next round. Speed and accuracy help you earn better XP bonuses.";

  comboText.textContent = "Combo Reset";
  comboBonusText.textContent = "+0 XP Bonus";

  xpPanel.classList.remove("hidden");
  nextRoundBtn.classList.remove("hidden");
}

function nextRound() {
  if (!answered) {
    alert("Please answer first before proceeding.");
    return;
  }

  if (currentIndex >= activeQuestions.length - 1) {
    finishGame();
    return;
  }

  currentIndex++;
  renderArenaQuestion();
}

async function finishGame() {
  clearTimer();

  arenaScreen.classList.add("hidden");
  gameResultScreen.classList.remove("hidden");

  const total = activeQuestions.length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  gameFinalXP.textContent = `+${earnedXP}XP`;
  gameFinalDetails.textContent =
    `You answered ${correctCount}/${total} correctly with ${bestCombo}x best combo. Accuracy: ${accuracy}%.`;

  await saveGameResult({
    total,
    accuracy
  });

  await loadGameProfile();
}

async function saveGameResult(result) {
  const unlockedNow = getUnlockedAchievements();
  const mergedAchievements = Array.from(
    new Set([...(gameProfile.achievements || []), ...unlockedNow])
  );

  const nextPoints = Number(gameProfile.points || 0) + Number(earnedXP || 0);
  const nextLevel = getLevelName(nextPoints);
  const latestBadge = getLatestBadge(nextPoints, mergedAchievements);

  const profileRef = doc(db, "gameProfiles", currentUser.uid);

  try {
    await setDoc(
      profileRef,
      {
        studentId: currentUser.uid,
        studentEmail: currentUser.email || "",
        points: nextPoints,
        level: nextLevel,
        latestBadge,
        achievements: mergedAchievements,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await addDoc(collection(db, "gameAttempts"), {
      studentId: currentUser.uid,
      studentEmail: currentUser.email || "",
      earnedXP,
      correctCount,
      total: result.total,
      accuracy: result.accuracy,
      bestCombo,
      timeTaken: gameStartedAt ? Date.now() - gameStartedAt : 0,
      createdAt: serverTimestamp()
    });

    gameProfile = {
      ...gameProfile,
      points: nextPoints,
      level: nextLevel,
      latestBadge,
      achievements: mergedAchievements
    };

    pointsText.textContent = `${gameProfile.points} ⚡`;
  } catch (error) {
    console.error("Failed to save game result:", error);
    alert("Game finished, but saving points failed. Please check Firestore rules.");
  }
}

function getUnlockedAchievements() {
  return ACHIEVEMENTS
    .filter((item) => item.condition())
    .map((item) => item.id);
}

function getLatestBadge(points, achievements = []) {
  if (points >= 1000) return "Gold Achiever";
  if (points >= 650) return "Silver Achiever";
  if (points >= 300) return "Bronze Achiever";

  const latestAchievement = ACHIEVEMENTS.find((item) =>
    achievements.includes(item.id)
  );

  return latestAchievement?.title || "New Challenger";
}

function getLevelName(points) {
  if (points >= 1000) return "Master GenEd";
  if (points >= 650) return "Advanced Learner";
  if (points >= 300) return "Rising Reviewer";
  if (points >= 100) return "GenEd Level";
  return "Beginner";
}

function updateTimer() {
  timerText.textContent = `00:${String(timeLeft).padStart(2, "0")}`;
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

startGameBtn.addEventListener("click", startGame);
nextRoundBtn.addEventListener("click", nextRound);

playAgainBtn.addEventListener("click", () => {
  gameResultScreen.classList.add("hidden");
  startGame();
});

backProfileBtn.addEventListener("click", () => {
  renderProfileScreen();
});

editProfileBtn.addEventListener("click", () => {
  window.location.href = "./profile.html";
});

profileBtn.addEventListener("click", () => {
  window.location.href = "./profile.html";
});

backBtn.addEventListener("click", () => {
  if (!arenaScreen.classList.contains("hidden")) {
    const leave = confirm("Leave the game? Current round progress will not be saved.");
    if (!leave) return;

    clearTimer();
    renderProfileScreen();
    return;
  }

  if (!gameResultScreen.classList.contains("hidden")) {
    renderProfileScreen();
    return;
  }

  window.location.href = "./home.html";
});

function resolveCategoryName(categoryId) {
  const category = categories.find((cat) => cat.id === categoryId);
  return category?.name || "General Education";
}

function resolveTopicName(categoryId, topicId) {
  const topics = topicMap[categoryId] || [];
  const topic = topics.find((item) => item.id === topicId);

  return topic?.name || cleanTopicName(topicId) || resolveCategoryName(categoryId);
}

function cleanTopicName(value = "") {
  if (!value) return "";

  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitial(name = "") {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function shuffleArray(array) {
  return array
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}