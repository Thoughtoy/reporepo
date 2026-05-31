const slides = [
  {
    title: "Study Anytime,<br>Anywhere",
    subtitle: "Access your reviewer materials even without internet connection.",
    image: "../assets/images/onboarding-1.png"
  },
  {
    title: "Challenge your<br>self daily",
    subtitle: "Practice with a lot of questions from previous LET examinations.",
    image: "../assets/images/onboarding-2.png"
  },
  {
    title: "Track your<br>progress",
    subtitle: "Monitor your improvements and identify areas that need more focus.",
    image: "../assets/images/onboarding-3.png"
  }
];

let currentSlide = 0;

const titleEl = document.getElementById("slideTitle");
const subtitleEl = document.getElementById("slideSubtitle");
const imageEl = document.getElementById("slideImage");
const nextBtn = document.getElementById("nextSlideBtn");
const dots = document.querySelectorAll(".dot");

function renderSlide(index) {
  const slide = slides[index];

  titleEl.innerHTML = slide.title;
  subtitleEl.textContent = slide.subtitle;
  imageEl.src = slide.image;

  nextBtn.textContent = index === slides.length - 1 ? "Finish" : "Next";

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === index);
  });
}

nextBtn.addEventListener("click", () => {
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    renderSlide(currentSlide);
  } else {
    localStorage.setItem("leaflet_onboarding_done", "true");
    window.location.href = "./home.html";
  }
});

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    currentSlide = Number(dot.dataset.index);
    renderSlide(currentSlide);
  });
});

renderSlide(currentSlide);