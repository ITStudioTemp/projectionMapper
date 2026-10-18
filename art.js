// YOUR ART. This is the only file you need to change.
//
// drawArt(g) runs about 60 times a second. Each run draws one frame of your art.
// Draw into g, not onto the screen: write g.circle(...), not circle(...).
// Your drawing area is g.width wide (800) and g.height tall (600).
// Everything you draw here gets stretched onto the surface you set up with the pink corners.
//
// Want a starting point? Open a file in examples/. Copy the whole file, and paste it over all of
// this one. Some examples need more than drawArt(), so copy every line.
//
// DRAW YOUR OWN: a cheat sheet
// (0, 0) is the TOP-LEFT corner. x grows to the right. y grows DOWN. (800, 600) is bottom-right.
// Lines lower in drawArt() paint on top of lines above them.
//
//   g.background(0);              // Fill the frame. 0 is black, and black means no light
//   g.fill(255, 80, 200);         // Color for the next shapes: red, green, blue, each 0 to 255
//   g.circle(400, 300, 200);      // x, y of the center, then size
//   g.rect(100, 100, 150, 80);    // x, y of the top-left corner, then width, height
//   g.stroke(255, 80, 200);       // Lines use stroke color, not fill. Default is black: invisible on black
//   g.strokeWeight(6);            // Line thickness, in pixels
//   g.line(0, 0, 800, 600);       // From x, y to x, y
//
// More shapes: g.ellipse(x, y, w, h)   g.triangle(x1, y1, x2, y2, x3, y3)   g.square(x, y, size)
// Outlines: g.noFill(); g.stroke(255); g.strokeWeight(8);
// Full list: https://p5js.org/reference/

function drawArt(g) {
  g.background(20); // Clear the frame. Try removing this line and see what happens

  g.noStroke();
  for (let i = 0; i < 8; i++) {
    // frameCount goes up by 1 every frame, so the colors shift over time
    g.fill((frameCount * 2 + i * 32) % 255, 90, 200);
    g.circle(g.width / 2, g.height / 2, g.width - i * 90);
  }
}

// Things to try:
// - Change 8 to 20. Change 90 to 40.
// - Change g.circle to g.square.
// - Replace frameCount * 2 with frameCount * 10.
