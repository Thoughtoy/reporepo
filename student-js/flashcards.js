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
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// ─── DOM ─────────────────────────────────────────────────────────────────────

const backBtn          = document.getElementById("backBtn");
const studyAllBtn      = document.getElementById("studyAllBtn");
const flashcard        = document.getElementById("flashcard");
const cardTerm         = document.getElementById("cardTerm");
const cardDefinition   = document.getElementById("cardDefinition");
const cardCounter      = document.getElementById("cardCounter");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");
const shuffleBtn       = document.getElementById("shuffleBtn");
const progressBar      = document.getElementById("progressBar");
const categoryGrid     = document.getElementById("categoryGrid");
const topicView        = document.getElementById("topicView");
const topicBackBtn     = document.getElementById("topicBackBtn");
const topicTitle       = document.getElementById("topicTitle");
const topicList        = document.getElementById("topicList");
const studyView        = document.getElementById("studyView");
const studyBackBtn     = document.getElementById("studyBackBtn");
const studyTitle       = document.getElementById("studyTitle");

// Add Modal
const openAddBtn       = document.getElementById("openAddBtn");
const addModal         = document.getElementById("addModal");
const closeAddBtn      = document.getElementById("closeAddBtn");
const closeAddBtn2     = document.getElementById("closeAddBtn2");
const addFlashcardForm = document.getElementById("addFlashcardForm");
const manualCategory   = document.getElementById("manualCategory");
const manualTopic      = document.getElementById("manualTopic");
const manualTerm       = document.getElementById("manualTerm");
const manualDefinition = document.getElementById("manualDefinition");

// Import Modal
const openImportBtn    = document.getElementById("openImportBtn");
const importModal      = document.getElementById("importModal");
const closeImportBtn   = document.getElementById("closeImportBtn");
const importCategorySelect = document.getElementById("importCategory");
const importTopicInput = document.getElementById("importTopic");

// Import tabs
const tabDocx          = document.getElementById("tabDocx");
const tabPaste         = document.getElementById("tabPaste");
const docxPanel        = document.getElementById("docxPanel");
const pastePanel       = document.getElementById("pastePanelEl");
const docxInput        = document.getElementById("docxInput");
const docxDropzone     = document.getElementById("docxDropzone");
const pasteText        = document.getElementById("pasteText");
const generateBtn      = document.getElementById("generateBtn");
const previewSection   = document.getElementById("previewSection");
const previewList      = document.getElementById("previewList");
const saveImportBtn    = document.getElementById("saveImportBtn");
const importStatus     = document.getElementById("importStatus");
const importSpinner    = document.getElementById("importSpinner");

// CSV
const csvInput         = document.getElementById("csvInput");
const csvBtn           = document.getElementById("csvBtn");

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser      = null;
let allCards         = [];
let filteredCards    = [];
let currentIndex     = 0;
let currentCategory  = null;
let pendingCards     = [];   // cards waiting to be saved after preview

// ─── Auth ─────────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async user => {
  if (!user) {
    localStorage.setItem("leaflet_redirect_after_login", window.location.href);
    window.location.href = "./student-login.html";
    return;
  }
  currentUser = user;
  await loadAllCards();
  renderCategoryGrid();
  populateModalCategories();
});

// ─── Load Cards ───────────────────────────────────────────────────────────────

async function loadAllCards() {
  allCards = [];
  let catMap = {}, topicMap = {};

  try {
    const catSnap = await getDocs(collection(db, "categories"));
    for (const catDoc of catSnap.docs) {
      catMap[catDoc.id] = catDoc.data().name;
      const topicSnap = await getDocs(collection(db, "categories", catDoc.id, "topics"));
      topicSnap.docs.forEach(t => { topicMap[t.id] = t.data().name; });
    }
  } catch (e) { console.warn("Category map error:", e); }


  // Student manual cards
  try {
    const snap = await getDocs(
      query(collection(db, "studentFlashcards"), where("studentId", "==", currentUser.uid))
    );
    snap.forEach(docSnap => {
      const d = docSnap.data();
      allCards.push({
        id: docSnap.id, source: d.source || "manual",
        categoryId: d.categoryId || d.category || "manual",
        categoryName: d.categoryName || d.category || "My Flashcards",
        topic: d.topic || "My Flashcards",
        term: d.term, definition: d.definition
      });
    });
  } catch (e) { console.warn("Student cards error:", e); }
}

// ─── Category Grid ────────────────────────────────────────────────────────────

function renderCategoryGrid() {
  const cats = {};
  allCards.forEach(c => {
    if (!cats[c.categoryId]) cats[c.categoryId] = { name: c.categoryName, cards: [] };
    cats[c.categoryId].cards.push(c);
  });

  categoryGrid.innerHTML = "";

  if (!Object.keys(cats).length) {
    categoryGrid.innerHTML = `<p class="empty-hint">No reviewers yet. Add your own or wait for instructor content.</p>`;
    return;
  }

  Object.entries(cats).forEach(([catId, cat]) => {
    const topics = [...new Set(cat.cards.map(c => c.topic))];
    const tile = document.createElement("div");
    tile.className = "cat-tile";
    tile.innerHTML = `
      <div class="cat-tile-inner">
        <p class="cat-count">${cat.cards.length} cards · ${topics.length} topics</p>
        <h3 class="cat-name">${escHtml(cat.name)}</h3>
        <div class="cat-actions">
          <button class="cat-study-all">Study All</button>
          <button class="cat-browse">Browse Topics</button>
        </div>
      </div>`;

    tile.querySelector(".cat-study-all").addEventListener("click", e => {
      e.stopPropagation();
      startStudy(cat.cards, cat.name, "Shuffled");
    });
    tile.querySelector(".cat-browse").addEventListener("click", e => {
      e.stopPropagation();
      currentCategory = { id: catId, name: cat.name };
      renderTopicView(catId, cat.name, cat.cards);
    });
    categoryGrid.appendChild(tile);
  });

  showView("category");
}

// ─── Topic View ───────────────────────────────────────────────────────────────

function renderTopicView(catId, catName, cards) {
  topicTitle.textContent = catName;
  topicList.innerHTML = "";

  const allRow = document.createElement("div");
  allRow.className = "topic-row";
  allRow.innerHTML = `
    <div class="topic-info">
      <span class="topic-name">📚 Study Whole Category</span>
      <span class="topic-count">${cards.length} cards</span>
    </div>
    <button class="topic-start-btn">Start</button>`;
  allRow.querySelector(".topic-start-btn").addEventListener("click", () => {
    startStudy(shuffle([...cards]), catName, "All Topics");
  });
  topicList.appendChild(allRow);

  const topics = {};
  cards.forEach(c => { if (!topics[c.topic]) topics[c.topic] = []; topics[c.topic].push(c); });

  Object.entries(topics).forEach(([topicName, topicCards]) => {
    const row = document.createElement("div");
    row.className = "topic-row";
    row.innerHTML = `
      <div class="topic-info">
        <span class="topic-name">${escHtml(topicName)}</span>
        <span class="topic-count">${topicCards.length} cards</span>
      </div>
      <button class="topic-start-btn">Study</button>`;
    row.querySelector(".topic-start-btn").addEventListener("click", () => {
      startStudy([...topicCards], catName, topicName);
    });
    topicList.appendChild(row);
  });

  showView("topic");
}

// ─── Study View ───────────────────────────────────────────────────────────────

function startStudy(cards, catName, topicName) {
  filteredCards = shuffle([...cards]);
  currentIndex  = 0;
  studyTitle.textContent = `${catName} · ${topicName}`;
  renderCard();
  showView("study");
}

function renderCard() {
  flashcard.classList.remove("flipped");
  if (!filteredCards.length) {
    cardTerm.textContent = "No cards"; cardDefinition.textContent = ""; cardCounter.textContent = "0 / 0";
    progressBar.style.width = "0%"; return;
  }
  const card = filteredCards[currentIndex];
  cardTerm.textContent       = card.term;
  cardDefinition.textContent = card.definition;
  cardCounter.textContent    = `${currentIndex + 1} / ${filteredCards.length}`;
  progressBar.style.width    = `${((currentIndex + 1) / filteredCards.length) * 100}%`;
}

function showView(view) {
  categoryGrid.classList.toggle("hidden", view !== "category");
  topicView.classList.toggle("hidden",    view !== "topic");
  studyView.classList.toggle("hidden",    view !== "study");
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

topicBackBtn?.addEventListener("click", () => showView("category"));
studyBackBtn?.addEventListener("click", () => {
  currentCategory
    ? renderTopicView(currentCategory.id, currentCategory.name, allCards.filter(c => c.categoryId === currentCategory.id))
    : renderCategoryGrid();
});
backBtn?.addEventListener("click", () => { window.location.href = "./home.html"; });
flashcard?.addEventListener("click", () => flashcard.classList.toggle("flipped"));
nextBtn?.addEventListener("click", () => { currentIndex = (currentIndex + 1) % filteredCards.length; renderCard(); });
prevBtn?.addEventListener("click", () => { currentIndex = currentIndex === 0 ? filteredCards.length - 1 : currentIndex - 1; renderCard(); });
shuffleBtn?.addEventListener("click", () => { filteredCards = shuffle([...filteredCards]); currentIndex = 0; renderCard(); });
studyAllBtn?.addEventListener("click", () => {
  studyTitle.textContent = "All Categories · Shuffled";
  startStudy(allCards, "All Categories", "Shuffled");
});

// Swipe
let tx = 0, ty = 0;
flashcard?.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
flashcard?.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
    if (dx < 0) { currentIndex = (currentIndex + 1) % filteredCards.length; }
    else { currentIndex = currentIndex === 0 ? filteredCards.length - 1 : currentIndex - 1; }
    renderCard();
  }
}, { passive: true });

// ─── Add Manual Modal ─────────────────────────────────────────────────────────

openAddBtn?.addEventListener("click",   () => addModal.classList.remove("hidden"));
closeAddBtn?.addEventListener("click",  () => addModal.classList.add("hidden"));
closeAddBtn2?.addEventListener("click", () => addModal.classList.add("hidden"));

async function populateModalCategories() {
  try {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
    [manualCategory, importCategorySelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = `<option value="">Select category…</option>`;
      snap.docs.forEach(d => sel.appendChild(new Option(d.data().name, d.id)));
    });
  } catch (e) { console.warn("Category dropdown error:", e); }
}

addFlashcardForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const catId   = manualCategory.value;
  const catName = manualCategory.options[manualCategory.selectedIndex]?.text || catId;
  const topic   = manualTopic.value.trim();
  const term    = manualTerm.value.trim();
  const def     = manualDefinition.value.trim();
  if (!catId || !topic || !term || !def) return;

  const card = { studentId: currentUser.uid, categoryId: catId, categoryName: catName, topic, term, definition: def, source: "manual", createdAt: serverTimestamp() };
  try {
    const ref = await addDoc(collection(db, "studentFlashcards"), card);
    allCards.push({ id: ref.id, ...card });
  } catch (err) {
    allCards.push({ id: `local-${Date.now()}`, ...card, source: "local" });
  }
  addFlashcardForm.reset();
  addModal.classList.add("hidden");
  renderCategoryGrid();
});

// ─── CSV Import ───────────────────────────────────────────────────────────────

csvBtn?.addEventListener("click", () => csvInput?.click());
csvInput?.addEventListener("change", async () => {
  const file = csvInput.files[0];
  if (!file) return;
  const text  = await file.text();
  const lines = text.split("\n").filter(l => l.trim());
  const cards = [];
  lines.forEach(line => {
    const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 4) return;
    const [catName, topic, term, definition] = parts;
    if (term && definition) cards.push({ catName, topic, term, definition });
  });
  if (!cards.length) { alert("No valid rows. Format: category, topic, term, definition"); return; }
  if (!confirm(`Import ${cards.length} card(s)?`)) return;

  let saved = 0;
  for (const c of cards) {
    try {
      const doc = { studentId: currentUser.uid, categoryId: c.catName, categoryName: c.catName, topic: c.topic, term: c.term, definition: c.definition, source: "csv", createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, "studentFlashcards"), doc);
      allCards.push({ id: ref.id, ...doc });
      saved++;
    } catch (e) { console.error(e); }
  }
  csvInput.value = "";
  alert(`✓ Imported ${saved} card(s).`);
  renderCategoryGrid();
});

// ─── Import Modal (DOCX + Paste + AI) ────────────────────────────────────────

openImportBtn?.addEventListener("click", () => {
  pendingCards = [];
  previewSection.classList.add("hidden");
  importStatus.textContent = "";
  pasteText.value = "";
  importModal.classList.remove("hidden");
});
closeImportBtn?.addEventListener("click", () => importModal.classList.add("hidden"));

// Tab switching
tabDocx?.addEventListener("click", () => {
  tabDocx.classList.add("tab-active");
  tabPaste.classList.remove("tab-active");
  docxPanel.classList.remove("hidden");
  pastePanel.classList.add("hidden");
});
tabPaste?.addEventListener("click", () => {
  tabPaste.classList.add("tab-active");
  tabDocx.classList.remove("tab-active");
  pastePanel.classList.remove("hidden");
  docxPanel.classList.add("hidden");
});

// Dropzone
docxDropzone?.addEventListener("click", () => docxInput?.click());
docxDropzone?.addEventListener("dragover", e => { e.preventDefault(); docxDropzone.classList.add("drag-over"); });
docxDropzone?.addEventListener("dragleave", () => docxDropzone.classList.remove("drag-over"));
docxDropzone?.addEventListener("drop", e => {
  e.preventDefault();
  docxDropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleDocxFile(file);
});
docxInput?.addEventListener("change", () => {
  if (docxInput.files[0]) handleDocxFile(docxInput.files[0]);
});

async function handleDocxFile(file) {
  setStatus("Reading document…", true);
  try {
    const text = await extractTextFromDocx(file);
    pasteText.value = text;
    // Switch to paste tab so user can see/edit the extracted text
    tabPaste.click();
    setStatus(`✓ Document text extracted (${text.length} chars). Click Generate to make flashcards.`, false);
  } catch (err) {
    setStatus("❌ Could not read file. Make sure it's a .docx file.", false);
    console.error(err);
  }
}

// ─── DOCX Text Extraction (via mammoth.js) ────────────────────────────────────

async function extractTextFromDocx(file) {
  const mammoth = await loadMammoth();
  if (!mammoth) throw new Error("mammoth.js failed to load");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    s.onload  = () => resolve(window.mammoth);
    s.onerror = () => reject(new Error("mammoth.js load failed"));
    document.head.appendChild(s);
  });
}

// ─── AI Generate ─────────────────────────────────────────────────────────────

generateBtn?.addEventListener("click", async () => {
  const text     = pasteText.value.trim();
  const catId    = importCategorySelect?.value || "";
  const catName  = importCategorySelect?.options[importCategorySelect.selectedIndex]?.text || catId;
  const topic    = importTopicInput?.value.trim() || "General";

  if (!text) { setStatus("Please paste or upload text first.", false); return; }
  if (!catId) { setStatus("Please select a category first.", false); return; }

  setStatus("✨ Parsing your text…", true);
  previewSection.classList.add("hidden");

  try {
    const cards = await generateFlashcardsAI(text, catName, topic);
    pendingCards = cards;
    renderPreview(cards);
    setStatus(`✓ Generated ${cards.length} flashcards. Review and save.`, false);
  } catch (err) {
    setStatus(`❌ ${err.message}`, false);
    console.error(err);
  }
});

/**
 * Rule-based flashcard parser — no API key needed, works offline.
 *
 * Detects these patterns in order:
 *   1. Explicit pairs:   "Term: ...
Definition: ..."  or  "Q: ...
A: ..."
 *   2. Dash/colon defs:  "Photosynthesis - the process by which..."
 *                        "Photosynthesis: the process by which..."
 *   3. Numbered Q&A:     "1. What is...?
   It is..."
 *   4. Bullet pairs:     "• Term
  definition text"
 *   5. Sentence split:   Splits long paragraphs into concept sentences
 *                        and uses the first noun phrase as the term.
 */
function generateFlashcardsAI(rawText) {
  const cards = [];
  const seen  = new Set();

  function add(term, definition) {
    term       = term.trim().replace(/[*_#]+/g, "").trim();
    definition = definition.trim().replace(/[*_#]+/g, "").trim();
    if (!term || !definition) return;
    if (term.length > 120 || definition.length < 5) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({ term, definition });
  }

  // Normalise line endings
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = text.split("\n");

  // ── Pattern 1: Explicit label pairs ──────────────────────────────────────
  // Term: xxx  /  Definition: xxx
  // Q: xxx  /  A: xxx
  // Question: xxx  /  Answer: xxx
  const TERM_RE = /^(?:term|question|q)\s*[:\-]\s*(.+)$/i;
  const DEF_RE  = /^(?:definition|def|answer|a)\s*[:\-]\s*(.+)$/i;

  for (let i = 0; i < lines.length - 1; i++) {
    const tm = lines[i].match(TERM_RE);
    if (tm) {
      // Look ahead up to 3 lines for the definition
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const dm = lines[j].match(DEF_RE);
        if (dm) { add(tm[1], dm[1]); i = j; break; }
      }
    }
  }

  // ── Pattern 2: "Term - definition" or "Term: definition" (single line) ──
  // Only fires when the term part is short (≤ 60 chars) and looks like a label
  const INLINE_RE = /^([A-Z][^:\-]{2,60})\s*(?:[-–—]|:)\s+([A-Z].{15,})$/;
  for (const line of lines) {
    const m = line.match(INLINE_RE);
    if (m && !m[1].match(/^(chapter|unit|lesson|page|section|part)/i)) {
      add(m[1], m[2]);
    }
  }

  // ── Pattern 3: Numbered Q&A blocks ───────────────────────────────────────
  // "1. What is photosynthesis?"
  // "   It is the process by which plants..."
  const NUM_Q_RE = /^\d+[\.\)]\s+(.+\?)\s*$/;
  for (let i = 0; i < lines.length - 1; i++) {
    const qm = lines[i].match(NUM_Q_RE);
    if (qm) {
      // Collect answer lines until blank or next numbered item
      const ansLines = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim() || lines[j].match(/^\d+[\.\)]/)) break;
        ansLines.push(lines[j].trim());
      }
      const ans = ansLines.join(" ").trim();
      if (ans.length > 10) add(qm[1], ans);
    }
  }

  // ── Pattern 4: Bullet pairs ───────────────────────────────────────────────
  // • Short term
  //   Longer definition sentence that follows
  const BULLET_RE = /^[•\-\*]\s+(.+)$/;
  for (let i = 0; i < lines.length - 1; i++) {
    const bm = lines[i].match(BULLET_RE);
    if (bm && bm[1].length <= 80) {
      const next = lines[i + 1]?.trim();
      if (next && next.length > 20 && !next.match(BULLET_RE)) {
        add(bm[1], next);
      }
    }
  }

  // ── Pattern 5: Paragraph sentence extraction ─────────────────────────────
  // Join paragraphs, split into sentences, find sentences that contain
  // a definition signal word (is, are, refers to, defined as, means, etc.)
  const DEF_SIGNAL = /\b(is|are|was|were|refers to|defined as|means|describes|involves|consists of|known as|called)\b/i;
  const paragraphs = text.split(/\n{2,}/);

  for (const para of paragraphs) {
    if (para.length < 30) continue;
    const sentences = para
      .replace(/([.!?])\s+/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 20);

    for (const sentence of sentences) {
      if (!DEF_SIGNAL.test(sentence)) continue;

      // Extract subject (text before the signal verb) as the term
      const m = sentence.match(/^([A-Z][^,\.]{3,60}?)\s+(?:is|are|was|were|refers to|defined as|means|describes|involves|consists of|known as|called)\b/i);
      if (m) {
        const term = m[1].trim();
        if (term.split(" ").length <= 8) {
          add(term, sentence);
        }
      }
    }
  }

  if (cards.length === 0) {
    throw new Error(
      "Could not detect flashcard patterns. Try using this format: " +
      "Term: [your term] Definition: [your definition] " +
      "or  Term - Definition  on each line."
    );
  }

  // Return as a resolved promise so call sites can use await
  return Promise.resolve(cards.slice(0, 60));
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function renderPreview(cards) {
  previewList.innerHTML = "";
  cards.forEach((card, i) => {
    const row = document.createElement("div");
    row.className = "preview-row";
    row.innerHTML = `
      <div class="preview-num">${i + 1}</div>
      <div class="preview-content">
        <input class="preview-term" value="${escHtml(card.term)}" placeholder="Term">
        <input class="preview-def"  value="${escHtml(card.definition)}" placeholder="Definition">
      </div>
      <button class="preview-del" data-i="${i}" title="Remove">✕</button>
    `;
    row.querySelector(".preview-term").addEventListener("input", e => { pendingCards[i].term = e.target.value; });
    row.querySelector(".preview-def").addEventListener("input",  e => { pendingCards[i].definition = e.target.value; });
    row.querySelector(".preview-del").addEventListener("click",  () => {
      pendingCards.splice(i, 1);
      renderPreview(pendingCards);
    });
    previewList.appendChild(row);
  });
  previewSection.classList.remove("hidden");
}

// ─── Save imported cards ──────────────────────────────────────────────────────

saveImportBtn?.addEventListener("click", async () => {
  if (!pendingCards.length) { setStatus("Nothing to save.", false); return; }

  const catId   = importCategorySelect?.value || "";
  const catName = importCategorySelect?.options[importCategorySelect.selectedIndex]?.text || catId;
  const topic   = importTopicInput?.value.trim() || "General";

  if (!catId) { setStatus("Please select a category.", false); return; }

  setStatus("Saving…", true);
  let saved = 0;

  for (const card of pendingCards) {
    if (!card.term || !card.definition) continue;
    try {
      const doc = {
        studentId: currentUser.uid,
        categoryId: catId, categoryName: catName, topic,
        term: card.term, definition: card.definition,
        source: "parsed", createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, "studentFlashcards"), doc);
      allCards.push({ id: ref.id, ...doc });
      saved++;
    } catch (e) { console.error("Save error:", e); }
  }

  setStatus(`✅ Saved ${saved} card(s)!`, false);
  pendingCards = [];
  previewSection.classList.add("hidden");

  setTimeout(() => {
    importModal.classList.add("hidden");
    renderCategoryGrid();
  }, 1200);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(msg, loading) {
  if (importStatus) importStatus.textContent = msg;
  if (importSpinner) importSpinner.classList.toggle("hidden", !loading);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}