import app from "../firebase-config.js";
import { showFlash } from "../flash/flash.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const db = getFirestore(app);

let students = [];
let classes = [];
let attempts = [];
let editingStudentId = null;
let activeTab = "records";

const tabButtons = document.querySelectorAll(".tab-btn");
const recordsTab = document.getElementById("recordsTab");
const performanceTab = document.getElementById("performanceTab");

const totalStudents = document.getElementById("totalStudents");
const activeStudents = document.getElementById("activeStudents");
const averageScore = document.getElementById("averageScore");
const totalAttempts = document.getElementById("totalAttempts");

const studentTableBody = document.getElementById("studentTableBody");
const performanceTableBody = document.getElementById("performanceTableBody");
const performanceNote = document.getElementById("performanceNote");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const classFilter = document.getElementById("classFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const rankingFilter = document.getElementById("rankingFilter");
const orderFilter = document.getElementById("orderFilter");
const refreshPerformanceBtn = document.getElementById("refreshPerformanceBtn");

const addStudentBtn = document.getElementById("addStudentBtn");
const studentModal = document.getElementById("studentModal");
const studentModalTitle = document.getElementById("studentModalTitle");
const studentNameInput = document.getElementById("studentNameInput");
const studentEmailInput = document.getElementById("studentEmailInput");
const studentClassInput = document.getElementById("studentClassInput");
const studentStatusInput = document.getElementById("studentStatusInput");
const cancelStudentBtn = document.getElementById("cancelStudentBtn");
const saveStudentBtn = document.getElementById("saveStudentBtn");

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
});

async function loadData() {
  await Promise.all([
    loadClasses(),
    loadStudents(),
    loadAttempts()
  ]);

  populateClassFilters();
  renderSummary();
  renderStudents();
  renderPerformance();
}

async function loadClasses() {
  try {
    const snap = await getDocs(
      query(collection(db, "classes"), orderBy("createdAt", "desc"))
    );

    classes = snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

  } catch (error) {
    console.error("Failed to load classes:", error);
    classes = [];
  }
}

async function loadStudents() {
  try {
    const snap = await getDocs(
      query(collection(db, "students"), orderBy("createdAt", "desc"))
    );

    students = snap.docs.map(docSnap => ({
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

    attempts = snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

  } catch (error) {
    console.error("Failed to load attempts:", error);
    attempts = [];
  }
}

function populateClassFilters() {
  classFilter.innerHTML = `<option value="all">All Classes</option>`;
  studentClassInput.innerHTML = `<option value="">No class assigned</option>`;

  classes.forEach(item => {
    const option1 = new Option(item.className, item.id);
    const option2 = new Option(item.className, item.id);

    classFilter.appendChild(option1);
    studentClassInput.appendChild(option2);
  });
}

function renderSummary() {
  totalStudents.textContent = students.length;

  const activeCount = students.filter(student => student.status === "active").length;
  activeStudents.textContent = activeCount;

  totalAttempts.textContent = attempts.length;

  if (attempts.length === 0) {
    averageScore.textContent = "—";
    return;
  }

  const avg = attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attempts.length;
  averageScore.textContent = `${avg.toFixed(1)}%`;
}

function renderStudents() {
  const keyword = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const classId = classFilter.value;

  let filtered = [...students];

  if (keyword) {
    filtered = filtered.filter(student => {
      const name = String(student.fullName || "").toLowerCase();
      const email = String(student.email || "").toLowerCase();

      return name.includes(keyword) || email.includes(keyword);
    });
  }

  if (status !== "all") {
    filtered = filtered.filter(student => student.status === status);
  }

  if (classId !== "all") {
    filtered = filtered.filter(student => student.classId === classId);
  }

  studentTableBody.innerHTML = "";

  if (filtered.length === 0) {
    studentTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">No student records found.</td>
      </tr>
    `;
    return;
  }

  filtered.forEach(student => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(student.fullName || "—")}</td>
      <td>${escapeHtml(student.email || "—")}</td>
      <td>${escapeHtml(getClassName(student.classId))}</td>
      <td>
        <span class="status-pill ${student.status || "inactive"}">
          ${escapeHtml(student.status || "inactive")}
        </span>
      </td>
      <td>${formatDate(student.createdAt)}</td>
      <td>
        <div class="action-cell">
          <button type="button" class="small-btn edit-btn">Edit</button>
          <button type="button" class="small-btn danger delete-btn">Delete</button>
        </div>
      </td>
    `;

    row.querySelector(".edit-btn").addEventListener("click", () => {
      openStudentModal(student);
    });

    row.querySelector(".delete-btn").addEventListener("click", () => {
      deleteStudent(student.id);
    });

    studentTableBody.appendChild(row);
  });
}

function renderPerformance() {
  const studentStats = students.map(student => {
    const studentAttempts = attempts.filter(item => item.studentId === student.id);

    const attemptsCount = studentAttempts.length;

    const avgScore = attemptsCount
      ? studentAttempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attemptsCount
      : 0;

    return {
      ...student,
      attempts: attemptsCount,
      averageScore: avgScore,
      streak: Number(student.streak || 0)
    };
  });

  const field = rankingFilter.value;
  const order = orderFilter.value;

  studentStats.sort((a, b) => {
    if (order === "asc") {
      return Number(a[field] || 0) - Number(b[field] || 0);
    }

    return Number(b[field] || 0) - Number(a[field] || 0);
  });

  performanceTableBody.innerHTML = "";

  if (studentStats.length === 0) {
    performanceTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">No performance records available.</td>
      </tr>
    `;
    performanceNote.textContent = "Add students and quiz attempts to generate performance insights.";
    return;
  }

  studentStats.forEach((student, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>#${index + 1}</td>
      <td>${escapeHtml(student.fullName || "—")}</td>
      <td>${escapeHtml(getClassName(student.classId))}</td>
      <td>${student.attempts}</td>
      <td>${student.averageScore.toFixed(1)}%</td>
      <td>${student.streak || 0} days</td>
    `;

    performanceTableBody.appendChild(row);
  });

  const topStudent = studentStats[0];

  performanceNote.textContent =
    `${topStudent.fullName || "Top student"} is currently leading based on ${rankingFilter.options[rankingFilter.selectedIndex].text.toLowerCase()}.`;
}

function openStudentModal(student = null) {
  editingStudentId = student?.id || null;

  studentModalTitle.textContent = student ? "Edit Student" : "Add Student";

  studentNameInput.value = student?.fullName || "";
  studentEmailInput.value = student?.email || "";
  studentClassInput.value = student?.classId || "";
  studentStatusInput.value = student?.status || "active";

  studentModal.classList.add("show");
  studentNameInput.focus();
}

function closeStudentModal() {
  studentModal.classList.remove("show");

  editingStudentId = null;
  studentNameInput.value = "";
  studentEmailInput.value = "";
  studentClassInput.value = "";
  studentStatusInput.value = "active";
}

async function saveStudent() {
  const fullName = studentNameInput.value.trim();
  const email = studentEmailInput.value.trim();
  const classId = studentClassInput.value;
  const status = studentStatusInput.value;

  if (!fullName) {
    alert("Please enter the student's full name.");
    return;
  }

  if (!email) {
    alert("Please enter the student's email.");
    return;
  }

  const className = getClassName(classId);

  try {
    if (editingStudentId) {
      await updateDoc(doc(db, "students", editingStudentId), {
        fullName,
        email,
        classId,
        className,
        status,
        updatedAt: serverTimestamp()
      });

    } else {
      await addDoc(collection(db, "students"), {
        fullName,
        email,
        classId,
        className,
        status,
        role: "student",
        streak: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    closeStudentModal();
    await loadData();

  } catch (error) {
    console.error("Failed to save student:", error);
    alert("Failed to save student.");
  }
}

async function deleteStudent(studentId) {
  const confirmed = confirm("Delete this student record?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "students", studentId));
    await loadData();

  } catch (error) {
    console.error("Failed to delete student:", error);
    alert("Failed to delete student.");
  }
}

function setActiveTab(tabName) {
  activeTab = tabName;

  tabButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  recordsTab.classList.toggle("active", tabName === "records");
  performanceTab.classList.toggle("active", tabName === "performance");
}

function getClassName(classId) {
  if (!classId) return "Unassigned";

  const found = classes.find(item => item.id === classId);
  return found?.className || "Unassigned";
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "—";

  return timestamp.toDate().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
});

searchInput.addEventListener("input", renderStudents);
statusFilter.addEventListener("change", renderStudents);
classFilter.addEventListener("change", renderStudents);
resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "all";
  classFilter.value = "all";
  renderStudents();
});

rankingFilter.addEventListener("change", renderPerformance);
orderFilter.addEventListener("change", renderPerformance);
refreshPerformanceBtn.addEventListener("click", async () => {
  await loadData();
});

addStudentBtn.addEventListener("click", () => {
  openStudentModal();
});

cancelStudentBtn.addEventListener("click", closeStudentModal);
saveStudentBtn.addEventListener("click", saveStudent);

studentModal.addEventListener("click", event => {
  if (event.target === studentModal) {
    closeStudentModal();
  }
});