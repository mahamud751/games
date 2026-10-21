# Nightshift — City Racing

An original 3D browser racing game inspired by night city arcade racers. Built with vanilla JavaScript and a locally bundled Three.js (MIT).

From the parent `games` directory, run:

```sh
python3 -m http.server 8088
```

Open http://localhost:8088/night-city-racing/ . A local HTTP server is required for JavaScript modules; do not open the HTML as a file.

- Street race: three laps against four AI rivals. Finish to earn garage credits.
- Time attack: one lap, with a personal best saved for each track.
- Free drive: unlimited circuit cruising.
- Two tracks, three unlockable cars, five free paint finishes, two chase cameras.
- WASD / arrows: drive; Shift: nitro; Space + steering: drift; C: camera; R: recover; Escape / P: pause.
- Touch controls are available on touch devices. Progress saves in this browser's local storage.

Graphics and car models are generated in code. No original game assets are used. This version is single-player and circuit-based; it does not reproduce the reference game's split-screen or open-world stunt modes. Google Fonts are optional; system font fallbacks work offline. WebGL is required.
