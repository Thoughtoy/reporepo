import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const headerContainer = document.getElementById("header-container");

fetch("../header/header.html")
  .then(response => response.text())
  .then(data => {
    headerContainer.innerHTML = data;

    setPageTitle();
    loadProfile();
    setupProfileRoute();

    document.dispatchEvent(new CustomEvent("headerReady"));
  })
  .catch(error => {
    console.error("Header failed to load:", error);
  });

function setPageTitle() {
  const pageTitle = document.getElementById("pageTitle");
  if (!pageTitle) return;

  const titles = {
    "dashboard.html": "Dashboard",
    "questions.html": "Question Management",
    "categories.html": "Category Management",
    "students.html": "Student Management",
    "profile.html": "Edit Profile"
  };

  const currentPage = window.location.pathname.split("/").pop();

  pageTitle.textContent = titles[currentPage] || "LeafLET";
}

function setupProfileRoute() {
  const profileChip = document.getElementById("profileChip");

  if (!profileChip) return;

  profileChip.addEventListener("click", () => {
    const currentPage = window.location.pathname.split("/").pop();

    if (currentPage !== "profile.html") {
      window.location.href = "../admin-html/profile.html";
    }
  });
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function loadProfile() {
  const auth = getAuth(app);
  const db = getFirestore(app);

  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const avatar = document.getElementById("avatar");

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const displayName =
        userData.fullName ||
        userData.displayName ||
        user.displayName ||
        user.email.split("@")[0];

      const role = userData.role || "Admin";

      if (profileName) profileName.textContent = displayName;
      if (profileRole) profileRole.textContent = role;
      if (avatar) avatar.textContent = getInitials(displayName);

      document.body.dataset.userLoaded = "true";
      document.dispatchEvent(new CustomEvent("userLoaded", {
        detail: { user, displayName, role }
      }));

    } catch (error) {
      console.error("Could not load user profile:", error);

      const fallbackName = user.displayName || user.email.split("@")[0];

      if (profileName) profileName.textContent = fallbackName;
      if (profileRole) profileRole.textContent = "Admin";
      if (avatar) avatar.textContent = getInitials(fallbackName);

      document.body.dataset.userLoaded = "true";
      document.dispatchEvent(new CustomEvent("userLoaded", {
        detail: { user, displayName: fallbackName, role: "Admin" }
      }));
    }
  });
}