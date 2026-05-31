import app from "../firebase-config.js";
import { showFlash } from "../flash/flash.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const registerForm = document.getElementById("registerForm");
const registerBtn = document.getElementById("registerBtn");
const backToLoginBtn = document.getElementById("backToLoginBtn");

const fullNameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

document.querySelectorAll(".toggle-password").forEach((toggle, index) => {
  toggle.addEventListener("click", () => {
    const inputs = [passwordInput, confirmPasswordInput].filter(Boolean);
    const input = inputs[index] || passwordInput;
    if (!input) return;

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggle.alt = isPassword ? "Hide Password" : "Show Password";
  });
});

if (backToLoginBtn) {
  backToLoginBtn.addEventListener("click", () => {
    window.location.href = "../admin-html/login.html";
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = (fullNameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const password = (passwordInput?.value || "").trim();
    const confirmPassword = (confirmPasswordInput?.value || "").trim();

    if (!fullName || !email || !password || !confirmPassword) {
      showFlash("Please complete all fields.", "warning");
      return;
    }

    if (password !== confirmPassword) {
      showFlash("Passwords do not match.", "error");
      return;
    }

    // Mirror Firebase's constraints but give a friendlier message.
    if (password.length < 6) {
      showFlash("Password must be at least 6 characters.", "warning");
      return;
    }

    try {
      registerBtn.disabled = true;
      registerBtn.textContent = "Creating account...";

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // Helps the dashboard greeting / profile display name.
      await updateProfile(user, { displayName: fullName });

      // `profile.js` expects admin data under the `users` collection.
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          fullName,
          email: user.email,
          role: "Admin",
          status: "active",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        },
        { merge: true }
      );

      showFlash("Account created successfully!", "success");

      // Firebase auto-signs in after registration; sign out so the user
      // lands on the login page (instead of being redirected to dashboard).
      await signOut(auth);

      // Redirect back to the admin login page.
      setTimeout(() => {
        window.location.href = "./login.html";
      }, 800);
    } catch (error) {
      console.error("Admin register error:", error);

      if (error.code === "auth/email-already-in-use") {
        showFlash("This email is already registered.", "error");
      } else if (error.code === "auth/invalid-email") {
        showFlash("Please enter a valid email address.", "error");
      } else if (error.code === "auth/weak-password") {
        showFlash("Password is too weak.", "warning");
      } else {
        showFlash("Registration failed. Please try again.", "error");
      }

      registerBtn.disabled = false;
      registerBtn.textContent = "Create Account";
    }
  });
}


