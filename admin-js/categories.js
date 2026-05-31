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
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const db   = getFirestore(app);
const auth = getAuth(app);

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser        = null;
let categories         = [];
let classes            = [];
let students           = [];
let selectedCategoryId = null;
let selectedClassId    = null;
let selectedFileId     = null;
let classFiles         = [];
let quill              = null;

// ── DOM refs (only elements OUTSIDE modals — safe to cache) ──────────────────
const categoryList         = document.getElementById("categoryList");
const classGrid            = document.getElementById("classGrid");
const selectedCategoryName = document.getElementById("selectedCategoryName");
const classModal           = document.getElementById("classModal");
const classNameInput       = document.getElementById("classNameInput");
const classCategorySelect  = document.getElementById("classCategorySelect");
const reviewerModal        = document.getElementById("reviewerModal");
const reviewerClassTitle   = document.getElementById("reviewerClassTitle");
const importFileInput      = document.getElementById("importFileInput");

// ── Live query helper — never cache modal-interior elements ───────────────────
const $ = id => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initEditor();
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  await loadCategories();
  await loadStudents();
  await loadClasses();
});

function initEditor() {
  quill = new Quill("#reviewerEditor", {
    theme: "snow",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"]
      ]
    }
  });
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadCategories() {
  const snap = await getDocs(
    query(collection(db, "categories"), orderBy("order", "asc"))
  );
  categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!selectedCategoryId && categories.length > 0) {
    selectedCategoryId = categories[0].id;
  }
  renderCategoryList();
  renderClassCategoryOptions();
}

async function loadStudents() {
  const snap = await getDocs(collection(db, "students"));
  students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadClasses() {
  const snap = await getDocs(
    query(collection(db, "classes"), orderBy("createdAt", "desc"))
  );
  classes = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    studentCount: getStudentCountByClassId(d.id)
  }));
  renderClassGrid();
}

async function loadClassFiles(classId) {
  const snap = await getDocs(
    query(collection(db, "classes", classId, "files"), orderBy("createdAt", "asc"))
  );
  classFiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function getStudentCountByClassId(classId) {
  return students.filter(s => s.classId === classId).length;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderCategoryList() {
  categoryList.innerHTML = "";
  if (!categories.length) {
    categoryList.innerHTML = `<p class="empty-text">No categories found.</p>`;
    return;
  }
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `category-item ${cat.id === selectedCategoryId ? "active" : ""}`;
    btn.textContent = cat.name;
    btn.addEventListener("click", () => {
      selectedCategoryId = cat.id;
      renderCategoryList();
      renderClassGrid();
    });
    categoryList.appendChild(btn);
  });
}

function renderClassCategoryOptions() {
  classCategorySelect.innerHTML = "";
  categories.forEach(cat => {
    classCategorySelect.appendChild(new Option(cat.name, cat.id));
  });
}

function renderClassGrid() {
  const selected = getSelectedCategory();
  selectedCategoryName.textContent = selected?.name || "No category selected";
  classGrid.innerHTML = "";

  const filtered = classes.filter(c => c.categoryId === selectedCategoryId);
  if (!filtered.length) {
    classGrid.innerHTML = `<p class="empty-text">No class yet. Click "Create Class" to start.</p>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "class-card";
    card.innerHTML = `
      <div class="class-card-top">
        <span class="class-type">${escapeHtml(item.categoryName || "Class")}</span>
        <span class="student-count">${item.studentCount || 0} Students</span>
      </div>
      <h4>${escapeHtml(item.className)}</h4>
      <div class="class-code-row">
        <input type="text" readonly value="${escapeHtml(item.classCode)}">
        <button type="button" class="small-btn copy-btn">Copy</button>
      </div>
      <div class="class-card-actions">
        <button type="button" class="primary-btn open-reviewer-btn">Manage Files</button>
        <button type="button" class="secondary-btn invite-btn">Invite Students</button>
      </div>
    `;
    card.querySelector(".copy-btn").addEventListener("click", () => copyText(item.classCode));
    card.querySelector(".invite-btn").addEventListener("click", () => {
      copyText(`Join my LeafLET class using this code: ${item.classCode}`);
      showFlash("Invite message copied.");
    });
    card.querySelector(".open-reviewer-btn").addEventListener("click", () => openReviewer(item.id));
    classGrid.appendChild(card);
  });
}

// ── Class creation modal ──────────────────────────────────────────────────────
function openClassModal() {
  classNameInput.value = "";
  classCategorySelect.value = selectedCategoryId || categories[0]?.id || "";
  classModal.classList.add("show");
  classNameInput.focus();
}

function closeClassModal() {
  classModal.classList.remove("show");
  classNameInput.value = "";
}

async function saveClass() {
  const className  = classNameInput.value.trim();
  const categoryId = classCategorySelect.value;
  if (!className) { showFlash("Please enter a class name."); return; }
  const category = categories.find(c => c.id === categoryId);
  if (!category)  { showFlash("Please select a category.");  return; }
  const classCode = generateClassCode(category.name);
  try {
    await addDoc(collection(db, "classes"), {
      className,
      categoryId,
      categoryName:    category.name,
      classCode,
      instructorId:    currentUser.uid,
      instructorEmail: currentUser.email,
      createdAt:       serverTimestamp(),
      updatedAt:       serverTimestamp()
    });
    selectedCategoryId = categoryId;
    closeClassModal();
    await loadStudents();
    await loadClasses();
  } catch (err) {
    console.error("Failed to create class:", err);
    showFlash("Failed to create class.");
  }
}

// ── Reviewer / files modal ────────────────────────────────────────────────────
async function openReviewer(classId) {
  selectedClassId = classId;
  selectedFileId  = null;

  const snap = await getDoc(doc(db, "classes", classId));
  if (!snap.exists()) { showFlash("Class not found."); return; }

  reviewerClassTitle.textContent = snap.data().className;

  // Clear editor first before loading files — never after
  if (quill) quill.root.innerHTML = "";
  const titleInput = $("fileTitleInput");
  if (titleInput) titleInput.value = "";

  await loadClassFiles(classId);
  renderFilesList();

  // Buttons stay disabled until user selects a file
  updateEditorButtons();

  reviewerModal.classList.add("show");
}

function closeReviewer() {
  reviewerModal.classList.remove("show");
  selectedClassId = null;
  selectedFileId  = null;
  classFiles      = [];
  clearEditor();
  updateEditorButtons(); // disable buttons on close
  if (importFileInput) importFileInput.value = "";
}

function clearEditor() {
  if (quill) quill.root.innerHTML = "";
  const titleInput = $("fileTitleInput");
  if (titleInput) titleInput.value = "";
  selectedFileId = null;
  // Callers are responsible for calling updateEditorButtons() after this
}

// ── Files list ────────────────────────────────────────────────────────────────
function renderFilesList() {
  const filesList = $("filesList");
  if (!filesList) return;
  filesList.innerHTML = "";

  if (!classFiles.length) {
    filesList.innerHTML = `<p class="files-empty">No files yet. Click "+ Add File" to create one.</p>`;
    return;
  }

  classFiles.forEach(file => {
    const item = document.createElement("div");
    item.className = `file-item ${file.id === selectedFileId ? "active" : ""}`;

    const statusBadge = file.status === "published"
      ? `<span class="file-badge published">Published</span>`
      : `<span class="file-badge draft">Draft</span>`;

    item.innerHTML = `
      <div class="file-item-info">
        <span class="file-item-title">${escapeHtml(file.title || "Untitled")}</span>
        ${statusBadge}
      </div>
      <div class="file-item-actions">
        <button type="button" class="small-btn edit-file-btn">Edit</button>
        <button type="button" class="small-btn danger-small delete-file-btn">Delete</button>
      </div>
    `;

    item.querySelector(".edit-file-btn").addEventListener("click", () => selectFile(file.id));
    item.querySelector(".delete-file-btn").addEventListener("click", () => deleteFile(file.id));
    filesList.appendChild(item);
  });
}

function selectFile(fileId) {
  const file = classFiles.find(f => f.id === fileId);
  if (!file) return;

  selectedFileId = fileId;

  const titleInput = $("fileTitleInput");
  if (titleInput) titleInput.value = file.title || "";
  if (quill) quill.root.innerHTML = file.content || "";

  updateEditorButtons();
  renderFilesList();
}

function updateEditorButtons() {
  const hasFile    = !!selectedFileId;
  const saveBtn    = $("saveReviewerBtn");
  const publishBtn = $("publishFileBtn");
  if (saveBtn)    saveBtn.disabled    = !hasFile;
  if (publishBtn) publishBtn.disabled = !hasFile;
}

// ── Add / save / publish / delete file ───────────────────────────────────────
async function addNewFile() {
  if (!selectedClassId) return;
  try {
    const ref = await addDoc(collection(db, "classes", selectedClassId, "files"), {
      title:     "Untitled File",
      content:   "",
      status:    "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadClassFiles(selectedClassId);
    renderFilesList();
    selectFile(ref.id);
    showFlash("New file created.");
  } catch (err) {
    console.error("Failed to add file:", err);
    showFlash("Failed to add file.");
  }
}

async function saveFileDraft() {
  if (!selectedClassId || !selectedFileId) {
    showFlash("Select a file first.");
    return;
  }
  const title   = $("fileTitleInput")?.value.trim() || "Untitled File";
  const content = quill.root.innerHTML;
  try {
    await updateDoc(doc(db, "classes", selectedClassId, "files", selectedFileId), {
      title,
      content,
      updatedAt: serverTimestamp()
    });
    const idx = classFiles.findIndex(f => f.id === selectedFileId);
    if (idx !== -1) {
      classFiles[idx].title   = title;
      classFiles[idx].content = content;
    }
    renderFilesList();
    showFlash("Draft saved.");
  } catch (err) {
    console.error("Failed to save draft:", err);
    showFlash("Failed to save draft.");
  }
}

async function publishFile() {
  if (!selectedClassId || !selectedFileId) {
    showFlash("Select a file first.");
    return;
  }
  const title   = $("fileTitleInput")?.value.trim() || "Untitled File";
  const content = quill.root.innerHTML;
  try {
    await updateDoc(doc(db, "classes", selectedClassId, "files", selectedFileId), {
      title,
      content,
      status:    "published",
      updatedAt: serverTimestamp()
    });
    const idx = classFiles.findIndex(f => f.id === selectedFileId);
    if (idx !== -1) {
      classFiles[idx].title   = title;
      classFiles[idx].content = content;
      classFiles[idx].status  = "published";
    }
    renderFilesList();
    showFlash("File published! Students can now see it.");
  } catch (err) {
    console.error("Failed to publish:", err);
    showFlash("Failed to publish.");
  }
}

async function deleteFile(fileId) {
  if (!confirm("Delete this file? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "classes", selectedClassId, "files", fileId));
    if (selectedFileId === fileId) clearEditor();
    await loadClassFiles(selectedClassId);
    renderFilesList();
    showFlash("File deleted.");
  } catch (err) {
    console.error("Failed to delete file:", err);
    showFlash("Failed to delete file.");
  }
}

async function deleteSelectedClass() {
  if (!selectedClassId) return;
  if (!confirm("Delete this class and all its files? This cannot be undone.")) return;
  try {
    const filesSnap = await getDocs(collection(db, "classes", selectedClassId, "files"));
    await Promise.all(filesSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "classes", selectedClassId));
    closeReviewer();
    await loadStudents();
    await loadClasses();
  } catch (err) {
    console.error("Failed to delete class:", err);
    showFlash("Failed to delete class.");
  }
}

// ── File import ───────────────────────────────────────────────────────────────
importFileInput?.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".txt")) {
      quill.root.innerHTML = `<pre>${escapeHtml(await file.text())}</pre>`;
    } else if (name.endsWith(".html")) {
      quill.root.innerHTML = await file.text();
    } else if (name.endsWith(".docx")) {
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      quill.root.innerHTML = result.value;
    } else {
      showFlash("Unsupported file type. Use TXT, HTML, or DOCX.");
    }
  } catch (err) {
    console.error("Import failed:", err);
    showFlash("Failed to import file.");
  }
  importFileInput.value = "";
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSelectedCategory() {
  return categories.find(c => c.id === selectedCategoryId);
}

function generateClassCode(categoryName = "CLS") {
  const prefix = categoryName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLS";
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showFlash("Copied!");
  } catch {
    showFlash(text);
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── ALL event listeners via delegation ───────────────────────────────────────
// Using document-level delegation means we never have a null-ref problem,
// regardless of when the modal HTML is parsed.
document.addEventListener("click", e => {
  switch (e.target.id) {
    case "createClassBtn":   openClassModal();       break;
    case "cancelClassBtn":   closeClassModal();      break;
    case "saveClassBtn":     saveClass();            break;
    case "closeReviewerBtn": closeReviewer();        break;
    case "saveReviewerBtn":  saveFileDraft();        break;
    case "publishFileBtn":   publishFile();          break;
    case "deleteClassBtn":   deleteSelectedClass();  break;
    case "addFileBtn":       addNewFile();           break;
    case "copyClassCodeBtn": {
      const cls = classes.find(c => c.id === selectedClassId);
      if (cls) copyText(cls.classCode);
      break;
    }
  }
});

// Close modals on backdrop click
classModal?.addEventListener("click", e => {
  if (e.target === classModal) closeClassModal();
});
reviewerModal?.addEventListener("click", e => {
  if (e.target === reviewerModal) closeReviewer();
});