import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const questionCount = document.getElementById("questionCount");
const progressPercent = document.getElementById("progressPercent");
const progressBar = document.getElementById("progressBar");
const timerEl = document.getElementById("timer");
const profileInitial = document.getElementById("profileInitial");

const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

let questions = [];
let currentQuestion = 0;
let selectedAnswers = {};

let totalSeconds = 7200;

function startTimer() {

  setInterval(() => {

    if (totalSeconds <= 0) return;

    totalSeconds--;

    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");

    timerEl.textContent = `${hrs}:${mins}:${secs}`;

  }, 1000);
}

function renderQuestion() {

  const question = questions[currentQuestion];

  if (!question) return;

  questionText.textContent =
  question.questionText;

  questionCount.textContent =
    `Question ${currentQuestion + 1}/${questions.length}`;

  const progress =
    ((currentQuestion + 1) / questions.length) * 100;

  progressPercent.textContent =
    `${Math.round(progress)}%`;

  progressBar.style.width =
    `${progress}%`;

  optionsContainer.innerHTML = "";

  question.choices.forEach((option, index) => {

    const button = document.createElement("button");

    button.className = "option-btn";

    if (selectedAnswers[currentQuestion] === index) {
      button.classList.add("selected");
    }

    button.innerHTML = `
      <span class="option-letter">
        ${String.fromCharCode(65 + index)}.
      </span>

      <span class="option-text">
        ${option}
      </span>
    `;

    button.addEventListener("click", () => {

      selectedAnswers[currentQuestion] = index;

      renderQuestion();

    });

    optionsContainer.appendChild(button);

  });

}

async function loadQuestions() {

  try {

    const snapshot = await getDocs(
      collection(db, "questions")
    );

    questions = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(question => {

        return (
            question.published === true &&
            question.questionText &&
            Array.isArray(question.choices) &&
            question.choices.length > 0
        );

     })
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    console.log("Loaded Questions:", questions);

    renderQuestion();

  } catch (error) {

    console.error("Error loading questions:", error);

    questionText.textContent =
      "Failed to load questions.";

  }

}   

nextBtn.addEventListener("click", () => {

  if (currentQuestion < questions.length - 1) {

    currentQuestion++;

    renderQuestion();

  }

});

prevBtn.addEventListener("click", () => {

  if (currentQuestion > 0) {

    currentQuestion--;

    renderQuestion();

  }

});

document.getElementById("backBtn")
.addEventListener("click", () => {

  window.history.back();

});

document.getElementById("exitBtn")
.addEventListener("click", () => {

  const confirmExit =
    confirm("Exit exam simulation?");

  if (confirmExit) {

    window.location.href =
      "dashboard.html";

  }

});

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href =
      "../index.html";

    return;

  }

  const name =
    user.displayName ||
    user.email ||
    "Student";

  profileInitial.textContent =
    name.charAt(0).toUpperCase();

  await loadQuestions();

  startTimer();

});