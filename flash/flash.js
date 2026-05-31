export function showFlash(message, type = "success") {
  let flashBox = document.getElementById("flashBox");

  if (!flashBox) {
    flashBox = document.createElement("div");
    flashBox.id = "flashBox";
    document.body.appendChild(flashBox);
  }

  const flash = document.createElement("div");
  flash.className = `flash-message ${type}`;
  flash.textContent = message;

  flashBox.appendChild(flash);

  setTimeout(() => {
    flash.classList.add("show");
  }, 50);

  setTimeout(() => {
    flash.classList.remove("show");

    setTimeout(() => {
      flash.remove();
    }, 300);
  }, 3000);
}