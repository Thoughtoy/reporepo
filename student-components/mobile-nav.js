import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const auth = getAuth(app);

const navContainer =
  document.getElementById("mobile-nav-container") ||
  document.getElementById("mobileNavContainer");

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

if (!navContainer) {
  console.error("Mobile nav container not found.");
} else {
  fetch("../student-components/mobile-nav.html")
    .then(response => response.text())
    .then(data => {
      navContainer.innerHTML = data;
      setActiveNav();
      setupNavRoutes();
    })
    .catch(error => {
      console.error("Mobile nav failed to load:", error);
    });
}

function setActiveNav() {
  const currentPage = window.location.pathname.split("/").pop();

  const pageMap = {
    "home.html": "home",
    "quiz.html": "quiz",
    "game.html": "game",
    "flashcards.html": "game",
    "exam.html": "exam",
    "exam-simulation.html": "exam",
    "profile.html": "profile"
  };

  const activePage = pageMap[currentPage] || "home";

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === activePage
    );
  });
}

function setupNavRoutes() {
  const routes = {
    home: "./home.html",
    quiz: "./quiz.html",
    game: "./game.html",
    exam: "./exam.html",
    profile: "./profile.html"
  };

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      if (page === "home") {
        window.location.href = routes.home;
        return;
      }

      if (!currentUser) {
        localStorage.setItem(
          "leaflet_redirect_after_login",
          routes[page] || "./home.html"
        );

        window.location.href = "./student-login.html";
        return;
      }

      window.location.href =
        routes[page] || "./home.html";
    });
  });
}