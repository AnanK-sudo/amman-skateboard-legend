# Anan's Skateboarding Game — Design Spec

## Overview

A personalized 3D skateboarding game running in the web browser. The player controls a character modeled after Anan, skating through an open world with multiple zones — including two recreated from real locations in Amman, Jordan. Street art / graffiti visual style. Free skate with optional challenges and unlockable cosmetics.

## Platform & Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Rendering | Three.js | 3D scene, camera, custom shaders |
| Physics | cannon-es | Skateboard dynamics, collisions, grind snapping |
| Map Data | OpenStreetMap | Real street layouts for Amman zones |
| Character | GLTF model | Skeletal animation for tricks |
| Shaders | Custom post-processing | Graffiti outlines, spray-paint particle effects |
| UI/HUD | HTML/CSS overlay | Layered on top of Three.js canvas |
| State | localStorage | Saves, unlocks, high scores, challenge progress |
| Build | Vite | Fast dev server, optimized production builds |
| Deploy | Vercel | Static site, CDN, zero cost |
| Audio | Deferred | Will be added in a later phase |

**Architecture:** 100% client-side. No backend, no database, no accounts. Open a link, play instantly. Progress saved to localStorage with export/import for backup.

## Visual Style

**Street Art / Graffiti** — bold outlines, spray-paint textures, urban grit. Hand-drawn feel with neon accents. Dark backgrounds with vibrant color pops (orange, pink, purple, green). Custom Three.js shaders for:
- Outline/cel-shading on character and objects
- Spray-paint particle effects on trick landings
- Graffiti textures on walls and ramps
- Neon glow on grindable surfaces

## Camera & Perspective

Third-person camera behind the skater. Mouse controls camera look, camera follows the skater with smooth interpolation. Camera pulls back slightly at high speed and during big air for cinematic feel.

## Controls

### Movement
| Key | Action |
|-----|--------|
| W | Push forward / accelerate |
| S | Brake / slow down |
| A / D | Turn left / right |
| Mouse | Camera look |

### Tricks
| Input | Action |
|-------|--------|
| Space | Ollie (hold for higher) |
| Space + J | Kickflip |
| Space + K | Heelflip |
| Space + J + A/D | 360 flip / tre flip |
| F (near rail) | 50-50 grind |
| F + W | Nosegrind |
| F + S | Tailslide |
| F + A/D | Boardslide |
| Space (on ramp) | Launch air |
| L (in air) | Grab trick |
| A/D (in air) | Spin (180/360/540) |
| Shift | Manual (balance mini-game) |

## Trick & Combo System

### Trick Categories
- **Flip tricks:** Kickflip, heelflip, 360 flip, tre flip
- **Grinds:** 50-50, nosegrind, tailslide, boardslide
- **Vert/Air:** Grabs, spins (180/360/540), launched from ramps
- **Manuals:** Balance mini-game (left/right input to keep a wobbling balance meter centered), bridges tricks into combos

### Combo Mechanics
- Each trick in a combo chain adds +1x to the multiplier
- Manual and grinds bridge between tricks to keep the combo alive
- Bail (bad landing) = lose the entire combo score
- No repeated tricks in the same combo — rewards variety
- Longer grinds and higher air = more base points

### Scoring Example
```
Kickflip (200) → 50-50 Grind (500) → Heelflip Out (300) → Manual (100)
Base: 1,100 × 4 multiplier = 4,400 points
```

## Game World

### Zone Structure
5 zones connected in an open world. Players skate freely between unlocked zones.

#### Zone 1: Skate Park (Starting Zone)
- Halfpipe and bowl
- Quarter pipes
- Fun box and rails
- Pyramid
- **Purpose:** Learn the basics, get comfortable with controls and tricks

#### Zone 2: Street Spot
- Stair sets (3-stair, 5-stair, 8-stair)
- Handrails and ledges
- Benches and gaps
- Loading docks
- **Purpose:** Technical lines, street skating feel
- **Unlock:** Complete 3 challenges in Skate Park

#### Zone 3: Rooftop Plaza
- Elevated platforms
- Big gaps between rooftops
- Planters and AC units as obstacles
- Skyline views
- **Purpose:** High risk, high reward lines
- **Unlock:** Hit a 10,000-point combo in Street Spot

#### Zone 4: Old Amman (Lweibdeh / 7 Hills / Jabal Amman)
- Real street layout from OpenStreetMap data
- Steep hills, tight alleys, stone stairs
- Rainbow Street area vibes
- Graffiti walls (authentic to the real location)
- 7 Hills skate park as the centerpiece
- **Purpose:** Personal zone — real Amman brought to life
- **Unlock:** Complete all Rooftop Plaza challenges

#### Zone 5: Bayader (Yaser Mall area)
- Real street layout from OpenStreetMap data
- Wide parking lots and plazas
- Modern curbs, ledges, smooth ground
- Mall gaps and loading docks
- **Purpose:** Open, flowy street skating — Californian vibe in Amman
- **Unlock:** Complete all Old Amman challenges

### OpenStreetMap Integration
- Export real building footprints, roads, and elevation for Amman zones
- Convert OSM geometry to Three.js meshes for accurate street layouts
- Hand-place skatable objects (rails, stairs, ledges, gaps) based on Anan's photos of real spots
- Apply graffiti textures and street art style to the real-world geometry

## Progression & Unlockables

### Zone Progression
```
Skate Park → Street Spot → Rooftop Plaza → Old Amman → Bayader
(free)       (3 challenges)  (10k combo)    (all rooftop)  (all old amman)
```

### Challenges
Each zone has a set of challenges. Examples:
- "Grind the full rail"
- "360 flip the 5-stair"
- "Hit 3 spots in 30 seconds"
- "Land a 15,000 combo"
- "Manual from point A to point B"

### Unlockable Cosmetics (No Gameplay Advantage)
- **Boards:** Different deck designs with unique graffiti art
- **Outfits:** Shirts, pants, shoes, hats — Anan's personal style
- **Wheels & Trucks:** Color combos, mix and match

## HUD Design

Minimal chrome — most of the screen is pure skating.

| Position | Element | Details |
|----------|---------|---------|
| Top-left | Score | Big Impact font, orange text shadow |
| Top-right | Zone name | Current zone indicator |
| Center | Trick flash | Graffiti-style text, slightly rotated, fades fast |
| Right | Combo stack | Chain of tricks with multiplier, vanishes on bail |
| Bottom-left | Speed bar | Gradient bar (green → orange) |
| Bottom-right | Challenge | Active challenge progress |

All HUD text uses the graffiti/street art aesthetic — Impact font, slight rotations, spray-paint shadows.

## Menus

- **Main Menu:** Game title with graffiti art, Play / Customize / Challenges / Settings
- **Pause Menu:** Resume, Trick List, Challenges, Customize, Settings, Quit
- **Customization Screen:** 3D preview of skater, rotate model, swap boards/outfits/wheels, shows locked items and unlock requirements
- **Trick List:** Full list of available tricks with input combos

## Personalization

This is Anan's game:
- Character modeled to resemble Anan (appearance, clothing style)
- Anan's name in the game branding and UI
- Real Amman skate spots recreated from photos
- Personal board designs and outfit choices
- Music to be added later (Anan's own tracks + curated selection)

## Scope for V1 (Shareable Prototype)

**In scope:**
- Working third-person skateboard controls with physics
- Full trick set with combo system and scoring
- 3 zones: Skate Park, Street Spot, and Old Amman
- Zone unlock progression (V1 path: Skate Park → Street Spot → Old Amman)
- At least 5 challenges per zone
- Cosmetic unlockables (3+ boards, 3+ outfits)
- HUD with score, combo, trick flash, speed, challenge tracker
- Pause menu and customization screen
- Character with Anan's likeness (stylized)
- Deployed on Vercel

**Deferred to later phases:**
- Rooftop Plaza zone
- Bayader zone
- Audio / music
- Additional cosmetics
- Leaderboards
- Mobile touch controls
- Performance optimization for lower-end devices

## Asset Requirements

### From Anan (needed before/during build)
- Reference photos for character likeness (face, typical outfit, hair)
- Photos of the Amman skate park and surrounding area (7 Hills, Lweibdeh streets)
- Board designs or preferences for deck art
- Specific challenges or tricks to feature

### Generated During Build
- GLTF character model with skeletal rig
- Trick animations (procedural + keyframed)
- Zone geometry (procedural + OSM data)
- Graffiti textures and shader effects
- UI assets (fonts, icons, menu backgrounds)
