// Clockface geometry — pure, shared by the renderer (components/VectorField.jsx draws the dial)
// and the course content (courses/physics2.js builds its answer key from it). Keeping one
// definition means a key tip can never disagree with the dial the student is looking at.
//
// Numeral n sits at 90° − 30n measured CCW from +x, so 12 is straight up and 3 is to the right.
// Fractional n is meaningful and useful: n = 3.5 is the 3:30 mark, halfway between 3 and 4.
export const clockAngleDeg = n => 90 - 30 * n;

// The point on a circle of radius r at numeral n, rounded to 3dp so the course file and the
// stored student value compare cleanly.
export const clockPoint = (n, r) => {
  const a = (clockAngleDeg(n) * Math.PI) / 180;
  return [Math.round(r * Math.cos(a) * 1000) / 1000, Math.round(r * Math.sin(a) * 1000) / 1000];
};
