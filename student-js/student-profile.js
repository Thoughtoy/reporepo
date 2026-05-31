import app from "../firebase-config.js";

import {
  getAuth,
  onAuthStateChanged,
  updateProfile
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

const profileInitial =
  document.getElementById("profileInitial");

const fullNameInput =
  document.getElementById("fullNameInput");

const dobInput =
  document.getElementById("dobInput");

const mobileInput =
  document.getElementById("mobileInput");

const emailInput =
  document.getElementById("emailInput");

const profilePreview =
  document.getElementById("profilePreview");

const genderCards =
  document.querySelectorAll(".gender-card");

const saveBtn =
  document.getElementById("saveBtn");

const photoInput =
  document.getElementById("photoInput");

let currentUser = null;

/* FLASH */

function showFlash(message, type = "success") {

  let box =
    document.querySelector(".flash-box");

  if (!box) {

    box =
      document.createElement("div");

    box.className = "flash-box";

    document.body.appendChild(box);

  }

  box.innerHTML =
    `<div class="flash ${type}">
      ${message}
    </div>`;

  setTimeout(() => {
    box.innerHTML = "";
  }, 3000);

}

/* GENDER */

function setActiveGender(gender) {

  genderCards.forEach((card) => {

    card.classList.toggle(
      "active",
      card.dataset.gender === gender
    );

  });

}

window.selectGender = function(card) {

  setActiveGender(card.dataset.gender);

};

/* LOAD PROFILE */

async function loadProfileData(user) {

  const userRef =
    doc(db, "users", user.uid);

  const userSnap =
    await getDoc(userRef);

  const data =
    userSnap.exists()
      ? userSnap.data()
      : {};

  fullNameInput.value =
    data.fullName || "";

  dobInput.value =
    data.dob || "";

  mobileInput.value =
    data.mobile || "";

  emailInput.value =
    user.email || "";

  if (data.gender) {

    setActiveGender(data.gender);

  }

  if (data.photoURL) {

    profilePreview.src =
      data.photoURL;

  }

  const initial =
    (data.fullName || user.email || "?")
      .charAt(0)
      .toUpperCase();

  profileInitial.textContent =
    initial;

}

/* SAVE */

window.saveProfile =
  async function() {

    if (!currentUser) return;

    try {

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      const gender =
        document.querySelector(".gender-card.active")
          ?.dataset.gender || "";

      const profileData = {

        uid: currentUser.uid,

        fullName:
          fullNameInput.value.trim(),

        dob:
          dobInput.value.trim(),

        mobile:
          mobileInput.value.trim(),

        gender,

        email:
          currentUser.email,

        updatedAt:
          serverTimestamp()

      };

      await setDoc(
        doc(db, "users", currentUser.uid),
        profileData,
        { merge: true }
      );

      await updateProfile(
        currentUser,
        {
          displayName:
            profileData.fullName
        }
      );

      profileInitial.textContent =
        profileData.fullName
          .charAt(0)
          .toUpperCase();

      showFlash(
        "Profile updated successfully.",
        "success"
      );

    } catch (error) {

      console.error(error);

      showFlash(
        "Failed to save profile.",
        "error"
      );

    } finally {

      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";

    }

};

/* DISCARD */

window.loadProfile =
  function() {

    window.location.reload();

};

/* BACK */

window.goBack =
  function() {

    window.history.back();

};

/* PHOTO */

window.uploadPhoto =
  function() {

    photoInput.click();

};

photoInput.addEventListener(
  "change",
  (event) => {

    const file =
      event.target.files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = (e) => {

      profilePreview.src =
        e.target.result;

    };

    reader.readAsDataURL(file);

  }
);

/* AUTH */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "./student-login.html";

      return;

    }

    currentUser = user;

    await loadProfileData(user);

  }
);