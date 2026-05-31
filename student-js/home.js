import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const guestHome = document.getElementById("guestHome");
const loggedHome = document.getElementById("loggedHome");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const profileBtn = document.getElementById("profileBtn");
const profileInitial = document.getElementById("profileInitial");

const welcomeText = document.getElementById("welcomeText");
const categoryTitle = document.getElementById("categoryTitle");
const questionCount = document.getElementById("questionCount");
const lastAttempt = document.getElementById("lastAttempt");
const scoreText = document.getElementById("scoreText");
const progressFill = document.getElementById("progressFill");
const subjectHeader = document.getElementById("subjectHeader");
const subjectsList = document.getElementById("subjectsList");

const tabs = document.querySelectorAll(".tab");
const studyCards = document.querySelectorAll(".study-card");
const navButtons = document.querySelectorAll("[data-page]");

let currentUser = null;
let currentCategory = "general";

const categoryData = {
  general: {
    title: "General Education",
    header: "General Education Subjects",
    subjects: [

      [
        "English",
        "Grammar, Reading Comprehension, Literature",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M4 5h16"></path>
          <path d="M4 12h10"></path>
          <path d="M4 19h16"></path>
        </svg>
        `
      ],

      [
        "Filipino",
        "Gramatika, Panitikan",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M5 4h14v16H5z"></path>
          <path d="M9 8h6"></path>
          <path d="M9 12h6"></path>
        </svg>
        `
      ],

      [
        "Mathematics",
        "Basic Math, Statistics",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M7 7h10"></path>
          <path d="M7 17h10"></path>
          <path d="M12 7v10"></path>
        </svg>
        `
      ],

      [
        "Science",
        "Biology, Chemistry, Physics",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M10 2v6l-4 7a4 4 0 0 0 3.5 6h5a4 4 0 0 0 3.5-6l-4-7V2"></path>
        </svg>
        `
      ],

      [
        "Social Studies",
        "Philippine History, World History",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3 12h18"></path>
          <path d="M12 3a15 15 0 0 1 0 18"></path>
          <path d="M12 3a15 15 0 0 0 0 18"></path>
        </svg>
        `
      ]

    ]
  },

  professional: {
    title: "Professional Education",
    header: "Professional Education Subjects",
    subjects: [

      [
        "Teaching Profession",
        "Code of ethics, teacher roles",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"></path>
        </svg>
        `
      ],

      [
        "Assessment of Learning",
        "Tests, rubrics, evaluation",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        `
      ]

    ]
  },

  major: {
    title: "Major Education",
    header: "Major Subjects",
    subjects: [

      [
        "Major Reviewer",
        "Specialization-based LET review",
        `
        <svg viewBox="0 0 24 24" class="subject-svg">
          <path d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z"></path>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
        `
      ]

    ]
  }
};

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    showGuestHome();
    return;
  }

  showLoggedHome(user);
  await loadProgressFromFirebase(user.uid);
  renderCategory(currentCategory);
});

function showGuestHome() {
  guestHome.classList.remove("hidden");
  loggedHome.classList.add("hidden");

  profileInitial.textContent = "?";
}

function showLoggedHome(user) {
  guestHome.classList.add("hidden");
  loggedHome.classList.remove("hidden");

  const name =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Student";

  welcomeText.textContent = `Hello, ${name}!`;
  profileInitial.textContent = getInitial(name);
}

async function loadProgressFromFirebase(uid) {
  try {
    const attemptsRef = collection(db, "studentAttempts");
    const q = query(attemptsRef, where("studentId", "==", uid));
    const snap = await getDocs(q);

    const attempts = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    localStorage.setItem("leaflet_attempts", JSON.stringify(attempts));
  } catch (error) {
    console.warn("Using local/offline progress data:", error);
  }
}

function renderCategory(categoryKey) {
  const data = categoryData[categoryKey];

  categoryTitle.textContent = data.title;
  subjectHeader.textContent = data.header;

  const attempts = getLocalAttempts();
  const categoryAttempts = attempts.filter(item => item.category === categoryKey);

  const totalQuestions = data.subjects.length * 100;
  const answered = categoryAttempts.reduce((sum, item) => {
    return sum + Number(item.answered || 0);
  }, 0);

  const progress = totalQuestions > 0
    ? Math.min((answered / totalQuestions) * 100, 100)
    : 0;

  questionCount.textContent = `${totalQuestions} Overall Questions`;
  scoreText.textContent = `${answered}/${totalQuestions}`;
  progressFill.style.width = `${progress}%`;

  if (categoryAttempts.length > 0) {
    const latest = categoryAttempts
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))[0];

    lastAttempt.textContent = `Last Attempted: ${formatDate(latest.createdAt)}`;
  } else {
    lastAttempt.textContent = "Last Attempted: Not yet";
  }

  subjectsList.innerHTML = data.subjects.map(([title, desc, icon]) => `
    <button class="subject-card" type="button" data-subject="${escapeHtml(title)}">
      <div class="subject-icon">${icon}</div>
      <div class="subject-info">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(desc)}</p>
      </div>
    </button>
  `).join("");

  document.querySelectorAll(".subject-card").forEach(card => {
    card.addEventListener("click", () => {
      requireLogin(() => {
        const subject = card.dataset.subject;
        localStorage.setItem("leaflet_selected_category", categoryKey);
        localStorage.setItem("leaflet_selected_subject", subject);
        window.location.href = "./subject.html";
      });
    });
  });
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(item => item.classList.remove("active"));
    tab.classList.add("active");

    currentCategory = tab.dataset.category;
    renderCategory(currentCategory);
  });
});

studyCards.forEach(card => {
  card.addEventListener("click", () => {
    studyCards.forEach(item => item.classList.remove("active"));
    card.classList.add("active");

    requireLogin(() => {
      const route = card.dataset.route;
      window.location.href = `./${route}.html`;
    });
  });
});

navButtons.forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    if (page === "home") {
      window.location.href = "./home.html";
      return;
    }

    requireLogin(() => {
      const routes = {
        tasks: "./tasks.html",
        game: "./quiz.html",
        files: "./reviewer-files.html",
        profile: "./profile.html"
      };

      window.location.href = routes[page] || "./home.html";
    });
  });
});

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    window.location.href = "./student-login.html";
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", () => {
    window.location.href = "./student-register.html";
  });
}

if (profileBtn) {
  profileBtn.addEventListener("click", () => {
    requireLogin(() => {
      window.location.href = "./profile.html";
    });
  });
}

function requireLogin(callback) {
  if (!currentUser) {
    localStorage.setItem("leaflet_redirect_after_login", window.location.href);
    window.location.href = "./student-login.html";
    return;
  }

  callback();
}

function getLocalAttempts() {
  try {
    return JSON.parse(localStorage.getItem("leaflet_attempts")) || [];
  } catch {
    return [];
  }
}

function getInitial(name = "") {
  return name.trim().charAt(0).toUpperCase() || "?";
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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

renderCategory(currentCategory);