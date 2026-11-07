// A still calibration pattern for checking a mapped surface.

function drawArt(g) {
  g.push();
  g.background(0); // Black stays dark on the object.

  // Draw a white line every 50 pixels in each direction.
  g.stroke(255);
  g.strokeWeight(1);
  for (let x = 50; x < g.width; x += 50) g.line(x, 0, x, g.height);
  for (let y = 50; y < g.height; y += 50) g.line(0, y, g.width, y);

  // The circle and cross share the exact center of the image.
  const cx = g.width / 2;
  const cy = g.height / 2;
  g.noFill();
  g.strokeWeight(2);
  g.circle(cx, cy, Math.min(g.width, g.height) / 2);
  g.line(cx - 20, cy, cx + 20, cy);
  g.line(cx, cy - 20, cx, cy + 20);

  // Keep a thick border visible at each edge.
  const border = 6;
  g.strokeWeight(border);
  g.rect(border / 2, border / 2, g.width - border, g.height - border);

  // Different colors show which corner is which, even after warping.
  const size = Math.min(24, g.width / 5, g.height / 5);
  const inset = 8;
  g.noStroke();
  g.fill(255, 0, 0);
  g.rect(inset, inset, size, size); // Top left: red
  g.fill(0, 255, 0);
  g.rect(g.width - inset - size, inset, size, size); // Top right: green
  g.fill(0, 0, 255);
  g.rect(g.width - inset - size, g.height - inset - size, size, size); // Bottom right: blue
  g.fill(255, 255, 0);
  g.rect(inset, g.height - inset - size, size, size); // Bottom left: yellow
  g.pop();
}
