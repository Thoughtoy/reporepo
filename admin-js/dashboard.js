import app from "../firebase-config.js";
import { showFlash } from "../flash/flash.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

const heroTitle = $("heroTitle");
const heroSub = $("heroSub");
const noticeTxt = $("noticeTxt");

const statQuestions = $("statQuestions");
const statStudents = $("statStudents");
const statAvgScore = $("statAvgScore");
const statAttempts = $("statAttempts");

const categoryChart = $("categoryChart");
const recentActivity = $("recentActivity");
const topStudentsTbody = $("topStudentsTbody");

const viewReportsBtn = $("viewReportsBtn");
const viewStudentsBtn = $("viewStudentsBtn");
const viewClassesBtn = $("viewClassesBtn");
const refreshBtn = $("refreshBtn");
const questionsCard = $("questionsCard");
const studentsCard = $("studentsCard");

let students = [];
let attempts = [];
let questions = [];
let classes = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const firstName =
    user.displayName?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "Admin";

  if (heroTitle) heroTitle.textContent = `${greeting()}, ${firstName}!`;
  if (heroSub) heroSub.textContent = "Here's a snapshot of LeafLET activity.";

  await loadDashboard();
});

async function loadDashboard() {
  setLoadingState();

  await Promise.all([
    loadQuestions(),
    loadStudents(),
    loadAttempts(),
    loadClasses()
  ]);

  renderStats();
  renderClassScores();
  renderRecentActivity();
  renderTopStudents();
}

function setLoadingState() {
  if (statQuestions) statQuestions.textContent = "—";
  if (statStudents) statStudents.textContent = "—";
  if (statAvgScore) statAvgScore.textContent = "—";
  if (statAttempts) statAttempts.textContent = "—";

  if (categoryChart) {
    categoryChart.innerHTML = `<div class="empty-state">Loading class scores...</div>`;
  }

  if (recentActivity) {
    recentActivity.innerHTML = `<div class="empty-state">Loading activity...</div>`;
  }

  if (topStudentsTbody) {
    topStudentsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">Loading...</td>
      </tr>
    `;
  }
}

async function loadQuestions() {
  try {
    const countSnap = await getCountFromServer(collection(db, "questions"));

    if (statQuestions) {
      statQuestions.textContent = countSnap.data().count;
    }

    const snap = await getDocs(collection(db, "questions"));

    questions = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("Failed to load questions:", error);

    questions = [];

    if (statQuestions) statQuestions.textContent = "0";
  }
}

async function loadStudents() {
  try {
    const snap = await getDocs(collection(db, "students"));

    students = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("Failed to load students:", error);
    students = [];
  }
}

async function loadAttempts() {
  try {
    const snap = await getDocs(collection(db, "attempts"));

    attempts = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("Failed to load attempts:", error);
    attempts = [];
  }
}

async function loadClasses() {
  try {
    const snap = await getDocs(collection(db, "classes"));

    classes = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("Failed to load classes:", error);
    classes = [];
  }
}

function renderStats() {
  const activeStudentCount = students.filter(
    (student) => student.status === "active" || student.status === "Active"
  ).length;

  if (statStudents) statStudents.textContent = activeStudentCount;
  if (statAttempts) statAttempts.textContent = attempts.length;

  if (attempts.length === 0) {
    if (statAvgScore) statAvgScore.textContent = "—";
    if (noticeTxt) noticeTxt.textContent = "No quiz attempts recorded yet.";
    return;
  }

  const avg =
    attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) /
    attempts.length;

  if (statAvgScore) statAvgScore.textContent = `${avg.toFixed(1)}%`;

  if (noticeTxt) {
    noticeTxt.textContent =
      `${attempts.length} quiz attempts recorded from ${students.length} students across ${classes.length} classes.`;
  }
}

function renderClassScores() {
  if (!categoryChart) return;

  if (attempts.length === 0) {
    categoryChart.innerHTML = `<div class="empty-state">No attempt data available yet.</div>`;
    return;
  }

  const classStats = {};

  attempts.forEach((attempt) => {
    const className =
      attempt.className ||
      getClassName(attempt.classId) ||
      "Unassigned";

    if (!classStats[className]) {
      classStats[className] = {
        total: 0,
        count: 0
      };
    }

    classStats[className].total += Number(attempt.score || 0);
    classStats[className].count += 1;
  });

  const sorted = Object.entries(classStats)
    .map(([className, data]) => ({
      className,
      average: data.total / data.count,
      attempts: data.count
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);

  categoryChart.innerHTML = sorted.map((item) => `
    <div class="chart-item">
      <div class="chart-top">
        <span>${escapeHtml(item.className)}</span>
        <span>${item.average.toFixed(1)}%</span>
      </div>

      <div class="chart-bar">
        <div class="chart-fill" style="width: ${Math.min(item.average, 100)}%;"></div>
      </div>
    </div>
  `).join("");
}

function renderRecentActivity() {
  if (!recentActivity) return;

  if (attempts.length === 0) {
    recentActivity.innerHTML = `<div class="empty-state">No recent activity yet.</div>`;
    return;
  }

  const sorted = [...attempts]
    .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
    .slice(0, 5);

  recentActivity.innerHTML = sorted.map((item) => `
    <div class="activity-item">
      <strong>${escapeHtml(item.studentName || "Student")} scored ${Number(item.score || 0)}%</strong>
      <span>${escapeHtml(item.className || getClassName(item.classId))} • ${formatDate(item.createdAt)}</span>
    </div>
  `).join("");
}

function renderTopStudents() {
  if (!topStudentsTbody) return;

  if (students.length === 0) {
    topStudentsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">No student records found.</td>
      </tr>
    `;
    return;
  }

  const stats = students
    .map((student) => {
      const studentAttempts = attempts.filter(
        (attempt) => attempt.studentId === student.id
      );

      const count = studentAttempts.length;

      const average = count
        ? studentAttempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / count
        : 0;

      return {
        ...student,
        attempts: count,
        average
      };
    })
    .filter((student) => student.attempts > 0)
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);

  if (stats.length === 0) {
    topStudentsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">No quiz attempts yet.</td>
      </tr>
    `;
    return;
  }

  topStudentsTbody.innerHTML = stats.map((student) => `
    <tr>
      <td>${escapeHtml(student.fullName || student.studentName || "—")}</td>
      <td>${escapeHtml(student.className || getClassName(student.classId))}</td>
      <td>${student.attempts}</td>
      <td>${student.average.toFixed(1)}%</td>
    </tr>
  `).join("");
}

function getClassName(classId) {
  if (!classId) return "Unassigned";

  const found = classes.find((item) => item.id === classId);

  return found?.className || found?.name || "Unassigned";
}

function getMillis(timestamp) {
  if (!timestamp) return 0;
  if (timestamp.toDate) return timestamp.toDate().getTime();
  if (timestamp.seconds) return timestamp.seconds * 1000;

  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown date";

  const date = timestamp.toDate
    ? timestamp.toDate()
    : timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function greeting() {
  const h = new Date().getHours();

  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (viewReportsBtn) {
  viewReportsBtn.addEventListener("click", () => {
    window.location.href = "students.html";
  });
}

if (viewStudentsBtn) {
  viewStudentsBtn.addEventListener("click", () => {
    window.location.href = "students.html";
  });
}

if (viewClassesBtn) {
  viewClassesBtn.addEventListener("click", () => {
    window.location.href = "categories.html";
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", async () => {
    await loadDashboard();
  });
}

if (questionsCard) {
  questionsCard.addEventListener("click", () => {
    window.location.href = "questions.html";
  });
}

if (studentsCard) {
  studentsCard.addEventListener("click", () => {
    window.location.href = "students.html";
  });
}