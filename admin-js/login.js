import app from "../firebase-config.js";
import { showFlash } from "../flash/flash.js";

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
const togglePassword = document.querySelector(".toggle-password");

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "../admin-html/dashboard.html";
  }
});

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.alt = isPassword ? "Hide Password" : "Show Password";
  });
}

if (loginForm) {
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

      showFlash("Login successful. Redirecting...", "success");

      setTimeout(() => {
        window.location.href = "../admin-html/dashboard.html";
      }, 700);

    } catch (error) {
      console.error("Login error:", error);

      if (error.code === "auth/invalid-credential") {
        showFlash("Invalid email or password.", "error");
      } else if (error.code === "auth/user-not-found") {
        showFlash("No account found with this email.", "error");
      } else if (error.code === "auth/wrong-password") {
        showFlash("Incorrect password.", "error");
      } else if (error.code === "auth/too-many-requests") {
        showFlash("Too many attempts. Please try again later.", "warning");
      } else {
        showFlash("Login failed. Please try again.", "error");
      }

      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    }
  });
}

// Link the existing "Register" button to the new admin registration page.
const registerNavBtn = document.querySelector(".btn-register");
if (registerNavBtn) {
  registerNavBtn.addEventListener("click", () => {
    window.location.href = "./admin-register.html";
  });
}