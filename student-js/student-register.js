import app from "../firebase-config.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile
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

const fullNameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = fullNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

  if (!fullName || !email || !password || !confirmPassword) {
    showFlash("Please complete all fields.", "warning");
    return;
  }

  if (password.length < 6) {
    showFlash("Password must be at least 6 characters.", "warning");
    return;
  }

  if (password !== confirmPassword) {
    showFlash("Passwords do not match.", "error");
    return;
  }

  try {
    registerBtn.disabled = true;
    registerBtn.textContent = "Creating account...";

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    await updateProfile(user, {
      displayName: fullName
    });

    await setDoc(doc(db, "students", user.uid), {
      uid: user.uid,
      fullName: fullName,
      email: email,
      role: "student",
      status: "active",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      progress: {
        general: 0,
        professional: 0,
        major: 0
      }
    });

    showFlash("Account created successfully!", "success");

    setTimeout(() => {
      window.location.href = "./home.html";
    }, 800);

  } catch (error) {
    console.error("Student register error:", error);

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
    registerBtn.textContent = "Register";
  }
});

document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);

    if (!input) return;

    const isPassword = input.type === "password";

    input.type = isPassword ? "text" : "password";
    btn.textContent = isPassword ? "Hide" : "Show";
  });
});

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


    await setDoc(doc(db, "students", user.uid), {
      uid: user.uid,
      fullName: fullName,
      email: email,
      role: "student",
      status: "active",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    }, { merge: true });
    