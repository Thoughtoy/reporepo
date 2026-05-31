import app from "../firebase-config.js";
import { showFlash } from "../flash/flash.js";

import {
  getAuth,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let originalProfile = {};

const tabs = document.querySelectorAll(".profile-tab");
const infoForm = document.getElementById("infoForm");
const passwordForm = document.getElementById("passwordForm");

const sideProfileName = document.getElementById("sideProfileName");
const sideProfileRole = document.getElementById("sideProfileRole");
const profileAvatarLarge = document.getElementById("profileAvatarLarge");

const firstNameInput = document.getElementById("firstNameInput");
const middleNameInput = document.getElementById("middleNameInput");
const lastNameInput = document.getElementById("lastNameInput");
const emailInput = document.getElementById("emailInput");
const phoneInput = document.getElementById("phoneInput");
const dobInput = document.getElementById("dobInput");
const addressInput = document.getElementById("addressInput");
const postalInput = document.getElementById("postalInput");
const countryInput = document.getElementById("countryInput");
const genderInput = document.getElementById("genderInput");

const discardInfoBtn = document.getElementById("discardInfoBtn");

const currentPasswordInput = document.getElementById("currentPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const clearPasswordBtn = document.getElementById("clearPasswordBtn");

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  await loadProfile();
});

async function loadProfile() {
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);

  originalProfile = userSnap.exists() ? userSnap.data() : {};

  const emailName = currentUser.email?.split("@")[0] || "Admin";

  const fullName =
    originalProfile.fullName ||
    currentUser.displayName ||
    emailName;

  const parts = fullName.split(" ");

  firstNameInput.value = originalProfile.firstName || parts[0] || "";
  middleNameInput.value = originalProfile.middleName || "";
  lastNameInput.value = originalProfile.lastName || parts.slice(1).join(" ") || "";
  emailInput.value = currentUser.email || "";
  phoneInput.value = originalProfile.phone || "";
  dobInput.value = originalProfile.dob || "";
  addressInput.value = originalProfile.address || "";
  postalInput.value = originalProfile.postal || "";
  countryInput.value = originalProfile.country || "Philippines";
  genderInput.value = originalProfile.gender || "";

  renderSideProfile();
}

function renderSideProfile() {
  const fullName = getFullName() || currentUser.email?.split("@")[0] || "Admin";
  const role = originalProfile.role || "Admin";

  sideProfileName.textContent = fullName;
  sideProfileRole.textContent = role;
  profileAvatarLarge.textContent = getInitials(fullName);
}

function getFullName() {
  return [
    firstNameInput.value.trim(),
    middleNameInput.value.trim(),
    lastNameInput.value.trim()
  ].filter(Boolean).join(" ");
}

async function saveProfile(event) {
  event.preventDefault();

  const fullName = getFullName();

  if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
    alert("Please enter your first and last name.");
    return;
  }

  const profileData = {
    firstName: firstNameInput.value.trim(),
    middleName: middleNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    fullName,
    email: currentUser.email,
    phone: phoneInput.value.trim(),
    dob: dobInput.value,
    address: addressInput.value.trim(),
    postal: postalInput.value.trim(),
    country: countryInput.value.trim(),
    gender: genderInput.value,
    role: originalProfile.role || "Admin",
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", currentUser.uid), profileData, { merge: true });

    originalProfile = {
      ...originalProfile,
      ...profileData
    };

    renderSideProfile();
    alert("Profile updated.");

  } catch (error) {
    console.error("Failed to update profile:", error);
    alert("Failed to update profile.");
  }
}

async function changePassword(event) {
  event.preventDefault();

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert("Please complete all password fields.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("New passwords do not match.");
    return;
  }

  if (!isStrongPassword(newPassword)) {
    alert("Password must be at least 8 characters with uppercase, number, and special character.");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );

    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);

    clearPasswordFields();
    alert("Password updated.");

  } catch (error) {
    console.error("Failed to update password:", error);
    alert(error.message);
  }
}

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function clearPasswordFields() {
  currentPasswordInput.value = "";
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.tab;

    tabs.forEach(item => item.classList.toggle("active", item === tab));

    infoForm.classList.toggle("active", selected === "info");
    passwordForm.classList.toggle("active", selected === "password");
  });
});

infoForm.addEventListener("submit", saveProfile);
passwordForm.addEventListener("submit", changePassword);

discardInfoBtn.addEventListener("click", loadProfile);
clearPasswordBtn.addEventListener("click", clearPasswordFields);