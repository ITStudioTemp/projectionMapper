// projectionMapper — the mapping engine.
// You do not need to change this file. Your art lives in art.js. This file pins it onto a real surface.

const GRID = 10;    // The surface is split into GRID x GRID cells so the image does not bend along the diagonal
const HANDLE = 16;  // Corner handle size, in pixels

let art;            // Offscreen buffer. Your sketch draws here, not on the main canvas
let corners;        // Four points: top-left, top-right, bottom-right, bottom-left
let dragging = -1;  // Index of the corner being dragged, or -1 for none
let moving = false; // true while you drag inside the surface to move all four corners together
let lastMouse;      // Where the mouse was at the last drag event, so each event moves the surface only its own distance
let editing = true; // true shows the handles; press E to hide them for the projector
let blackout = false; // true while B keeps the projector dark. Your art keeps running underneath

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  art = createGraphics(800, 600);
  corners = [
    createVector(width * 0.3, height * 0.3),
    createVector(width * 0.7, height * 0.3),
    createVector(width * 0.7, height * 0.7),
    createVector(width * 0.3, height * 0.7),
  ];
  if (typeof setupArt === 'function') setupArt(art); // setupArt() is optional. Your art file only needs drawArt()
}

function draw() {
  background(0);
  drawArt(art);
  if (blackout) return; // Dark: the art still drew this frame, so it does not jump when it comes back
  translate(-width / 2, -height / 2); // WEBGL puts (0, 0) in the center. Move it to the top-left like 2D mode
  drawWarped(art, corners);
  if (editing) drawHandles();
}

// Stretch img across the four corners, one row of small cells at a time.
function drawWarped(img, c) {
  noStroke();
  textureMode(NORMAL);
  texture(img);
  for (let row = 0; row < GRID; row++) {
    beginShape(TRIANGLE_STRIP);
    for (let col = 0; col <= GRID; col++) {
      const u = col / GRID;
      for (const v of [row / GRID, (row + 1) / GRID]) {
        const p = pointAt(c, u, v);
        vertex(p.x, p.y, 0, u, v);
      }
    }
    endShape();
  }
}

// Blend the four corners. u runs left to right, v runs top to bottom, both from 0 to 1.
function pointAt(c, u, v) {
  const top = p5.Vector.lerp(c[0], c[1], u);
  const bottom = p5.Vector.lerp(c[3], c[2], u);
  return p5.Vector.lerp(top, bottom, v);
}

function drawHandles() {
  push();
  translate(0, 0, 1); // Lift the handles just above the image so the image never hides them
  stroke(255, 0, 255);
  strokeWeight(2);
  noFill();
  beginShape();
  for (const p of corners) vertex(p.x, p.y);
  endShape(CLOSE);
  noStroke();
  fill(255, 0, 255);
  for (const p of corners) circle(p.x, p.y, HANDLE);
  pop();
}

function mousePressed() {
  if (!editing || blackout) return; // No moving corners you cannot see
  dragging = corners.findIndex((p) => dist(mouseX, mouseY, p.x, p.y) < HANDLE);
  moving = dragging < 0 && insideQuad(mouseX, mouseY, corners); // No corner hit? Then check for a click inside the surface
  lastMouse = createVector(mouseX, mouseY);
}

function mouseDragged() {
  if (dragging >= 0) corners[dragging].set(mouseX, mouseY);
  if (moving) {
    const step = createVector(mouseX, mouseY).sub(lastMouse); // How far the mouse moved since the last drag event
    for (const p of corners) p.add(step);
  }
  lastMouse = createVector(mouseX, mouseY);
}

function mouseReleased() {
  dragging = -1;
  moving = false;
}

// Is (x, y) inside the shape? Count how many edges a line from the point to the right crosses. Odd means inside.
function insideQuad(x, y, c) {
  let inside = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const crosses = c[i].y > y !== c[j].y > y;
    if (crosses && x < ((c[j].x - c[i].x) * (y - c[i].y)) / (c[j].y - c[i].y) + c[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

// Keep the surface in place when the window changes size, for example when you press F.
function windowResized() {
  const oldW = width;  // resizeCanvas() changes width and height, so save the old size first
  const oldH = height;
  resizeCanvas(windowWidth, windowHeight);
  for (const p of corners) p.set((p.x * width) / oldW, (p.y * height) / oldH); // Same share of the window as before
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    fullscreen(!fullscreen());
  }
  if (key === 'e' || key === 'E') {
    editing = !editing;
    updateCursor();
  }
  if (key === 'b' || key === 'B') {
    blackout = !blackout;
    dragging = -1; // Let go of any drag, so nothing moves in the dark
    moving = false;
    updateCursor();
  }
}

// Show the mouse pointer only while you edit the corners, and never during a blackout.
// Anything not black on the screen shows up as light on the wall, and that includes the pointer.
function updateCursor() {
  editing && !blackout ? cursor() : noCursor();
}
