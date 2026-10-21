# Corner Pocket

A standalone 8-ball pool game with a full-screen, dark club-style interface. The table automatically fits the available screen and rotates on portrait phones. Open `index.html` in a browser, or serve this folder with `python3 -m http.server 8088`.

- Computer opponent with three difficulty levels
- Two players sharing one device
- Ball collisions, cushions, pockets, solids/stripes, fouls, ball in hand, and 8-ball wins
- Aim guide, shot power, three felt colors, optional synthesized sound
- Mouse, touch, keyboard, and pull-back shooting controls
- Browser fullscreen mode and a settings drawer that pauses the game
- High-resolution canvas rendering and cached cloth texture

Move or touch the table to aim, then pull backward and release to shoot. You can also set the power slider and press **Shoot**. Use the fullscreen icon in the top bar to enter fullscreen. Arrow keys adjust aim; Shift makes smaller adjustments; Space shoots. After a foul, click an empty position to place the cue ball.

Uses simplified house rules, available in the game. Multiplayer is local; online matchmaking is not implemented. No build step or dependencies. Google Fonts are optional; system fonts work offline.
