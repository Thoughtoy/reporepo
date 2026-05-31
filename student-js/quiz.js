import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const profileBtn = document.getElementById("profileBtn");
const profileInitial = document.getElementById("profileInitial");
const backBtn = document.getElementById("backBtn");

const quizHome = document.getElementById("quizHome");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");

const categoryGrid = document.getElementById("categoryGrid");
const questionLimitGroup = document.getElementById("questionLimitGroup");
const difficultyGroup = document.getElementById("difficultyGroup");
const timerToggle = document.getElementById("timerToggle");
const randomToggle = document.getElementById("randomToggle");
const reviewTip = document.getElementById("reviewTip");
const reviewTipText = document.getElementById("reviewTipText");
const recentAttempts = document.getElementById("recentAttempts");
const startQuizBtn = document.getElementById("startQuizBtn");

const activeCategoryTitle = document.getElementById("activeCategoryTitle");
const activeCategorySubtitle = document.getElementById("activeCategorySubtitle");
const timerChip = document.getElementById("timerChip");
const timerText = document.getElementById("timerText");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");
const quizCount = document.getElementById("quizCount");
const questionNumber = document.getElementById("questionNumber");
const questionText = document.getElementById("questionText");
const answersList = document.getElementById("answersList");
const historyBtn = document.getElementById("historyBtn");
const nextBtn = document.getElementById("nextBtn");

const retakeBtn = document.getElementById("retakeBtn");
const backHomeBtn = document.getElementById("backHomeBtn");

const resultSubtitle = document.getElementById("resultSubtitle");
const finalScoreNumber = document.getElementById("finalScoreNumber");
const finalTotal = document.getElementById("finalTotal");
const resultStatus = document.getElementById("resultStatus");
const finalTime = document.getElementById("finalTime");
const finalAccuracy = document.getElementById("finalAccuracy");
const moduleBreakdownList = document.getElementById("moduleBreakdownList");
const highModules = document.getElementById("highModules");
const lowModules = document.getElementById("lowModules");
const resultMessage = document.getElementById("resultMessage");

let currentUser = null;

let categories = [];
let questions = [];
let attempts = [];
let topicMap = {};

let selectedCategoryId = "all";
let selectedLimit = 10;
let selectedDifficulty = "All";

let activeQuestions = [];
let currentIndex = 0;
let score = 0;

let selectedAnswer = null;
let selectedAnswers = [];
let writtenAnswer = "";

let timerInterval = null;
let timeLeft = 30;

let quizStartedAt = null;
let moduleStats = {};

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
  await loadAttempts();

  renderCategories();
  renderRecentAttempts();
  renderReviewTip();
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
      .filter((q) => q.published !== false && q.questionText)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  } catch (error) {
    console.error("Failed to load questions:", error);
    questions = [];
  }
}

async function loadAttempts() {
  try {
    const snap = await getDocs(collection(db, "studentAttempts"));

    attempts = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .filter((item) => item.studentId === currentUser.uid)
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    localStorage.setItem("leaflet_attempts", JSON.stringify(attempts));
  } catch (error) {
    console.warn("Could not load attempts:", error);
    attempts = getLocalAttempts();
  }
}

function renderCategories() {
  const cards = [];

  categories.forEach((cat) => {
    const count = questions.filter((q) => q.categoryId === cat.id).length;

    cards.push(`
      <button class="category-card ${selectedCategoryId === cat.id ? "active" : ""}" type="button" data-category="${escapeHtml(cat.id)}">
        <div class="category-icon">${getCategoryIcon(cat.name)}</div>
        <strong>${escapeHtml(cat.name || "Untitled Category")}</strong>
        <span>${count} Available Questions</span>
      </button>
    `);
  });

  cards.push(`
    <button class="category-card ${selectedCategoryId === "all" ? "active" : ""}" type="button" data-category="all">
      <div class="category-icon">＋</div>
      <strong>All Categories</strong>
      <span>${questions.length} Available Questions</span>
    </button>
  `);

  categoryGrid.innerHTML = cards.join("");

  document.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedCategoryId = card.dataset.category;

      document.querySelectorAll(".category-card").forEach((item) => {
        item.classList.remove("active");
      });

      card.classList.add("active");
      renderReviewTip();
    });
  });
}

function renderRecentAttempts() {
  const latest = attempts.slice(0, 3);

  if (latest.length === 0) {
    recentAttempts.innerHTML = `
      <div class="recent-card">
        <div>
          <strong>No attempts yet</strong>
          <span>Your quiz results will appear here.</span>
        </div>
        <div class="score-badge">0%</div>
      </div>
    `;
    return;
  }

  recentAttempts.innerHTML = latest.map((item) => {
    const categoryName = item.categoryName || resolveCategoryName(item.categoryId) || "Quiz";
    const percentage = Number(item.percentage || 0);

    return `
      <div class="recent-card">
        <div>
          <strong>${escapeHtml(categoryName)}</strong>
          <span>${Number(item.total || 0)} Questions | ${formatDate(item.createdAt)}</span>
        </div>
        <div class="score-badge">${percentage}%</div>
      </div>
    `;
  }).join("");
}

function renderReviewTip() {
  const relatedAttempts = selectedCategoryId === "all"
    ? attempts
    : attempts.filter((item) => item.categoryId === selectedCategoryId);

  if (relatedAttempts.length === 0) {
    reviewTip.classList.add("hidden");
    return;
  }

  const latest = relatedAttempts[0];
  const percentage = Number(latest.percentage || 0);
  const categoryName = latest.categoryName || resolveCategoryName(latest.categoryId) || "this category";

  if (percentage >= 75) {
    reviewTip.classList.add("hidden");
    return;
  }

  reviewTipText.textContent =
    `You scored ${percentage}% on ${categoryName} last time. Consider reviewing it before retaking this quiz again.`;

  reviewTip.classList.remove("hidden");
}

questionLimitGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  selectedLimit = Number(button.dataset.limit);

  questionLimitGroup.querySelectorAll(".pill").forEach((item) => {
    item.classList.remove("active");
  });

  button.classList.add("active");
});

difficultyGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  selectedDifficulty = button.dataset.difficulty;

  difficultyGroup.querySelectorAll(".pill").forEach((item) => {
    item.classList.remove("active");
  });

  button.classList.add("active");
});

startQuizBtn.addEventListener("click", startQuiz);

function startQuiz() {
  let pool = [...questions];

  if (selectedCategoryId !== "all") {
    pool = pool.filter((q) => q.categoryId === selectedCategoryId);
  }

  if (selectedDifficulty !== "All") {
    pool = pool.filter((q) => {
      const difficulty = String(q.difficulty || "All").toLowerCase();
      return difficulty === selectedDifficulty.toLowerCase();
    });
  }

  if (pool.length === 0) {
    alert("No questions available for this setting yet.");
    return;
  }

  if (randomToggle.checked) {
    pool = shuffleArray(pool);
  }

  activeQuestions = pool.slice(0, selectedLimit);
  currentIndex = 0;
  score = 0;

  selectedAnswer = null;
  selectedAnswers = [];
  writtenAnswer = "";

  quizStartedAt = Date.now();
  moduleStats = {};

  quizHome.classList.add("hidden");
  resultScreen.classList.add("hidden");
  quizScreen.classList.remove("hidden");

  const categoryName = selectedCategoryId === "all"
    ? "All Categories"
    : resolveCategoryName(selectedCategoryId);

  activeCategoryTitle.textContent = categoryName;
  activeCategorySubtitle.textContent =
    randomToggle.checked
      ? "Questions are randomized on all subjects"
      : "Questions are arranged by saved order";

  renderQuestion();
}

function renderQuestion() {
  clearTimer();

  selectedAnswer = null;
  selectedAnswers = [];
  writtenAnswer = "";

  const q = activeQuestions[currentIndex];

  if (!q) {
    finishQuiz();
    return;
  }

  const percent = Math.round(((currentIndex + 1) / activeQuestions.length) * 100);

  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  quizCount.textContent = `${currentIndex + 1}/${activeQuestions.length}`;
  questionNumber.textContent = `Question no. ${currentIndex + 1}`;
  questionText.textContent = q.questionText;

  nextBtn.textContent =
    currentIndex === activeQuestions.length - 1 ? "Finish" : "Next";

  renderAnswers(q);

  if (timerToggle.checked) {
    startTimer();
  } else {
    timerChip.classList.add("hidden");
  }
}

function renderAnswers(q) {
  answersList.innerHTML = "";

  if (q.type === "Identification") {
    answersList.innerHTML = `
      <input class="identification-input" id="writtenAnswerInput" type="text" placeholder="Type your answer here">
    `;

    document.getElementById("writtenAnswerInput").addEventListener("input", (event) => {
      writtenAnswer = event.target.value.trim();
    });

    return;
  }

  if (q.type === "Enumeration") {
    const count = Math.max(q.correctIndexes?.length || q.choices?.length || 1, 1);

    answersList.innerHTML = Array.from({ length: count }).map((_, index) => `
      <input class="identification-input enum-input" type="text" placeholder="Answer ${index + 1}">
    `).join("");

    document.querySelectorAll(".enum-input").forEach((input) => {
      input.addEventListener("input", () => {
        selectedAnswers = [...document.querySelectorAll(".enum-input")]
          .map((item) => item.value.trim())
          .filter(Boolean);
      });
    });

    return;
  }

  const choices = q.choices || [];
  const letters = ["A.", "B.", "C.", "D.", "E.", "F."];

  choices.forEach((choice, index) => {
    if (!String(choice).trim()) return;

    const button = document.createElement("button");
    button.className = "answer-btn";
    button.type = "button";
    button.dataset.index = index;

    button.innerHTML = `
      <span class="letter">${letters[index] || `${index + 1}.`}</span>
      <span class="answer-text">${escapeHtml(choice)}</span>
    `;

    button.addEventListener("click", () => handleChoiceClick(button, q));

    answersList.appendChild(button);
  });
}

function handleChoiceClick(button, q) {
  const index = Number(button.dataset.index);

  if (q.multipleAnswer) {
    button.classList.toggle("selected");

    if (selectedAnswers.includes(index)) {
      selectedAnswers = selectedAnswers.filter((item) => item !== index);
    } else {
      selectedAnswers.push(index);
    }

    return;
  }

  document.querySelectorAll(".answer-btn").forEach((item) => {
    item.classList.remove("selected");
  });

  button.classList.add("selected");
  selectedAnswer = index;
}

nextBtn.addEventListener("click", () => {
  checkCurrentAnswer();

  if (currentIndex >= activeQuestions.length - 1) {
    finishQuiz();
    return;
  }

  currentIndex++;
  renderQuestion();
});

function checkCurrentAnswer() {
  const q = activeQuestions[currentIndex];
  if (!q) return;

  const moduleName =
    resolveTopicName(q.categoryId, q.topicId) ||
    resolveCategoryName(q.categoryId) ||
    "Module";

  if (!moduleStats[moduleName]) {
    moduleStats[moduleName] = {
      correct: 0,
      total: 0
    };
  }

  moduleStats[moduleName].total++;

  let isCorrect = false;

  if (q.type === "Identification") {
    const correct = normalizeText(q.choices?.[0] || "");
    const answer = normalizeText(writtenAnswer);

    isCorrect = Boolean(answer && answer === correct);
  }

  else if (q.type === "Enumeration") {
    const correctAnswers = (q.choices || []).map(normalizeText).filter(Boolean);
    const userAnswers = selectedAnswers.map(normalizeText).filter(Boolean);

    const allCorrect = correctAnswers.every((answer) => userAnswers.includes(answer));
    const sameLength = userAnswers.length === correctAnswers.length;

    isCorrect = allCorrect && sameLength;
  }

  else {
    const correctIndexes = q.correctIndexes || [];

    if (q.multipleAnswer) {
      const sortedUser = [...selectedAnswers].sort((a, b) => a - b).join(",");
      const sortedCorrect = [...correctIndexes].sort((a, b) => a - b).join(",");

      isCorrect = Boolean(sortedUser && sortedUser === sortedCorrect);
    } else {
      isCorrect = correctIndexes.includes(selectedAnswer);
    }
  }

  if (isCorrect) {
    score++;
    moduleStats[moduleName].correct++;
  }
}

async function finishQuiz() {
  clearTimer();

  const total = activeQuestions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const timeTaken = quizStartedAt ? Date.now() - quizStartedAt : 0;

  quizScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  renderResultScreen({
    score,
    total,
    percentage,
    timeTaken
  });

  await saveAttempt({
    score,
    total,
    percentage,
    timeTaken
  });
}

function renderResultScreen(result) {
  const categoryName = selectedCategoryId === "all"
    ? "All Categories"
    : resolveCategoryName(selectedCategoryId);

  resultSubtitle.textContent = categoryName;

  finalScoreNumber.textContent = result.score;
  finalTotal.textContent = `/${result.total}`;
  finalAccuracy.textContent = `${result.percentage}%`;
  finalTime.textContent = formatDuration(result.timeTaken);

  if (result.percentage >= 75) {
    resultStatus.textContent = "Passed";
    resultStatus.classList.remove("failed");
  } else {
    resultStatus.textContent = "Needs Review";
    resultStatus.classList.add("failed");
  }

  renderModuleBreakdown();
  renderResultMessage(result.percentage);
}

function renderModuleBreakdown() {
  const entries = Object.entries(moduleStats).map(([name, stat]) => {
    const percent = stat.total > 0
      ? Math.round((stat.correct / stat.total) * 100)
      : 0;

    return {
      name,
      percent,
      correct: stat.correct,
      total: stat.total
    };
  });

  moduleBreakdownList.innerHTML = entries.map((item) => `
    <div class="module-row">
      <span class="dot ${item.percent < 75 ? "weak" : ""}"></span>
      <span class="module-name">${escapeHtml(item.name)}</span>
      <div class="mini-line">
        <div style="width:${item.percent}%"></div>
      </div>
      <small>${item.percent}%</small>
    </div>
  `).join("");

  const high = entries.filter((item) => item.percent >= 80);
  const low = entries.filter((item) => item.percent < 75);

  highModules.innerHTML = high.length
    ? high.map((item) => `<li>${escapeHtml(item.name)}</li>`).join("")
    : "<li>No high-scoring module yet</li>";

  lowModules.innerHTML = low.length
    ? low.map((item) => `<li>${escapeHtml(item.name)}</li>`).join("")
    : "<li>No weak module detected</li>";
}

function renderResultMessage(percentage) {
  if (percentage >= 90) {
    resultMessage.textContent =
      "Excellent job! You showed strong mastery in this quiz. Keep maintaining your review momentum.";
  } else if (percentage >= 75) {
    resultMessage.textContent =
      "Great job! You passed this quiz, but you can still review the lower-scoring modules to improve further.";
  } else {
    resultMessage.textContent =
      "Good attempt! Focus on the modules under Needs More Practice, then try again after reviewing.";
  }
}

async function saveAttempt(result) {
  const categoryName = selectedCategoryId === "all"
    ? "All Categories"
    : resolveCategoryName(selectedCategoryId);

  const attemptData = {
    studentId: currentUser.uid,
    studentEmail: currentUser.email || "",
    categoryId: selectedCategoryId,
    category: selectedCategoryId,
    categoryName,
    score: result.score,
    total: result.total,
    answered: result.total,
    percentage: result.percentage,
    timeTaken: result.timeTaken || 0,
    difficulty: selectedDifficulty,
    timerEnabled: timerToggle.checked,
    randomized: randomToggle.checked,
    moduleStats,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "studentAttempts"), attemptData);
    await loadAttempts();
  } catch (error) {
    console.error("Failed to save attempt:", error);

    const localAttempts = getLocalAttempts();
    localAttempts.unshift({
      ...attemptData,
      createdAt: new Date().toISOString()
    });

    localStorage.setItem("leaflet_attempts", JSON.stringify(localAttempts));
  }
}

function startTimer() {
  timeLeft = 30;
  timerChip.classList.remove("hidden");
  updateTimerText();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerText();

    if (timeLeft <= 0) {
      clearTimer();
      checkCurrentAnswer();

      if (currentIndex >= activeQuestions.length - 1) {
        finishQuiz();
      } else {
        currentIndex++;
        renderQuestion();
      }
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerText() {
  timerText.textContent = `00:${String(timeLeft).padStart(2, "0")}`;
}

retakeBtn.addEventListener("click", () => {
  resultScreen.classList.add("hidden");
  startQuiz();
});

backHomeBtn.addEventListener("click", async () => {
  resultScreen.classList.add("hidden");
  quizHome.classList.remove("hidden");

  await loadAttempts();
  renderRecentAttempts();
  renderReviewTip();
});

historyBtn.addEventListener("click", () => {
  alert("Quiz history is shown on the quiz home page under Recent Attempts.");
});

backBtn.addEventListener("click", () => {
  if (!quizScreen.classList.contains("hidden")) {
    const confirmExit = confirm("Leave this quiz? Your current progress will not be saved.");
    if (!confirmExit) return;

    clearTimer();
    quizScreen.classList.add("hidden");
    quizHome.classList.remove("hidden");
    return;
  }

  if (!resultScreen.classList.contains("hidden")) {
    resultScreen.classList.add("hidden");
    quizHome.classList.remove("hidden");
    return;
  }

  window.location.href = "./home.html";
});

profileBtn.addEventListener("click", () => {
  window.location.href = "./profile.html";
});

function resolveCategoryName(categoryId) {
  if (categoryId === "all") return "All Categories";

  const category = categories.find((cat) => cat.id === categoryId);
  return category?.name || "Category";
}

function resolveTopicName(categoryId, topicId) {
  if (!topicId) return "Module";

  const topics = topicMap[categoryId] || [];
  const topic = topics.find((item) => item.id === topicId);

  if (topic?.name) {
    return topic.name;
  }

  const exactQuestion = questions.find((item) =>
    item.categoryId === categoryId &&
    item.topicId === topicId &&
    item.topicName
  );

  if (exactQuestion?.topicName) {
    return exactQuestion.topicName;
  }

  return cleanTopicName(topicId);
}

function cleanTopicName(topicId = "") {
  if (!topicId) return "Module";

  return String(topicId)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCategoryIcon(name = "") {
  const lower = name.toLowerCase();

  if (lower.includes("general")) return "▦";
  if (lower.includes("professional")) return "✍";
  if (lower.includes("major")) return "▣";

  return "📘";
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

function normalizeText(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getMillis(timestamp) {
  if (!timestamp) return 0;
  if (timestamp.toDate) return timestamp.toDate().getTime();
  if (timestamp.seconds) return timestamp.seconds * 1000;

  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(timestamp) {
  if (!timestamp) return "Not yet";

  const date = timestamp.toDate
    ? timestamp.toDate()
    : timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Not yet";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getLocalAttempts() {
  try {
    return JSON.parse(localStorage.getItem("leaflet_attempts")) || [];
  } catch {
    return [];
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}