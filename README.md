# The Way

> *"I am the way and the truth and the life."* — John 14:6

A deeply biblical, open-source pixel art RPG that helps you walk alongside Jesus Christ. Inspired by EarthBound/Mother, Undertale, The Chosen, and Bible Project.

**Play it:** [kvadney-insomniac.github.io/the-way](https://kvadney-insomniac.github.io/the-way)

---

## What is this?

**The Way** is a browser-based pixel art RPG where you follow Jesus through the Gospels — not as a spectator, but as someone who was there.

Every encounter is a choice: LISTEN. SERVE. PRAY. PASS BY.

Every major story unlocks a **Scroll Room** — Bible Project-style cards revealing the OT roots, Hebrew/Greek word studies, and how this moment connects to the grand narrative arc from Genesis to Revelation.

Your choices are tracked through the **LOVE system** (Level of Virtue Expressed). The world remembers. The story deepens.

---

## Inspirations

| Work | What we borrowed |
|------|-----------------|
| **EarthBound / Mother series** | Mundane-meets-cosmic world design, every NPC has a soul, tonal depth |
| **Undertale (Toby Fox)** | ACT/MERCY system reframed as LISTEN/SERVE/PRAY, LOVE mechanic, fourth-wall moments |
| **The Chosen** | Emotionally resonant characters, theologically grounded dialogue |
| **Bible Project** | OT/NT connections, word studies, the grand narrative arc |
| **The Promised Land** | Biblical storytelling with warmth and humanity |

---

## Game Structure

**Season 1: "The Son of Man"** — 5 Acts through the Gospels

- **Act I — Galilee**: Andrew, Peter's call, Cana, the paralytic  
- **Act II — The Mountain**: Sermon on the Mount, feeding the 5,000  
- **Act III — Jerusalem**: Nicodemus, the woman caught in adultery, the Last Supper  
- **Act IV — The Passion**: Gethsemane, the trial, the cross  
- **Act V — Resurrection**: The empty tomb, Emmaus, restoration of Peter  

---

## Core Mechanics

### The Encounter System
When you approach someone in need, you can:
- **LISTEN** — hear their story
- **SERVE** — act on their need  
- **PRAY** — intercede for them
- **PASS BY** — continue on your way (always an option; the game never forces virtue)

### The LOVE System
Your choices build toward **L**evel **o**f **V**irtue **E**xpressed:
- Seeking → Following → Abiding → Bearing Fruit
- Higher LOVE unlocks richer Scroll Room content and deeper story paths
- At the Restoration of Peter scene in Act V, the game shows your actual record back to you

### The Scroll Room
After each major encounter, a Bible Project-style overlay reveals:
1. **The OT Root** — what Ezekiel, Isaiah, or Moses said that Jesus is fulfilling
2. **Word Study** — the Hebrew or Greek behind the key word (e.g., *anothen* in John 3)
3. **The Narrative Arc** — how this scene fits Genesis → Revelation *(unlocked at Following)*
4. **New Creation Echo** *(unlocked at Abiding)*
5. **Deep Dive** *(unlocked at Bearing Fruit)*

### Sacred Silence
The most holy moments in the game have **no music**. The game trains you to associate silence with the presence of God.

---

## Technology

| Tool | Purpose |
|------|---------|
| Phaser 3 + TypeScript | Game engine |
| Vite | Bundler + dev server |
| GitHub Actions | Auto-deploy to GitHub Pages |
| localStorage | Save data (no account needed) |

### Free Assets Used
- Sprites: Generated programmatically (Kenney.nl & OpenGameArt.org for future art)
- Music: OpenGameArt.org CC0 + AI-generated via Suno/Udio
- Fonts: Press Start 2P (OFL), Crimson Text (OFL)

---

## Running Locally

```bash
git clone https://github.com/kvadney-insomniac/the-way.git
cd the-way
npm install
npm run dev
# → localhost:5173/the-way/
```

## Contributing

This game is open source and we welcome contributors. See [GitHub Projects](https://github.com/kvadney-insomniac/the-way/projects) for the development board.

**Good first issues:** dialogue writing, pixel art, scroll room content (OT connections), and UI polish.

All dialogue content is reviewed for biblical accuracy. Major scripture decisions follow evangelical, Catholic, and Messianic Jewish perspectives (following The Chosen's consultation model).

---

## License

MIT — free to use, adapt, and share. If you build something with this, we'd love to know.

---

*"Early Christians were called 'followers of The Way' (Acts 9:2). This game is an invitation to walk it."*
