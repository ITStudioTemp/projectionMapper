# Contributing to projectionMapper

Thank you for wanting to help. This guide adds the steps that are special to projectionMapper. For
everything else, the
[PhilaCon Valley contributing guide](https://github.com/philaconvalley/.github/blob/main/CONTRIBUTING.md)
applies.

Everyone who takes part follows the
[Code of Conduct](https://github.com/philaconvalley/community-handbook/blob/main/CODE_OF_CONDUCT.md).

## The most welcome change: a new art example

Made something at a PATCH Lab, or at home? Add it to `examples/` so the next person can start from it.

1. Fork this repo, then make a branch.
2. Make a new file, `examples/your-idea.js`. Copy the shape of `examples/stripes.js`.
3. Start the file with a one-line comment that says what the art does.
4. Draw into `g`, not the main canvas: `g.circle(...)`, not `circle(...)`.
5. Test it. In `index.html`, change `art.js` to your file's path. Open the page and drag the corners.
6. Change `index.html` back to `art.js`.
7. Add a row for your file to the `examples/` table in `README.md`.
8. Open a pull request. Add a screenshot or a short screen recording.

**An example file must:**

- Work with no Wi-Fi. Do not load fonts, images, or libraries from the internet.
- Stay in one file, with no new dependencies.
- Use only `drawArt(g)`, plus `setupArt(g)` if it needs to.
- Have comments that a beginner can follow.

## Other changes

**Bug fix:** open an issue first, unless the fix is small. Say which browser and which computer you
use.

**Change to `sketch.js`:** open an issue first. `sketch.js` is the mapping engine. Every PATCH Lab
attendee's copy depends on it, so we plan changes to it before anyone writes code.

**What we will not merge here:**

- A change that needs a build step, `npm`, or an internet connection to run.
- A different version of p5.js in `lib/`, unless an issue agreed on it first.
- Large images or video. Keep the repo small enough to download at an event.

## Test before you open a pull request

There are no automatic tests. Check these by hand:

1. Open `index.html` in Chrome. The art moves.
2. Drag each pink corner. The art follows.
3. Drag inside the shape. The whole shape moves.
4. Press **E**. The corners hide and show again.
5. Press **F**. The page goes full screen.
6. Open the console with **Cmd+Option+J** (Mac) or **Ctrl+Shift+J** (Windows). It shows no red text.
