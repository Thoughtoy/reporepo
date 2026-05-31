import app from "../firebase-config.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const auth = getAuth(app);

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

setupPasswordToggles();

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./home.html";
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showFlash("Please enter your email and password.", "warning");
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    await signInWithEmailAndPassword(auth, email, password);

    showFlash("Login successful. Redirecting...");

    setTimeout(() => {
      const redirect = localStorage.getItem("leaflet_redirect_after_login");
      localStorage.removeItem("leaflet_redirect_after_login");
      window.location.href = redirect || "./home.html";
    }, 700);

  } catch (error) {
    console.error("Student login error:", error);

    if (error.code === "auth/invalid-credential") {
      showFlash("Invalid email or password.", "error");
    } else if (error.code === "auth/too-many-requests") {
      showFlash("Too many attempts. Try again later.", "warning");
    } else {
      showFlash("Login failed. Please try again.", "error");
    }

    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
});

function setupPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      btn.textContent = isHidden ? "Hide" : "Show";
    });
  });
}

function showFlash(message, type = "success") {
  let box = document.querySelector(".flash-box");

  if (!box) {
    box = document.createElement("div");
    box.className = "flash-box";
    document.body.appendChild(box);
  }

  box.innerHTML = `<div class="flash ${type}">${message}</div>`;

  setTimeout(() => {
    box.innerHTML = "";
  }, 3000);
}