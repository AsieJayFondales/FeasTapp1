var slideIndex = 0;

// Initiate the slideshow
showSlides();

// Slideshow control function
function showSlides() {
  var i;
  var slides = document.getElementsByClassName("slide");
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  slideIndex++;
  if (slideIndex > slides.length) { slideIndex = 1; }
  slides[slideIndex - 1].style.display = "block";
  setTimeout(showSlides, 3000); // Change slide every 3 seconds
}

// Event listener for the settings dropdown menu
document.addEventListener('DOMContentLoaded', function() {
  var settingsIcon = document.querySelector('.settings-icon');
  if (settingsIcon) {
    settingsIcon.addEventListener('click', function() {
      var settingsMenu = document.querySelector('.settings-menu');
      settingsMenu.classList.toggle('show');
    });
  }
});

// Close the dropdown if the user clicks outside of it
window.onclick = function(event) {
  var settingsMenu = document.querySelector('.settings-menu');
  if (!event.target.closest('.settings-icon')) {
    if (settingsMenu && settingsMenu.classList.contains('show')) {
      settingsMenu.classList.remove('show');
    }
  }
};
