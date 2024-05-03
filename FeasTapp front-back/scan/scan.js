document.addEventListener('DOMContentLoaded', function() {
  var video = document.getElementById('video');
  var cameraButton = document.getElementById('camera-btn');
  var closeCameraButton = document.getElementById('close-camera-btn');
  var videoContainer = document.querySelector('.video-container');
  var uploadInput = document.getElementById('upload-btn');
  

  cameraButton.addEventListener('click', function() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
              video.srcObject = stream;
              video.play();
              video.removeAttribute('hidden'); // Make sure to remove 'hidden' attribute
              videoContainer.style.display = 'block'; // Show the video container
              closeCameraButton.style.display = 'block'; // Show the close button
          }).catch(function(error) {
              console.error("Error accessing the camera: ", error);
              alert('Unable to access camera: ' + error.message);
          });
      } else {
          alert("Sorry, your browser does not support accessing the camera.");
      }
  });

  const input = document.getElementById("upload-btn");
  input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const data = new FormData();
    data.append("image_file", file, "image_file");
    const response = await fetch("/detect", {
      method: "post",
      body: data
    }); 
    const boxes = await response.json();
    draw_image_and_boxes(file, boxes);
    list_detected_ingredients(boxes);
  });

  closeCameraButton.addEventListener('click', function() {
      if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
      }
      video.setAttribute('hidden', true);
      videoContainer.style.display = 'none'; // Hide the video container
      closeCameraButton.style.display = 'none'; // Hide the close button
  });
});

const input = document.getElementById("uploadInput");
  input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const data = new FormData();
    data.append("image_file", file, "image_file");
    const response = await fetch("/detect", {
      method: "post",
      body: data
    }); 
    const boxes = await response.json();
    draw_image_and_boxes(file, boxes);
    list_detected_ingredients(boxes);
  });

  const captureButton = document.getElementById("captureButton");
  captureButton.addEventListener("click", () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        const video = document.createElement("video");
        document.body.appendChild(video);
        video.srcObject = stream;
        video.play();

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        video.addEventListener("loadedmetadata", () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const interval = setInterval(() => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }, 100);

          input.addEventListener("change", () => {
            clearInterval(interval);
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(video);
            const file = input.files[0];
            const data = new FormData();
            data.append("image_file", file, "image_file");
            fetch("/detect", {
              method: "post",
              body: data
            })
            .then(response => response.json())
            .then(boxes => {
              draw_image_and_boxes(file, boxes);
              list_detected_ingredients(boxes);
            });
          });
        });
      })
      .catch(err => {
        console.error("Error accessing camera:", err);
      });
  });

    video.addEventListener("loadedmetadata", () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");
      const blobBin = atob(imageData.split(",")[1]);
      const array = [];
      for (let i = 0; i < blobBin.length; i++) {
        array.push(blobBin.charCodeAt(i));
      }
      const file = new Blob([new Uint8Array(array)], { type: "image/jpeg" });
      draw_image_and_boxes(file, []);
      document.body.removeChild(video);
    });

  const captureAndDetectButton = document.getElementById("captureAndDetectButton");
  captureAndDetectButton.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const video = document.createElement("video");
    document.body.appendChild(video);

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        video.srcObject = stream;
        video.display();
        video.play();
      })
      .catch(err => {
        console.error("Error accessing camera:", err);
      });

    video.addEventListener("loadedmetadata", () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");
      const blobBin = atob(imageData.split(",")[1]);
      const array = [];
      for (let i = 0; i < blobBin.length; i++) {
        array.push(blobBin.charCodeAt(i));
      }
      const file = new Blob([new Uint8Array(array)], { type: "image/jpeg" });
      const data = new FormData();
      data.append("image_file", file, "image_file");
      fetch("/detect", {
        method: "post",
        body: data
      })
      .then(response => response.json())
      .then(boxes => {
        draw_image_and_boxes(file, boxes);
        list_detected_ingredients(boxes);
      });
      document.body.removeChild(video);
    });
  });

  const uploadButton = document.getElementById("uploadButton");
  uploadButton.addEventListener("click", () => {
    const input = document.getElementById("uploadInput");
    input.click();
  });

  // Function to draw an image and bounding boxes on a canvas based on the provided file and boxes array.
  function draw_image_and_boxes(file, boxes) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.querySelector("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 3;
      ctx.font = "18px serif";
      boxes.forEach(([x1, y1, x2, y2, label]) => {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = "#00ff00";
        const width = ctx.measureText(label).width;
        ctx.fillRect(x1, y1, width + 10, 25);
        ctx.fillStyle = "#000000";
        ctx.fillText(label, x1, y1 + 18);
      });
    };
  }