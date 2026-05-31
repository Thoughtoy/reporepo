import app from "../firebase-config.js";

import {
  getAuth,
  signOut
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import { showFlash } from "../flash/flash.js";

const auth = getAuth(app);

const sidebarContainer = document.getElementById("sidebar-container");

fetch("../sidebar/sidebar.html")
  .then(response => response.text())
  .then(data => {
    sidebarContainer.innerHTML = data;

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
      sidebar.addEventListener("mouseenter", () => {
        sidebar.classList.add("expanded");
      });

      sidebar.addEventListener("mouseleave", () => {
        sidebar.classList.remove("expanded");
      });
    }

    const currentPage = window.location.pathname.split("/").pop();
    const links = document.querySelectorAll(".sidebar-link");

    links.forEach(link => {
      const linkPage = link.getAttribute("href").split("/").pop();

      if (linkPage === currentPage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        const confirmed = await showConfirm(
          "Logout Account",
          "Are you sure you want to logout?"
        );

        if (!confirmed) return;

        try {
          await signOut(auth);
          showFlash("Logged out successfully.", "success");

          setTimeout(() => {
            window.location.href = "../admin-html/login.html";
          }, 700);

        } catch (error) {
          console.error("Logout failed:", error);
          showFlash("Failed to logout. Please try again.", "error");
        }
      });
    }
  })
  .catch(error => {
    console.error("Sidebar failed to load:", error);
  });

function showConfirm(title, message) {
  return new Promise((resolve) => {
    const oldModal = document.getElementById("confirmOverlay");

    if (oldModal) oldModal.remove();

    const overlay = document.createElement("div");
    overlay.id = "confirmOverlay";
    overlay.className = "confirm-overlay";

    overlay.innerHTML = `
      <div class="confirm-box">
        <h3>${title}</h3>
        <p>${message}</p>

        <div class="confirm-actions">
          <button type="button" class="confirm-cancel" id="confirmCancel">
            Cancel
          </button>

          <button type="button" class="confirm-yes" id="confirmYes">
            Logout
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = document.getElementById("confirmCancel");
    const yesBtn = document.getElementById("confirmYes");

    cancelBtn.addEventListener("click", () => {
      overlay.remove();
      resolve(false);
    });

    yesBtn.addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}