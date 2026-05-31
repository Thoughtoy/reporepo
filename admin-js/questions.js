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

let questions = [];
let activeIndex = 0;
let categoryMap = {};
let categoryList = [];

const questionList = document.getElementById("questionList");
const questionCount = document.getElementById("questionCount");
const addQuestionBtn = document.getElementById("addQuestionBtn");

const categorySelect = document.getElementById("categorySelect");
const topicSelect = document.getElementById("topicSelect");
const typeSelect = document.getElementById("typeSelect");
const questionLabel = document.getElementById("questionLabel");
const questionTextarea = document.getElementById("questionTextarea");
const requiredToggle = document.getElementById("requiredToggle");
const multipleAnswer = document.getElementById("multipleAnswer");
const answersContainer = document.getElementById("answersContainer");
const addAnswerBtn = document.getElementById("addAnswerBtn");
const previewBtn = document.getElementById("previewBtn");
const publishBtn = document.getElementById("publishBtn");

const previewModal = document.getElementById("previewModal");
const closePreviewBtn = document.getElementById("closePreviewBtn");
const previewCategory = document.getElementById("previewCategory");
const previewQuestion = document.getElementById("previewQuestion");
const previewChoices = document.getElementById("previewChoices");

document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  initCategoryDropdown();
  await loadQuestions();
});

async function loadCategories() {
  try {
    const catSnap = await getDocs(
      query(collection(db, "categories"), orderBy("order", "asc"))
    );

    categoryMap = {};
    categoryList = [];

    await Promise.all(
      catSnap.docs.map(async catDoc => {
        const catData = catDoc.data();

        const topicSnap = await getDocs(
          query(
            collection(db, "categories", catDoc.id, "topics"),
            orderBy("order", "asc")
          )
        );

        const topics = topicSnap.docs.map(t => ({
          id: t.id,
          name: t.data().name,
          order: t.data().order
        }));

        categoryMap[catDoc.id] = {
          id: catDoc.id,
          name: catData.name,
          order: catData.order,
          topics
        };

        categoryList.push({
          id: catDoc.id,
          name: catData.name,
          order: catData.order
        });
      })
    );

    categoryList.sort((a, b) => a.order - b.order);

  } catch (error) {
    console.error("Failed to load categories:", error);
  }
}

function initCategoryDropdown() {
  categorySelect.innerHTML = "";

  categoryList.forEach(cat => {
    const option = new Option(cat.name, cat.id);
    categorySelect.appendChild(option);
  });

  populateTopicDropdown(categorySelect.value);

  categorySelect.addEventListener("change", () => {
    populateTopicDropdown(categorySelect.value);
    updateCurrentLocalQuestion();
    renderQuestionList();
  });

  topicSelect.addEventListener("change", () => {
    updateCurrentLocalQuestion();
    renderQuestionList();
  });
}

function populateTopicDropdown(categoryId, selectedTopicId = null) {
  topicSelect.innerHTML = "";

  const category = categoryMap[categoryId];
  if (!category) return;

  category.topics.forEach(topic => {
    const option = new Option(topic.name, topic.id);
    topicSelect.appendChild(option);
  });

  if (selectedTopicId) {
    topicSelect.value = selectedTopicId;
  }
}

async function loadQuestions() {
  try {
    const snap = await getDocs(
      query(collection(db, "questions"), orderBy("order", "asc"))
    );

    questions = snap.docs.map((documentSnapshot, index) => ({
      id: documentSnapshot.id,
      isDraft: false,
      order: documentSnapshot.data().order ?? index,
      ...documentSnapshot.data()
    }));

    activeIndex = 0;
    renderQuestionList();

    if (questions.length > 0) {
      renderEditor(0);
    } else {
      createLocalQuestion();
    }

  } catch (error) {
    console.error("Failed to load questions:", error);
  }
}

function createLocalQuestion() {
  const categoryId = categorySelect.value || categoryList[0]?.id || "";
  const topicId = topicSelect.value || categoryMap[categoryId]?.topics[0]?.id || "";

  const draft = {
    id: `draft-${Date.now()}`,
    isDraft: true,
    categoryId,
    topicId,
    type: "Multiple Choice",
    questionText: "",
    choices: ["", "", "", ""],
    correctIndexes: [],
    required: true,
    multipleAnswer: false,
    published: false,
    order: questions.length
  };

  questions.push(draft);
  activeIndex = questions.length - 1;

  renderQuestionList();
  renderEditor(activeIndex);
}

function renderQuestionList() {
  questionCount.textContent = `QUESTION (${questions.length})`;
  questionList.innerHTML = "";

  if (questions.length === 0) {
    questionList.innerHTML = `
      <div class="empty-question">
        No questions yet. Click + to add one.
      </div>
    `;
    return;
  }

  questions.forEach((q, index) => {
    const topicName = resolveTopicName(q.categoryId, q.topicId) || "Untitled";
    const typeName = q.type || "Multiple Choice";

    const card = document.createElement("div");
    card.className = `question-card ${index === activeIndex ? "active" : ""}`;

    card.innerHTML = `
      <span class="q-number">${index + 1}</span>
      <div>
        <h3>${escapeHtml(topicName)}</h3>
        <p>${escapeHtml(typeName)}${q.isDraft ? " • Draft" : ""}</p>
      </div>
      <button class="card-menu-btn">•••</button>
    `;

    card.addEventListener("click", event => {
      if (event.target.classList.contains("card-menu-btn")) return;

      updateCurrentLocalQuestion();
      activeIndex = index;

      renderQuestionList();
      renderEditor(activeIndex);
    });

    card.querySelector(".card-menu-btn").addEventListener("click", event => {
      event.stopPropagation();
      deleteQuestion(index);
    });

    questionList.appendChild(card);
  });
}

function renderEditor(index) {
  const q = questions[index];
  if (!q) return;

  questionLabel.textContent = `Question ${index + 1}${q.required ? "*" : ""}`;

  categorySelect.value = q.categoryId || categorySelect.value;
  populateTopicDropdown(categorySelect.value, q.topicId);

  typeSelect.value = q.type || "Multiple Choice";
  questionTextarea.value = q.questionText || "";
  requiredToggle.checked = q.required !== false;
  multipleAnswer.checked = q.multipleAnswer === true;

  renderAnswerSection();
}

function renderAnswerSection() {
  const q = questions[activeIndex];
  if (!q) return;

  const choiceOptions = document.querySelector(".choice-options");

  answersContainer.innerHTML = "";

  if (q.type === "Multiple Choice") {
    choiceOptions.style.display = "flex";
    multipleAnswer.disabled = false;
    addAnswerBtn.style.display = "inline-block";
    addAnswerBtn.textContent = "＋ Add Answer";

    const choices = q.choices?.length ? q.choices : ["", "", "", ""];
    renderMultipleChoiceAnswers(choices, q.correctIndexes || []);
    return;
  }

  if (q.type === "Identification") {
    choiceOptions.style.display = "none";
    multipleAnswer.checked = false;
    multipleAnswer.disabled = true;
    addAnswerBtn.style.display = "none";

    const answer = q.choices?.[0] || "";

    const row = document.createElement("div");
    row.className = "identification-answer";

    row.innerHTML = `
      <label>Correct Answer</label>
      <input
        type="text"
        id="identificationAnswer"
        value="${escapeHtml(answer)}"
        placeholder="Enter the correct answer"
      >
    `;

    answersContainer.appendChild(row);

    document
      .getElementById("identificationAnswer")
      .addEventListener("input", updateCurrentLocalQuestion);

    return;
  }

  if (q.type === "Enumeration") {
    choiceOptions.style.display = "none";
    multipleAnswer.checked = true;
    multipleAnswer.disabled = true;
    addAnswerBtn.style.display = "inline-block";
    addAnswerBtn.textContent = "＋ Add Accepted Answer";

    const answers = q.choices?.length ? q.choices : [""];
    answers.forEach(answer => {
      answersContainer.appendChild(createEnumerationRow(answer));
    });
  }
}

function renderMultipleChoiceAnswers(choices, correctIndexes) {
  answersContainer.innerHTML = "";

  choices.forEach((choice, index) => {
    answersContainer.appendChild(
      createAnswerRow(choice, correctIndexes.includes(index))
    );
  });
}

function createAnswerRow(value = "", isCorrect = false) {
  const inputType = multipleAnswer.checked ? "checkbox" : "radio";

  const row = document.createElement("div");
  row.className = "answer-row";

  row.innerHTML = `
    <input type="${inputType}" name="answer" ${isCorrect ? "checked" : ""}>
    <input type="text" value="${escapeHtml(value)}" placeholder="Type answer here...">
    <button class="drag-btn" title="Reorder">⠿</button>
    <button class="delete-btn" title="Delete">🗑</button>
  `;

  row.querySelector(".delete-btn").addEventListener("click", () => {
    row.remove();
    updateCurrentLocalQuestion();
  });

  row.querySelector("input[type='text']").addEventListener("input", updateCurrentLocalQuestion);
  row.querySelector(`input[type='${inputType}']`).addEventListener("change", updateCurrentLocalQuestion);

  return row;
}

function createEnumerationRow(value = "") {
  const row = document.createElement("div");
  row.className = "enumeration-row";

  row.innerHTML = `
    <input type="text" value="${escapeHtml(value)}" placeholder="Enter accepted answer">
    <button class="delete-btn" type="button">🗑</button>
  `;

  row.querySelector("input").addEventListener("input", updateCurrentLocalQuestion);

  row.querySelector(".delete-btn").addEventListener("click", () => {
    row.remove();
    updateCurrentLocalQuestion();
  });

  return row;
}

function updateCurrentLocalQuestion() {
  const q = questions[activeIndex];
  if (!q) return;

  q.categoryId = categorySelect.value;
  q.topicId = topicSelect.value;
  q.type = typeSelect.value;
  q.questionText = questionTextarea.value.trim();
  q.required = requiredToggle.checked;

  if (q.type === "Multiple Choice") {
    const rows = [...answersContainer.querySelectorAll(".answer-row")];
    const inputType = multipleAnswer.checked ? "checkbox" : "radio";

    q.multipleAnswer = multipleAnswer.checked;

    q.choices = rows.map(row =>
      row.querySelector("input[type='text']").value.trim()
    );

    q.correctIndexes = rows
      .map((row, index) => {
        const answerInput = row.querySelector(`input[type='${inputType}']`);
        return answerInput?.checked ? index : null;
      })
      .filter(index => index !== null);
  }

  if (q.type === "Identification") {
    const input = document.getElementById("identificationAnswer");

    q.multipleAnswer = false;
    q.choices = [input?.value.trim() || ""];
    q.correctIndexes = [0];
  }

  if (q.type === "Enumeration") {
    const rows = [...answersContainer.querySelectorAll(".enumeration-row")];

    q.multipleAnswer = true;

    q.choices = rows.map(row =>
      row.querySelector("input").value.trim()
    );

    q.correctIndexes = q.choices.map((_, index) => index);
  }

  questionLabel.textContent = `Question ${activeIndex + 1}${q.required ? "*" : ""}`;
}

addQuestionBtn.addEventListener("click", () => {
  updateCurrentLocalQuestion();
  createLocalQuestion();
});

addAnswerBtn.addEventListener("click", () => {
  const q = questions[activeIndex];
  if (!q) return;

  if (q.type === "Multiple Choice") {
    const row = createAnswerRow("", false);
    answersContainer.appendChild(row);
    row.querySelector("input[type='text']").focus();
  }

  if (q.type === "Enumeration") {
    const row = createEnumerationRow("");
    answersContainer.appendChild(row);
    row.querySelector("input").focus();
  }

  updateCurrentLocalQuestion();
});

typeSelect.addEventListener("change", () => {
  updateCurrentLocalQuestion();
  renderAnswerSection();
  renderQuestionList();
});

questionTextarea.addEventListener("input", updateCurrentLocalQuestion);

requiredToggle.addEventListener("change", updateCurrentLocalQuestion);

multipleAnswer.addEventListener("change", () => {
  updateCurrentLocalQuestion();
  renderAnswerSection();
});

publishBtn.addEventListener("click", async () => {
  updateCurrentLocalQuestion();

  const q = questions[activeIndex];
  if (!q) return;

  if (!q.questionText) {
    alert("Please enter a question first.");
    return;
  }

  const cleanChoices = q.choices.filter(choice => choice.trim() !== "");

  if (q.type === "Multiple Choice") {
    if (cleanChoices.length < 2) {
      alert("Please enter at least two choices.");
      return;
    }

    if (q.correctIndexes.length === 0) {
      alert("Please select the correct answer.");
      return;
    }
  }

  if (q.type === "Identification") {
    if (!q.choices[0]?.trim()) {
      alert("Please enter the correct answer.");
      return;
    }
  }

  if (q.type === "Enumeration") {
    if (cleanChoices.length < 1) {
      alert("Please enter at least one accepted answer.");
      return;
    }
  }

  const questionData = {
    categoryId: q.categoryId,
    topicId: q.topicId,
    type: q.type,
    questionText: q.questionText,
    choices: q.choices,
    correctIndexes: q.correctIndexes,
    required: q.required,
    multipleAnswer: q.multipleAnswer,
    published: true,
    order: q.order ?? questions.length,
    updatedAt: serverTimestamp()
  };

  try {
    if (q.isDraft) {
      questionData.createdAt = serverTimestamp();

      const docRef = await addDoc(
        collection(db, "questions"),
        questionData
      );

      q.id = docRef.id;
      q.isDraft = false;

    } else {
      await updateDoc(
        doc(db, "questions", q.id),
        questionData
      );
    }

    alert("Question published!");
    await loadQuestions();

  } catch (error) {
    console.error("Failed to publish question:", error);
    alert("Failed to publish question.");
  }
});

previewBtn.addEventListener("click", () => {
  updateCurrentLocalQuestion();

  const q = questions[activeIndex];
  if (!q) return;

  previewCategory.textContent =
    `${getSelectedCategoryName()} • ${getSelectedTopicName()}`;

  previewQuestion.textContent =
    q.questionText || "No question entered yet.";

  previewChoices.innerHTML = "";

  if (q.type === "Multiple Choice") {
    const inputType = q.multipleAnswer ? "checkbox" : "radio";

    q.choices.forEach(choice => {
      if (!choice.trim()) return;

      const item = document.createElement("label");
      item.className = "preview-choice";

      item.innerHTML = `
        <input type="${inputType}" name="previewAnswer">
        <span>${escapeHtml(choice)}</span>
      `;

      previewChoices.appendChild(item);
    });
  }

  if (q.type === "Identification") {
    previewChoices.innerHTML = `
      <input class="preview-text-answer" type="text" placeholder="Type your answer here">
    `;
  }

  if (q.type === "Enumeration") {
    q.choices.forEach((_, index) => {
      const item = document.createElement("input");
      item.className = "preview-text-answer";
      item.type = "text";
      item.placeholder = `Answer ${index + 1}`;
      previewChoices.appendChild(item);
    });
  }

  previewModal.classList.add("show");
});

closePreviewBtn.addEventListener("click", () => {
  previewModal.classList.remove("show");
});

previewModal.addEventListener("click", event => {
  if (event.target === previewModal) {
    previewModal.classList.remove("show");
  }
});

async function deleteQuestion(index) {
  const q = questions[index];
  if (!q) return;

  const confirmed = confirm(`Delete Question ${index + 1}?`);
  if (!confirmed) return;

  try {
    if (!q.isDraft) {
      await deleteDoc(doc(db, "questions", q.id));
    }

    questions.splice(index, 1);
    activeIndex = Math.max(0, questions.length - 1);

    renderQuestionList();

    if (questions.length > 0) {
      renderEditor(activeIndex);
    } else {
      createLocalQuestion();
    }

  } catch (error) {
    console.error("Delete failed:", error);
    alert("Delete failed.");
  }
}

function resolveTopicName(categoryId, topicId) {
  const category = categoryMap[categoryId];
  const topic = category?.topics.find(item => item.id === topicId);
  return topic?.name || null;
}

function getSelectedCategoryName() {
  return categorySelect.options[categorySelect.selectedIndex]?.text || "";
}

function getSelectedTopicName() {
  return topicSelect.options[topicSelect.selectedIndex]?.text || "";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}