Original prompt: Redesign the existing `/hamster_game/` main page to look much closer to the attached concept art while preserving Firebase, login, spins, tasks, rewards, seed logic, vanilla JS/CSS, `.hg-` scoping, and editing only inside `/hamster_game/`.

Notes:
- Work is being done in the actual GitHub checkout at `KyrgyzOrganics/hamster_game`.
- Goal for this pass: make the Game tab feel like one cohesive warm bakery mini-game interface, with the slot machine as the visual focus.
- Implemented compact reward strip, darker bakery poster background, tighter hero/wallet hierarchy, larger wooden slot treatment, reel bulbs, richer spin/result/nav styling, and hidden-menu pointer fix.
- Verified with `node --check`, Playwright idle/spin/account smoke tests, and a 390x844 mobile portrait screenshot.
- Added a display-only slot win ladder and bakery-themed quest labels/cards while preserving task keys, spin rewards, and reward calculation logic.
- Adjusted the hero mascot to be much larger and anchored at the center bottom of the top panel per the latest screenshot request.
- Current pass: moved winning lines into a modal, added a daily prize calendar modal, limited reel symbols to four bread/cookie images, compacted seed cards, improved hero sign/mascot positioning, and disabled QR/receipt purchase tasks until real store validation exists.
- Admin payout management pass: added fallback payout records, ICF payout CRUD intents, admin modal add/edit/remove/toggle UI, Firestore payout rules path, and public game payout loading with fallback.
- Settings/analytics pass: added customizable daily login bonuses through Games settings, admin game analytics, public game settings loading with fallback, lever asset preload, and transparent-image upload fix by preserving canvas alpha.
- Loading-screen fix pass: normalized ICF `resultHelpers` imports from `Engine` to `engine` after hosted browser logs showed `/ICF/Engine/resultHelpers.js` 404ing on case-sensitive hosting.
- Verification: `node --check hamster_game/app.js`; Playwright loaded `http://127.0.0.1:19782/hamster_game/`, confirmed loading screen exits, no failed requests/4xx responses, and a spin completes with updated seed state.
