# JS Lab

An interactive JavaScript learning and interview practice environment that connects language concepts to real application behavior.

Instead of only reading a definition, learners predict output, run a small example, change an implementation, inspect behavioral checks, and explain the result. The Chinese-first lessons include English terminology and interview answer references.

## Features

- **21 JavaScript topics:** scope, references, equality, destructuring, optional chaining, arrays, Map/Set, closures, callbacks, `this`, immutable updates, prototypes, errors, promises, async/await, the event loop, concurrency, debounce, modules, and debugging/testing.
- **Runnable exercises:** starter code, hints, reference solutions, output, and fixed behavior checks.
- **A browser execution sandbox:** code runs through an isolated iframe and Worker with time and output limits.
- **Active recall:** explain a concept before revealing the reference answer, then schedule a later review.
- **A 21-day study roadmap:** daily tasks and links to relevant lessons.
- **A search-race scenario lab:** adjust request delays and failures to see stale-response bugs and guarded updates side by side.
- **Local progress and backups:** drafts, notes, self-assessments, task completion, and JSON backup/restore with a preview before replacement.

The roadmap currently includes one complete scenario lesson on search-request races. Other days provide learning tasks and links to the JavaScript lessons; they are not presented as 21 fully implemented scenario labs.

## Quick start

Use a modern browser and Python 3 to serve the static files:

```sh
python3 -m http.server 4175 --bind 127.0.0.1 --directory dist
```

Open:

- **http://127.0.0.1:4175/training.html** for daily training and the study roadmap.
- **http://127.0.0.1:4175/index.html** for the JavaScript practice room.

On macOS, double-click `Start.command` to start the local service and open the training page. Keep the terminal window open and press `Ctrl+C` to stop it.

Serve the app over HTTP. Opening the HTML directly as a `file://` URL is not supported because it uses ES modules. No frontend build step or third-party npm installation is required.

## Learning workflow

1. Read the concept and its application context.
2. Predict the example's output before running it.
3. Try the exercise, inspect failures, and make a focused change.
4. Compare with a hint or reference solution when needed.
5. Explain the mechanism and a practical trade-off in your own words.
6. Return to scheduled review and inspect related concepts.

The interface distinguishes **self-reported understanding**, **task completion**, and **passing code checks**. Using a reference solution is tracked separately from an independent attempt. Written explanations are saved but are not automatically graded.

## Architecture

Built with HTML, CSS, and vanilla JavaScript ES modules. It does not require a backend application, account, database, or AI API.

| Area | Key files |
| --- | --- |
| Practice room | `dist/index.html`, `dist/app.js`, `dist/styles.css` |
| Lessons and checks | `dist/lessons.js`, `dist/core.js` |
| Code execution | `dist/sandbox.js` |
| Training interface | `dist/training.html`, `dist/training.js`, `dist/training.css` |
| Roadmap and training state | `dist/training-data.js`, `dist/training-core.js` |
| Search-race exercise | `dist/race-lesson.js` |
| Local launcher | `Start.command`, `start_preview.py` |
| Automated checks | `tests/app.test.mjs`, `tests/training.test.mjs` |

## Run tests

With a recent Node.js installation:

```sh
npm test
```

Tests cover lesson examples, reference solutions, incomplete starter implementations, review scheduling, backup compatibility, roadmap data, and search-race behavior.

## Execution boundaries

Exercises run as strict-mode asynchronous functions, with support for `await`. They do not provide DOM access, network access, npm packages, or top-level `import`/`export`. The editor is a text area rather than a complete IDE.

A fresh Worker runs inside an iframe without same-origin privileges. Content Security Policy limits network access, execution is time-limited, and displayed output is capped. This is a practice environment, not a general-purpose hostile-code execution service or an anti-cheating exam platform.

Fixed checks verify specified behaviors, not every possible implementation. Passing them is useful feedback, but does not independently prove production readiness.

## Data and privacy

Progress stays in the current browser's `localStorage` under `js-practice-room.v1`. Different browsers, hosts, and ports have separate records. Use the backup/restore interface before clearing browser data or moving to another environment.

The request-race scenario uses local timers rather than live searches. There is no live AI assessment, speech recording, or automatic cloud synchronization.

## Project notes

A personal education project developed with AI assistance. Explanations connect public JavaScript documentation to practical frontend scenarios. Lessons include links to MDN references. This is not an employer's internal interview question bank, and neither automated checks nor assistant-generated examples represent a learner's professional work history.
