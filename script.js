const canvas = document.getElementById('arenero');
const context = canvas.getContext('2d');

function resizeCanvasToScreen() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  context.fillStyle = 'teal';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStupidCat() {


}

window.addEventListener('resize', resizeCanvasToScreen);
resizeCanvasToScreen();
