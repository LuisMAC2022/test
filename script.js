const canvas = document.getElementById('arenero');
const context = canvas.getContext('2d');

function resizeCanvasToScreen() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  context.fillStyle = 'red';
  context.fillRect(0, 0, canvas.width/2, canvas.height);
}

resizeCanvasToScreen();



window.addEventListener('resize', resizeCanvasToScreen);
resizeCanvasToScreen();
