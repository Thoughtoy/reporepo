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
  query,
  where,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

import { builtInModules } from "./built-in-modules.js";

const auth = getAuth(app);
const db = getFirestore(app);

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const backBtn = document.getElementById("backBtn");
const tabs = document.querySelectorAll(".tab");
const categoryTitle = document.getElementById("categoryTitle");
const categorySubtitle = document.getElementById("categorySubtitle");
const builtinModulesEl = document.getElementById("builtinModules");
const classModuleEl = document.getElementById("classModule");
const pointsBadge = document.getElementById("pointsBadge");

const readerModal = document.getElementById("readerModal");
const closeReaderBtn = document.getElementById("closeReaderBtn");
const readerTitle = document.getElementById("readerTitle");
const readerCategory = document.getElementById("readerCategory");
const readerBody = document.getElementById("readerBody");
const markDoneBtn = document.getElementById("markDoneBtn");

const joinClassBtn = document.getElementById("joinClassBtn");
const joinClassModal = document.getElementById("joinClassModal");
const classCodeInput = document.getElementById("classCodeInput");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");
const confirmJoinBtn = document.getElementById("confirmJoinBtn");
const joinMessage = document.getElementById("joinMessage");

// Unlock modal
const unlockModal = document.getElementById("unlockModal");
const unlockModuleTitle = document.getElementById("unlockModuleTitle");
const unlockCostText = document.getElementById("unlockCostText");
const unlockCurrentPoints = document.getElementById("unlockCurrentPoints");
const cancelUnlockBtn = document.getElementById("cancelUnlockBtn");
const confirmUnlockBtn = document.getElementById("confirmUnlockBtn");
const unlockMessage = document.getElementById("unlockMessage");

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser = null;
let currentCategory = "General Education";
let enrolledClass = null;
let completedIds = new Set();
let unlockedByPoints = new Set(); // modules unlocked using points
let openModuleKey = null;

let gameProfile = {
  points: 0,
  level: "Beginner",
  latestBadge: "New Challenger",
  achievements: []
};

// Points cost to unlock a module that is "naturally" locked
const UNLOCK_COST = 50;

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
backBtn?.addEventListener("click", () => {
  window.location.href = "./home.html";
});

closeReaderBtn?.addEventListener("click", () => {
  readerModal.classList.add("hidden");
  openModuleKey = null;
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.category;
    renderPage();
  });
});

// ─── MARK AS DONE ────────────────────────────────────────────────────────────
markDoneBtn?.addEventListener("click", async () => {
  if (!openModuleKey || !currentUser) return;

  completedIds.add(openModuleKey);
  await saveProgress();

  markDoneBtn.textContent = "✓ Completed";
  markDoneBtn.disabled = true;

  renderPage();
  showToast("Module marked as done! ✓");
});

// ─── JOIN CLASS ───────────────────────────────────────────────────────────────
joinClassBtn?.addEventListener("click", () => {
  joinClassModal?.classList.remove("hidden");
  if (classCodeInput) classCodeInput.value = "";
  if (joinMessage) joinMessage.textContent = "";
  classCodeInput?.focus();
});

cancelJoinBtn?.addEventListener("click", () => {
  joinClassModal?.classList.add("hidden");
  if (classCodeInput) classCodeInput.value = "";
  if (joinMessage) joinMessage.textContent = "";
});

confirmJoinBtn?.addEventListener("click", joinClassByCode);

classCodeInput?.addEventListener("keydown", event => {
  if (event.key === "Enter") joinClassByCode();
});

async function joinClassByCode() {
  if (!currentUser) return;

  const code = classCodeInput?.value.trim().toUpperCase();
  if (!code) {
    if (joinMessage) joinMessage.textContent = "Please enter a class code.";
    return;
  }

  try {
    if (confirmJoinBtn) confirmJoinBtn.disabled = true;
    if (joinMessage) joinMessage.textContent = "Checking class code...";

    const classQuery = query(
      collection(db, "classes"),
      where("classCode", "==", code)
    );
    const classSnap = await getDocs(classQuery);

    if (classSnap.empty) {
      if (joinMessage) joinMessage.textContent = "Class code not found. Please check the code.";
      return;
    }

    const classDoc = classSnap.docs[0];
    const classData = classDoc.data();

    await setDoc(doc(db, "students", currentUser.uid), {
      email: currentUser.email || "",
      classId: classDoc.id,
      classCode: classData.classCode || code,
      className: classData.className || "Class Reviewer",
      categoryName: classData.categoryName || "",
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await loadEnrolledClass();
    if (joinMessage) joinMessage.textContent = "Class joined successfully!";

    setTimeout(() => {
      joinClassModal?.classList.add("hidden");
      renderPage();
      showToast("Joined class successfully! 🎉");
    }, 1000);

  } catch (err) {
    console.error("Could not join class:", err);
    if (joinMessage) joinMessage.textContent = "Something went wrong. Please try again.";
  } finally {
    if (confirmJoinBtn) confirmJoinBtn.disabled = false;
  }
}

// ─── UNLOCK WITH POINTS ───────────────────────────────────────────────────────
let pendingUnlockKey = null;
let pendingUnlockTitle = null;

cancelUnlockBtn?.addEventListener("click", () => {
  unlockModal?.classList.add("hidden");
  pendingUnlockKey = null;
  pendingUnlockTitle = null;
});

confirmUnlockBtn?.addEventListener("click", async () => {
  if (!pendingUnlockKey || !currentUser) return;

  if (gameProfile.points < UNLOCK_COST) {
    if (unlockMessage) unlockMessage.textContent = `Not enough points. You need ${UNLOCK_COST} pts.`;
    return;
  }

  try {
    confirmUnlockBtn.disabled = true;
    if (unlockMessage) unlockMessage.textContent = "Unlocking...";

    // Deduct points from gameProfile
    const profileRef = doc(db, "gameProfiles", currentUser.uid);
    await updateDoc(profileRef, {
      points: increment(-UNLOCK_COST),
      updatedAt: serverTimestamp()
    });

    gameProfile.points = Math.max(0, gameProfile.points - UNLOCK_COST);

    // Save unlocked module key to progress
    unlockedByPoints.add(pendingUnlockKey);
    await saveProgress();

    updatePointsBadge();

    unlockModal?.classList.add("hidden");
    pendingUnlockKey = null;
    pendingUnlockTitle = null;

    renderPage();
    showToast(`Module unlocked! ${UNLOCK_COST} pts spent. 🔓`);

  } catch (err) {
    console.error("Failed to unlock module:", err);
    if (unlockMessage) unlockMessage.textContent = "Something went wrong. Try again.";
  } finally {
    confirmUnlockBtn.disabled = false;
  }
});

function promptUnlock(key, title) {
  pendingUnlockKey = key;
  pendingUnlockTitle = title;

  if (unlockModuleTitle) unlockModuleTitle.textContent = title;
  if (unlockCostText) unlockCostText.textContent = `${UNLOCK_COST} pts`;
  if (unlockCurrentPoints) unlockCurrentPoints.textContent = `${gameProfile.points} pts`;
  if (unlockMessage) unlockMessage.textContent = "";

  const canAfford = gameProfile.points >= UNLOCK_COST;
  if (confirmUnlockBtn) {
    confirmUnlockBtn.disabled = !canAfford;
    confirmUnlockBtn.textContent = canAfford ? `Spend ${UNLOCK_COST} pts to Unlock` : "Not Enough Points";
  }

  unlockModal?.classList.remove("hidden");
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    localStorage.setItem("leaflet_redirect_after_login", window.location.href);
    window.location.href = "./student-login.html";
    return;
  }

  currentUser = user;

  await Promise.all([
    loadProgress(),
    loadEnrolledClass(),
    loadGameProfile()
  ]);

  updatePointsBadge();
  renderPage();
});

// ─── FIRESTORE: GAME PROFILE ──────────────────────────────────────────────────
async function loadGameProfile() {
  try {
    const ref = doc(db, "gameProfiles", currentUser.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      gameProfile = {
        points: Number(snap.data().points || 0),
        level: snap.data().level || "Beginner",
        latestBadge: snap.data().latestBadge || "New Challenger",
        achievements: Array.isArray(snap.data().achievements) ? snap.data().achievements : []
      };
    }
  } catch (err) {
    console.warn("Could not load game profile:", err);
  }
}

function updatePointsBadge() {
  if (pointsBadge) {
    pointsBadge.textContent = `${gameProfile.points} ⚡`;
  }
}

// ─── FIRESTORE: PROGRESS ──────────────────────────────────────────────────────
async function loadProgress() {
  try {
    const ref = doc(db, "students", currentUser.uid, "progress", "modules");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      completedIds = new Set(data.completed || []);
      unlockedByPoints = new Set(data.unlockedByPoints || []);
    }
  } catch (err) {
    console.warn("Could not load progress:", err);
  }
}

async function saveProgress() {
  try {
    const ref = doc(db, "students", currentUser.uid, "progress", "modules");
    await setDoc(ref, {
      completed: [...completedIds],
      unlockedByPoints: [...unlockedByPoints]
    }, { merge: true });
  } catch (err) {
    console.warn("Could not save progress:", err);
  }
}

// ─── FIRESTORE: ENROLLED CLASS ────────────────────────────────────────────────
async function loadEnrolledClass() {
  enrolledClass = null;

  try {
    let studentData = null;
    const directSnap = await getDoc(doc(db, "students", currentUser.uid));

    if (directSnap.exists()) {
      studentData = { id: directSnap.id, ...directSnap.data() };
    }

    if (!studentData) {
      const emailQuery = query(
        collection(db, "students"),
        where("email", "==", currentUser.email)
      );
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        studentData = { id: emailSnap.docs[0].id, ...emailSnap.docs[0].data() };
      }
    }

    if (!studentData || !studentData.classId) return;

    const classSnap = await getDoc(doc(db, "classes", studentData.classId));
    if (!classSnap.exists()) return;

    const classData = classSnap.data();

    const filesSnap = await getDocs(
      query(
        collection(db, "classes", studentData.classId, "files"),
        where("status", "==", "published")
      )
    );

    const files = filesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return aTime - bTime;
      });

    enrolledClass = {
      id: classSnap.id,
      className: classData.className || "Class Reviewer",
      categoryName: classData.categoryName || "Uncategorized",
      classCode: classData.classCode || "",
      instructorEmail: classData.instructorEmail || "",
      files
    };
  } catch (err) {
    console.warn("Could not load enrolled class:", err);
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderPage() {
  categoryTitle.textContent = currentCategory;
  categorySubtitle.textContent = "Complete each module in order to unlock the next.";
  renderBuiltInModules();
  renderClassModule();
}

function renderBuiltInModules() {
  const modules = builtInModules
    .filter(m => normalize(m.category) === normalize(currentCategory))
    .sort((a, b) => a.moduleNo - b.moduleNo);

  if (!modules.length) {
    builtinModulesEl.innerHTML = `<p class="empty-text">No built-in modules for this category yet.</p>`;
    return;
  }

  builtinModulesEl.innerHTML = modules.map((m, index) => {
    const key = moduleKey(m.category, m.moduleNo);
    const isDone = completedIds.has(key);

    // Natural unlock: first module always open, rest need previous done
    const naturallyUnlocked = index === 0 || completedIds.has(moduleKey(m.category, modules[index - 1].moduleNo));
    const forcedUnlocked = unlockedByPoints.has(key);
    const isUnlocked = naturallyUnlocked || forcedUnlocked;
    const isLocked = !isUnlocked;

    return `
      <button
        class="module-card ${isDone ? "is-done" : ""} ${isLocked ? "is-locked" : ""}"
        type="button"
        data-key="${escapeAttr(key)}"
        data-locked="${isLocked}"
        data-title="${escapeAttr(m.title)}"
        aria-label="${escapeAttr(m.title)}${isLocked ? " (locked)" : isDone ? " (completed)" : ""}"
      >
        <div class="module-number">${isDone ? "✓" : isLocked ? "🔒" : "M" + m.moduleNo}</div>
        <div class="module-info">
          <h4>${escapeHtml(m.title)}</h4>
          <p>${escapeHtml(m.description)}</p>
          <span class="module-badge ${isDone ? "badge-done" : isLocked ? "badge-locked" : ""}">
            ${isDone ? "Completed" : isLocked ? `Locked — Spend ${UNLOCK_COST} pts to unlock` : "Built-in Module"}
          </span>
        </div>
        ${isLocked ? `<span class="unlock-hint">🔓 ${UNLOCK_COST}pts</span>` : ""}
      </button>
    `;
  }).join("");

  builtinModulesEl.querySelectorAll(".module-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.key;
      const isLocked = card.dataset.locked === "true";
      const title = card.dataset.title;

      if (isLocked) {
        promptUnlock(key, title);
        return;
      }

      const m = modules.find(mod => moduleKey(mod.category, mod.moduleNo) === key);
      if (m) {
        openReader({
          title: m.title,
          category: m.category,
          content: m.content,
          key
        });
      }
    });
  });
}

function renderClassModule() {
  if (!enrolledClass) {
    classModuleEl.innerHTML = `
      <div class="empty-class-card">
        <p class="empty-text">No enrolled class yet.</p>
        <p style="font-size:11px;color:var(--muted)">Tap <strong>+ Join Class</strong> above to enroll with your instructor's class code.</p>
      </div>
    `;
    return;
  }

  if (normalize(enrolledClass.categoryName) !== normalize(currentCategory)) {
    classModuleEl.innerHTML = `
      <div class="empty-class-card">
        <p class="empty-text">Your enrolled class is under <strong>${escapeHtml(enrolledClass.categoryName)}</strong>.</p>
        <p style="font-size:11px;color:var(--muted)">Switch to that tab to see its files.</p>
      </div>
    `;
    return;
  }

  const { files = [] } = enrolledClass;

  if (!files.length) {
    classModuleEl.innerHTML = `
      <div class="empty-class-card">
        <h4>${escapeHtml(enrolledClass.className)}</h4>
        <p>You're enrolled, but your instructor hasn't published any files yet.</p>
        <span class="module-badge">Code: ${escapeHtml(enrolledClass.classCode)}</span>
      </div>
    `;
    return;
  }

  classModuleEl.innerHTML = files.map(file => {
    const key = `class-${file.id}`;
    const isDone = completedIds.has(key);

    return `
      <button
        class="module-card class-reviewer-card ${isDone ? "is-done" : ""}"
        type="button"
        data-key="${escapeAttr(key)}"
        data-file-id="${escapeAttr(file.id)}"
        data-locked="false"
        aria-label="${escapeHtml(file.title)}${isDone ? " (completed)" : ""}"
      >
        <div class="module-number">${isDone ? "✓" : "CR"}</div>
        <div class="module-info">
          <h4>${escapeHtml(file.title || "Untitled File")}</h4>
          <p>${escapeHtml(enrolledClass.classCode ? "Class: " + enrolledClass.classCode : "Instructor file")}</p>
          <span class="module-badge ${isDone ? "badge-done" : ""}">${isDone ? "Completed" : "My Class File"}</span>
        </div>
      </button>
    `;
  }).join("");

  classModuleEl.querySelectorAll(".module-card").forEach(card => {
    card.addEventListener("click", () => {
      const fileId = card.dataset.fileId;
      const key = card.dataset.key;
      const file = files.find(f => f.id === fileId);

      if (file) {
        openReader({
          title: file.title || "Untitled File",
          category: enrolledClass.categoryName,
          content: file.content || "<p>No content yet.</p>",
          meta: enrolledClass.classCode,
          key
        });
      }
    });
  });
}

// ─── READER ───────────────────────────────────────────────────────────────────
function openReader(module) {
  openModuleKey = module.key || null;

  readerTitle.textContent = module.title || "Reviewer Module";
  readerCategory.textContent = module.meta
    ? `${module.category} • ${module.meta}`
    : (module.category || currentCategory);

  readerBody.innerHTML = module.content || "<p>No content available.</p>";

  if (markDoneBtn) {
    const alreadyDone = completedIds.has(openModuleKey);
    markDoneBtn.textContent = alreadyDone ? "✓ Completed" : "Mark as Done";
    markDoneBtn.disabled = alreadyDone;
  }

  readerModal.classList.remove("hidden");
  readerModal.querySelector(".reader-shell")?.scrollTo(0, 0);
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message) {
  const existing = document.querySelector(".toast-msg");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast-msg";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function moduleKey(category, moduleNo) {
  return `${category}-${moduleNo}`;
}

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value = "") {
  return String(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}