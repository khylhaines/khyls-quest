import { PINS } from "./pins.js";

/* =========================================================
   BARROW QUEST QA ENGINE
   FULL MERGED MASTER FILE
   - exact pin override priority
   - qaGroup support for location-accurate history
   - zone fun pools kept separate from landmark history
   - anti-repeat support
   - stable question ids
   - start intro support
   - merged old fun pools back in
   - mindfulness mode added
   - master quiz bank support
========================================================= */

function normaliseTier(tier = "kid") {
  return ["kid", "teen", "adult"].includes(tier) ? tier : "kid";
}

function seededIndex(length, salt = 0) {
  if (!length) return 0;
  const n = Math.abs(Number(salt) || 0);
  return n % length;
}

function pickOne(arr, salt = 0) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[seededIndex(arr.length, salt)];
}

function shuffleSeeded(arr, salt = 0) {
  const out = [...arr];
  let seed = Math.abs(Number(salt) || Date.now());

  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of arr || []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function combinePools(...pools) {
  return uniqBy(pools.flat().filter(Boolean), (item) => {
    if (typeof item === "string") return `str:${item}`;
    if (item?.id) return `id:${item.id}`;
    if (item?.q && Array.isArray(item?.options)) {
      return `mcq:${
        typeof item.q === "string" ? item.q : JSON.stringify(item.q)
      }`;
    }
    if (item?.q && item?.a) {
      return `riddle:${
        typeof item.q === "string" ? item.q : JSON.stringify(item.q)
      }|${item.a}`;
    }
    return JSON.stringify(item);
  });
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function getTieredText(value, tier = "kid") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return value[tier] || value.kid || Object.values(value)[0] || "";
  }
  return "";
}

function makeQuestionId(prefix, entry) {
  if (entry?.id) return String(entry.id);
  if (typeof entry === "string") return `${prefix}_${slugify(entry)}`;
  if (entry?.q && Array.isArray(entry?.options)) {
    const qText =
      typeof entry.q === "string" ? entry.q : getTieredText(entry.q, "kid");
    return `${prefix}_${slugify(qText)}`;
  }
  if (entry?.q && entry?.a) {
    const qText =
      typeof entry.q === "string" ? entry.q : getTieredText(entry.q, "kid");
    return `${prefix}_${slugify(qText)}_${slugify(entry.a)}`;
  }
  return `${prefix}_item`;
}

function attachIds(pool, prefix) {
  return (pool || []).map((item, idx) => {
    if (typeof item === "string") {
      return {
        _type: "prompt",
        id: makeQuestionId(`${prefix}_${idx}`, item),
        value: item,
      };
    }

    return {
      ...item,
      id: makeQuestionId(`${prefix}_${idx}`, item),
    };
  });
}

function makePromptTask(prompt, mode = "activity", id = "prompt_task") {
  return {
    id,
    q: prompt,
    options: ["DONE", "NOT YET", "SKIP", "UNSAFE"],
    answer: 0,
    fact: "",
    meta: { promptOnly: true, mode },
  };
}

function makeFallbackTask(message, meta = {}) {
  return {
    id: `fallback_${slugify(message) || "task"}`,
    q: message,
    options: ["DONE", "NOT YET", "SKIP", "UNSAFE"],
    answer: 0,
    fact: "",
    meta: { fallback: true, ...meta },
  };
}

function mq(id, difficulty, tags, q, options, answer, fact) {
  return {
    id: `mq_${id}`,
    difficulty,
    tags,
    q,
    options,
    answer,
    fact,
  };
}

/* =========================================================
   SHARED RIDDLE / FUN CONTENT
========================================================= */

export const RIDDLE_POOL = [
  {
    q: {
      kid: "What has keys all over it, but still can’t open locks?",
      teen: "What has loads of keys but is useless at opening locks?",
      adult: "What has many keys, but none of them can open a lock?",
    },
    a: "A piano",
  },
  {
    q: {
      kid: "What has hands but never gives you a high five?",
      teen: "What has hands but can’t clap, wave, or fight?",
      adult: "What has hands, but can’t clap, hold, or touch?",
    },
    a: "A clock",
  },
  {
    q: {
      kid: "What gets wetter every time it helps dry something?",
      teen: "What’s meant to dry things… but ends up wetter instead?",
      adult: "What is used for drying, yet becomes wetter with use?",
    },
    a: "A towel",
  },
  {
    q: {
      kid: "What do you go up and down on, but it stays in the same place?",
      teen: "What do people go up and down on all day, but it never moves?",
      adult: "What is used for movement up and down, but never moves itself?",
    },
    a: "Stairs",
  },
  {
    q: {
      kid: "What has one eye, but can’t see at all?",
      teen: "What has one eye but is completely blind?",
      adult: "What has an eye, yet lacks all ability to see?",
    },
    a: "A needle",
  },
  {
    q: {
      kid: "What has a neck but no head?",
      teen: "What has a neck, but no head at all?",
      adult: "What has a neck, yet no head?",
    },
    a: "A bottle",
  },
  {
    q: {
      kid: "What can run, but doesn’t have legs?",
      teen: "What runs but has no legs at all?",
      adult: "What runs, but has no physical form to walk?",
    },
    a: "Water",
  },
  {
    q: {
      kid: "What has lots of teeth but doesn’t bite?",
      teen: "What has loads of teeth but is harmless?",
      adult: "What has numerous teeth, but no ability to bite?",
    },
    a: "A comb",
  },
  {
    q: {
      kid: "What can you catch, but never throw?",
      teen: "What can you catch, but you definitely can’t throw back?",
      adult: "What can be caught, yet cannot be thrown?",
    },
    a: "A cold",
  },
  {
    q: {
      kid: "The more you take, the more you leave behind. What am I?",
      teen: "The more you take, the more you leave behind — what is it?",
      adult: "The more you take, the more you leave behind. What are they?",
    },
    a: "Footsteps",
  },
  {
    q: {
      kid: "What comes down, but never goes back up?",
      teen: "What falls down, but never rises back up?",
      adult: "What comes down, yet never returns upward?",
    },
    a: "Rain",
  },
  {
    q: {
      kid: "What has lots of cities, but no houses?",
      teen: "What has cities all over it, but no actual houses?",
      adult: "What contains cities, yet no houses?",
    },
    a: "A map",
  },
  {
    q: {
      kid: "What can fill a whole room, but doesn’t take up any space?",
      teen: "What can fill a room completely, but takes up no space at all?",
      adult: "What can fill an entire room, yet occupies no space?",
    },
    a: "Light",
  },
  {
    q: {
      kid: "What goes up every year, but never comes back down?",
      teen: "What keeps going up, but never drops back down?",
      adult: "What increases steadily, yet never decreases?",
    },
    a: "Your age",
  },
  {
    q: {
      kid: "What is full of holes, but still holds water?",
      teen: "What’s covered in holes, but still manages to hold water?",
      adult: "What is full of holes, yet still retains water?",
    },
    a: "A sponge",
  },
  {
    q: {
      kid: "What is always coming, but never actually gets here?",
      teen: "What’s always on the way, but never really arrives?",
      adult: "What is always approaching, yet never truly arrives?",
    },
    a: "Tomorrow",
  },
  {
    q: {
      kid: "What can’t be used until it’s broken?",
      teen: "What only becomes useful after you break it?",
      adult: "What cannot be used until it has been broken?",
    },
    a: "An egg",
  },
  {
    q: {
      kid: "What disappears as soon as you say its name?",
      teen: "What vanishes the moment you say it out loud?",
      adult: "What disappears the instant its name is spoken?",
    },
    a: "Silence",
  },
  {
    q: {
      kid: "What has a ring, but no finger?",
      teen: "What has a ring, but never goes on your hand?",
      adult: "What has a ring, yet no finger?",
    },
    a: "A phone",
  },
  {
    q: {
      kid: "What has branches, but no leaves?",
      teen: "What has branches, but none of them grow leaves?",
      adult: "What has branches, yet no leaves?",
    },
    a: "A bank",
  },
];

export const SPEED_POOL = {
  kid: [
    "Point to the nearest tree, sign, or bench.",
    "Can you stand on one foot without wobbling?",
    "Look around… now tell me what you saw!",
    "Pull your silliest face!",
    "Close your eyes — what can you hear?",
    "Give this place a fun name.",
    "Wait… GO! Clap as fast as you can!",
    "Show me where you would go to leave this area.",
    "Find something that might not be safe here.",
    "Pick: coins, clue, or bonus!",
    "Be a statue… don’t move!",
    "Bounce 3 times like a spring!",
    "10-Second Scan: Point to the nearest tree, bin, or sign.",
    "Statue Freeze: Freeze like a statue for 7 seconds.",
    "Colour Hunt: Find something red fast.",
    "Shape Spot: Find a circle quickly.",
    "Animal Ears: Make an animal pose for 5 seconds.",
    "Quiet Ninja: Walk 10 silent steps.",
    "Superhero Landing: Do a safe superhero landing pose.",
    "Count It: Count 5 steps forward, 5 back.",
    "Quick Smile: Do your best explorer face.",
    "Rock Paper Speed: Rock-paper-scissors best of 1.",
    "Shadow Spot: Find your shadow fast.",
    "Hop Count: Hop 3 times safely.",
    "Tall Small: Stretch tall, then crouch small.",
    "Wind Check: Feel the wind and point where it’s coming from.",
    "Quick Draw Air: Draw a star in the air.",
    "Fast Balance: Balance on one foot for 5 seconds.",
    "Find a Number: Spot any number quickly.",
    "Mirror Move: Copy the other person’s move.",
    "Traffic Light: Freeze, walk, slow.",
    "Quick Team Pose: Make a team pose in 5 seconds.",
  ],
  teen: [
    "Quickly point out 3 things around you.",
    "Hold a one-foot balance — no wobbling allowed.",
    "Scan, turn, recall — name 3 things.",
    "Give your best dramatic face.",
    "Pause and listen — what stands out most?",
    "Invent a quick slogan for this spot.",
    "Wait for it… GO! React instantly.",
    "Point to the fastest way out of here.",
    "What’s one thing here that could be risky?",
    "Choose fast: coins, clue, or power-up.",
    "Go completely still — statue mode.",
    "3 fast jumps — no delay.",
    "Main Character Walk: 10 steps like you’re in a trailer.",
    "Photo Angle Switch: Low-angle pose then high-angle pose.",
    "Sound ID: Name the loudest sound you hear.",
    "One-Line Trailer: Finish 'In a world where…'",
    "Stealth Meter: 10 stealth steps.",
    "Speed Slogan: Invent a slogan for this place.",
    "Boss Intro: Say a boss name for this area.",
    "NPC Quote: Say a clean NPC quote.",
    "Zone Buff Pick: Choose a buff instantly.",
    "Fast Footwork: 6 quick side-steps.",
    "Find the Vibe: This place feels…",
    "Clue Spot: Find something that looks like a clue.",
    "Speed Memory: Look, turn away, name 3 things.",
    "Walk Like: Pirate, robot, or ninja.",
    "Fast Choice: Safe shortcut or scenic route.",
    "Character Swap: Swap who’s leader instantly.",
    "Landmark Judge: Rate this landmark 1–10.",
    "Quick Roleplay: Guard, Scout, or Wizard.",
    "Fast Team Plan: Next objective in 3 words.",
    "Boss Weakness: Pick a weakness fast.",
  ],
  adult: [
    "Identify 3 nearby features within 10 seconds.",
    "Hold a stable one-foot balance position.",
    "Perform a quick scan, then recall 3 details accurately.",
    "Display a bold or exaggerated expression.",
    "Pause briefly and identify the most noticeable sound.",
    "Create a concise description of this location.",
    "Delay, then react immediately on cue.",
    "Indicate the most efficient exit route.",
    "Identify one potential risk in the environment.",
    "Make a quick choice: reward, clue, or advantage.",
    "Enter full stillness — no movement.",
    "Execute 3 rapid jumps without pause.",
    "30-Second Observation: Name 3 details you’d miss if you rushed.",
    "History Snap: Guess the oldest-looking thing nearby and why.",
    "Micro-Route: Choose next waypoint based on safety or fun.",
    "One-Word Theme: Industry, Faith, Nature, or Memory.",
    "Fast Risk Check: Name 1 hazard and 1 safe alternative.",
    "Story Hook: Finish 'A monk hid…'",
    "Logic Switch: Is a shortcut always best?",
    "3-Point Scan: Exits, hazards, meeting point.",
    "Quick Time Guess: Guess the time without checking your phone.",
    "Treasure Math: If each node is 120 points, how many for 5?",
    "Fast Prioritise: Photo, clue, or rest.",
    "Atmosphere Read: Peaceful, tense, busy, eerie.",
    "Design Eye: What would make this place more questy?",
    "Ethical Choice: Respect or explore first?",
    "Historical Guess: What job might someone here have had in 1850?",
    "Boss Lore: Create a boss name and 1-line lore.",
    "Fast Constraint: Plan next 2 pins with a no-roads rule.",
    "Micro-Meditation: 10 seconds calm breathing.",
    "Detective Eye: What could hide a code here?",
    "Reward Logic: Coins, clue, map fragment, or key?",
  ],
};

export const BATTLE_POOL = {
  kid: [
    "Race: First to point at something green wins.",
    "Balance Duel: Who can stand on one foot longest?",
    "Speed Point: First to point at the tallest thing wins.",
    "Rock-paper-scissors battle.",
    "Echo Battle: First to repeat the location name wins.",
    "Shadow Duel: First to step on someone’s shadow wins.",
    "Animal Sound Battle: Funniest animal noise wins.",
    "Treasure Grab: First to touch something metal wins.",
    "Quick Count: First to count 5 steps wins.",
    "Pose Duel: Best superhero pose wins.",
    "Statue Battle: Last person to move wins.",
    "Hop Race: First to do 3 hops wins.",
    "Shape Race: First to find a circle wins.",
    "Smile Battle: Biggest smile wins.",
    "Victory Cheer: Loudest cheer wins.",
  ],
  teen: [
    "Reaction Duel: Leader claps, first to clap back wins.",
    "Speed Debate: Best 3-word slogan wins.",
    "Balance Battle: Last standing on one foot wins.",
    "Stealth Walk: Quietest 10 steps wins.",
    "Speed Riddle: First answer wins.",
    "Point Race: First to spot something historic wins.",
    "Rock-paper-scissors best of 3.",
    "Sound Spot: First to name the loudest sound wins.",
    "Memory Flash: Name 3 things after a quick look.",
    "Mini Story: Best 1-line story wins.",
    "Explorer Command: Fastest to obey the command wins.",
    "Soundtrack Duel: Best soundtrack idea wins.",
    "Explorer Pose Duel.",
    "Quick Compliment Duel.",
    "Victory Pose Duel.",
  ],
  adult: [
    "Observation Duel: First to name 3 details wins.",
    "Logic Duel: First correct answer wins.",
    "Memory Duel: First to recall 4 objects wins.",
    "Strategy Duel: Best plan in one sentence wins.",
    "History Guess Duel.",
    "Navigation Duel: Point safest direction.",
    "Fast Risk Spot: Identify hazard fastest.",
    "Treasure Logic Duel.",
    "Perspective Duel: Best insight wins.",
    "Design Idea Duel.",
    "Story Duel: Best quick story wins.",
    "Location Theme Duel.",
    "Route Planning Duel.",
    "Historical Role Guess Duel.",
    "Time Guess Duel.",
  ],
};

export const FAMILY_POOL = {
  kid: [
    "Everyone do the same silly walk together — no one can laugh!",
    "Surprise hug! Everyone in at once!",
    "Tap everyone’s shoulder — GO!",
    "Link up fast — don’t let the chain break!",
    "Act like a chicken for 5 seconds — LOUDLY!",
    "Say the weirdest word you can think of!",
    "Be a robot, pirate, or wizard — GO!",
    "Walk like a superhero… but WAY too dramatic!",
    "Team Wave: Everyone do a big explorer wave together.",
    "Animal Parade: Each person do a different animal pose.",
    "Colour Hunt Team: Together find something blue.",
    "Explorer Echo: One says mission, the others say accepted.",
    "Funny Walk Race: Do 5 silly steps together.",
    "Freeze Squad: Everyone freeze like statues.",
    "Treasure Point: All point at the most interesting thing nearby.",
    "Team Smile: Biggest smiles for 3 seconds.",
    "Shadow Team: Stand together and look for your shadows.",
    "Superhero Group Pose: Make a family hero pose.",
    "Quiet Mission: Walk 5 silent steps together.",
    "Mini March: March in place like explorers.",
    "Nature Team: Together find something green.",
    "Fast Count: Count to 10 together.",
    "Robot Team: Walk like robots for 5 seconds.",
    "Treasure Guard Circle: Guard invisible treasure.",
    "One-Word Family Vibe: Each person says one word.",
    "Team Hop: Hop 3 times together.",
    "Explorer Hands: High-five or thumbs-up all round.",
    "Victory Cheer: Make a family cheer together.",
  ],
  teen: [
    "Move as a group doing the same ridiculous walk — stay in sync.",
    "Instant group hug — no warning, just go.",
    "Quick shoulder tap across the group — move fast.",
    "Link quickly — maintain full connection under pressure.",
    "Full animal mode — no holding back.",
    "Invent a nonsense phrase and shout it.",
    "Pick a role instantly — act it out.",
    "Over-the-top hero walk — no shame allowed.",
    "Team Trailer Walk: 10 steps like your squad is in a game intro.",
    "Role Select: Pick roles fast — Scout, Tank, Healer, Guide.",
    "Group Poster Pose: Make a dramatic team pose.",
    "One-Line Team Motto: Invent a squad motto fast.",
    "Fast Debate: Best family power-up here?",
    "Vibe Call: Calm, weird, epic, or busy?",
    "Stealth Family: 8 quiet steps together.",
    "Emoji Match Team: Pick 2 emojis that fit this place.",
    "Boss Warning: Invent a warning for this area.",
    "Fast Memory Team: Name 3 things together.",
    "Squad Formation: Stand in a triangle or line.",
    "Quick Story: Make a 2-sentence story together.",
    "Photo Pose Practice: Do a clean team pose.",
    "Zone Call: Civic, Nature, Docks, or Ruins?",
    "Hero Landing Team: Safe dramatic landing pose.",
    "Fast Team Safety: Point to the best meeting spot.",
    "Mini Challenge Plan: Say the next objective in 3 words.",
    "Boss Name Team: Invent a boss name for this place.",
    "Adventure Voice: Say quest complete dramatically.",
    "Group Win Pose: Final team victory pose.",
  ],
  adult: [
    "Perform a synchronised exaggerated walk together — maintain coordination.",
    "Immediate group embrace — brief and natural.",
    "Light shoulder tap across the group — quick connection.",
    "Rapid link formation — maintain cohesion.",
    "Perform a loud, exaggerated animal impression.",
    "Create and project a ridiculous phrase.",
    "Assume a character — commit briefly.",
    "Perform an exaggerated heroic walk — fully commit.",
    "Family Check-In: Each person says one word for how they feel.",
    "Micro-Reflection: Name one thing you noticed because you slowed down.",
    "History Guess Team: Guess what happened here long ago.",
    "Safety Scan: Identify a meeting point nearby.",
    "Shared Focus: Spend 5 seconds noticing details silently.",
    "Route Decision: Pick the next route based on fun or safety.",
    "Family Briefing: Explain the next objective in 10 words.",
    "Quick Gratitude: Each person name one good thing about today.",
    "Memory Spark: Say what this place reminds you of.",
    "Observation Team: Name 3 details most people would miss.",
    "Mini Story Build: Each person adds one sentence.",
    "Energy Check: Decide if the group needs rest, pace, or fun.",
    "Quiet Minute Lite: 10 seconds calm breathing together.",
    "Treasure Logic: If this place held a clue, where would it be hidden?",
    "Quick Design Eye: What would make this place more magical for kids?",
    "Historic Imagination: What job might someone here have done?",
    "Atmosphere Read: Peaceful, busy, eerie, or proud?",
    "Group Focus Reset: 3 slow breaths, then continue.",
    "Reflective Prompt: What part of today has been best so far?",
    "Respect Check: How do we explore this place respectfully?",
  ],
};

export const ACTIVITY_POOL = {
  kid: [
    "You’re the captain now — steer your ship!",
    "Stand tall and give your best salute!",
    "Find the brightest thing you can see!",
    "Celebrate like you just beat a boss!",
    "GO! First to touch a tree, bench, or sign wins!",
    "One leads — everyone copy them!",
    "Do the silliest walk you can!",
    "Shout a funny word!",
    "Everyone together — don’t break the chain!",
    "GO! Do 3 things in a row as fast as you can!",
    "GO! First to touch something metal wins!",
    "Who can clap 3 times the fastest?",
    "GO! Follow the leader — don’t get left behind!",
    "HOME BASE: Create a secret team handshake.",
    "MORRISONS: Spot something red in 10 seconds.",
    "SALTHOUSE MILLS: March like a factory boss.",
    "CENOTAPH: Give a respectful salute.",
    "BANDSTAND: March up the steps like a hero.",
    "PARK RAILWAY: Pretend you're the conductor.",
    "BOATING LAKE: Count 3 ducks or birds.",
    "BRIDGEGATE: Point which way you’d explore.",
    "FRYERS LANE: Spot something old.",
    "FLASHLIGHT BEND: Walk quietly for 10 steps.",
    "RED RIVER WALK: Count 5 steps slowly.",
    "FURNESS ABBEY: Pretend you're a medieval guard.",
    "DOCK MUSEUM: Pretend to steer a ship.",
    "TOWN HALL CLOCK: Count down from 5.",
    "CUSTOM HOUSE: Pretend to check passports.",
    "THE FORUM: Pretend you're on stage.",
    "LIBRARY: Whisper a fun fact.",
    "HENRY SCHNEIDER: Stand strong like a statue.",
    "JAMES RAMSDEN: Give a short mayor speech.",
    "OLD FIRE STATION: Pretend to spray a hose.",
    "MARKET HALL: Spot something colourful.",
    "DUKE OF EDINBURGH: Name your favourite drink.",
    "EMLYN HUGHES: Do a mini goal celebration.",
    "GRAVING DOCK: Pretend to hammer metal.",
    "SLAG BANK: Climb safely and look around.",
  ],
  teen: [
    "You’re in control — act like you’re steering something big.",
    "Give a clean, sharp salute.",
    "What stands out the most here?",
    "Hit a victory pose like you just won.",
    "GO — first to reach a tree, bench, or sign wins.",
    "Pick a leader — everyone mirrors them.",
    "Do the most ridiculous walk you can think of.",
    "Say something random or weird out loud.",
    "Stay linked — no one breaks formation.",
    "GO — complete 3 actions back-to-back, fast.",
    "GO — first to find and touch something metal wins.",
    "First to clap 3 times wins.",
    "GO — stay with the leader, no gaps.",
    "Do a 10-second main character walk.",
    "Take a poster pose angle.",
    "Make up a 1-line slogan for this spot.",
    "Do a stealth-walk 10 steps.",
    "Pick the most industrial sound you can hear.",
    "Film a 3-second aesthetic clip.",
    "Give one plant a superhero name.",
    "Do a calm-breath reset.",
    "Find wind direction and do a storm survivor pose.",
    "Invent a fake legend about this place.",
    "Pick a doorway and pose like you’re entering a boss arena.",
    "Point toward town and do a scout report.",
    "Choose the best viewpoint and rate it.",
    "Do a silent NPC idle animation.",
    "Pick a street name and remix it into a rap line.",
  ],
  adult: [
    "Simulate controlling a vehicle or vessel.",
    "Perform a respectful gesture.",
    "Identify the most visually prominent feature.",
    "Celebrate like you’ve just won.",
    "On signal, reach a nearby object — tree, bench, or sign.",
    "One person leads, others mirror the movement.",
    "Perform a deliberately exaggerated or comedic walk.",
    "Say something unusual out loud.",
    "Maintain group formation while moving.",
    "On signal, execute 3 rapid actions in sequence.",
    "On signal, reach and touch a metal object.",
    "Complete 3 claps — fastest wins.",
    "On signal, follow the leader without losing pace.",
    "Create an elite squad name right now.",
    "Find the weirdest product label.",
    "Strike a dramatic industrial pose.",
    "10 seconds silence, then say one word.",
    "Deliver a 5-second hype speech.",
    "Narrate this place like a vlog intro.",
    "Invent a dramatic backstory for a boat.",
    "Choose the most chaotic direction and defend it.",
    "Give an abandoned object a story.",
    "Do a dramatic slow turn like you're being followed.",
    "Rate the vibe 1 to 10 and justify it.",
    "Imagine this place 800 years ago. What changes?",
    "Name a metal band after this location.",
    "If you could rewind 1 hour, would you?",
    "Movie trailer voice: In a town where…",
    "Pick a random word and create a conspiracy theory.",
    "Hero or villain origin story?",
    "Give a 10-second political speech.",
    "Invent a ridiculous emergency.",
    "If this was a battle arena, what's the boss?",
  ],
};

export const MINDFULNESS_POOL = {
  kid: [
    "Take 3 slow breaths and notice one sound.",
    "Look around and find one thing that feels calm.",
    "Stand still for 5 seconds and feel your feet on the ground.",
    "Name one colour you can see and one sound you can hear.",
    "Take a quiet moment and notice the wind, air, or warmth.",
    "Put one hand on your chest and take 3 calm breaths.",
    "Find the calmest-looking thing nearby.",
    "Close your eyes for 3 seconds, then open them and notice one detail.",
    "Say one word for how you feel right now.",
    "Take 5 slow steps like a peaceful explorer.",
  ],
  teen: [
    "Take 3 steady breaths and notice what changes.",
    "Name one thing you can hear, one thing you can see, and one thing you can feel.",
    "Stand still for 10 seconds and let the place settle around you.",
    "Pick one detail here that most people would rush past.",
    "Ask yourself: am I tense, calm, distracted, or focused?",
    "Spend 10 seconds breathing before your next choice.",
    "What gives this place its quietest energy?",
    "Relax your shoulders and take one slow breath in and out.",
    "Choose one word that matches your mood right now.",
    "Notice whether this place makes you feel open, grounded, or alert.",
  ],
  adult: [
    "Pause for 10 seconds and notice the full soundscape.",
    "Take 3 slow breaths and allow your pace to reset.",
    "What is the most grounding detail in this location right now?",
    "Notice one thought, then let it pass without chasing it.",
    "Where in your body are you holding tension right now?",
    "Take a quiet scan: breath, posture, sound, space.",
    "Choose one word for the emotional atmosphere here.",
    "Ask yourself what changes when you stop rushing.",
    "Notice one thing you can control and one thing you cannot.",
    "Take 5 slow steps with full attention.",
    "Micro-meditation: breathe in for 4, out for 4, three times.",
    "What detail only appears when you deliberately slow down?",
  ],
};

/* =========================================================
   START INTROS
========================================================= */

export const PIN_START_INTROS = {
  home_base_marsh_st: {
    kid: "Home Base reached. This is where your Barrow Quest begins.",
    teen: "Home Base reached. This is your reset point before the map opens into bigger stories.",
    adult:
      "Home Base reached. This is your point of origin — where every route and decision begins.",
  },

  cenotaph_core: {
    kid: "The Cenotaph reached. This is a place to remember brave people and show respect.",
    teen: "The Cenotaph reached. This landmark is about memory, sacrifice, and respect.",
    adult:
      "The Cenotaph reached. You are entering a space of civic remembrance and collective memory.",
  },

  park_bandstand_core: {
    kid: "Park Bandstand reached. This is a fun place linked to music and performances.",
    teen: "Park Bandstand reached. This is a performance space and part of the park’s public life.",
    adult:
      "Park Bandstand reached. This pin marks a civic leisure structure built for gathering and performance.",
  },

  furness_abbey_core: {
    kid: "Furness Abbey reached. These old ruins are full of mystery and history.",
    teen: "Furness Abbey reached. This is one of the deepest history pins on the map.",
    adult:
      "Furness Abbey reached. You are entering one of the most historically charged sites in the region.",
  },

  town_hall_clock: {
    kid: "Town Hall Clock reached. This is one of the most important places in town.",
    teen: "Town Hall Clock reached. This landmark is part of the town’s civic heartbeat.",
    adult:
      "Town Hall Clock reached. You are standing at a civic time-marker and public symbol.",
  },

  dock_museum_anchor: {
    kid: "Dock Museum Anchor reached. This area is all about ships and Barrow’s dock history.",
    teen: "Dock Museum Anchor reached. This pin marks one of the strongest maritime identities on the map.",
    adult:
      "Dock Museum Anchor reached. You are stepping into Barrow’s maritime-industrial narrative.",
  },

  dock_museum_submarine: {
    kid: "Dock Museum Submarine reached. This is where Barrow’s ship story becomes huge.",
    teen: "Dock Museum Submarine reached. This landmark connects the town’s past and present through engineering.",
    adult:
      "Dock Museum Submarine reached. This is one of the clearest expressions of Barrow’s strategic-industrial identity.",
  },

  henry_schneider_statue: {
    kid: "Statue of Henry Schneider reached. This place remembers an important figure in Barrow’s history.",
    teen: "Statue of Henry Schneider reached. This is a landmark tied to people who helped Barrow grow.",
    adult:
      "Statue of Henry Schneider reached. This monument represents industrial change and public memory.",
  },

  james_ramsden_statue: {
    kid: "Statue of James Ramsden reached. This pin remembers one of the men linked to Barrow’s growth.",
    teen: "Statue of James Ramsden reached. This is one of the town’s memory-markers.",
    adult:
      "Statue of James Ramsden reached. This monument reflects leadership, ambition, and public memory.",
  },

  barrow_library: {
    kid: "Barrow Library reached. This is a place full of stories and facts.",
    teen: "Barrow Library reached. This pin is about knowledge, memory, and local culture.",
    adult:
      "Barrow Library reached. You are entering a civic archive of learning and memory.",
  },

  custom_house: {
    kid: "The Custom House reached. This building connects to trade and town history.",
    teen: "The Custom House reached. This pin is tied to movement, administration, and exchange.",
    adult:
      "The Custom House reached. This is a threshold building where trade and civic regulation meet.",
  },

  emlyn_hughes_statue: {
    kid: "Emlyn Hughes Statue reached. This pin celebrates a famous footballer from Barrow.",
    teen: "Emlyn Hughes Statue reached. This landmark shows how towns remember local people with wider fame.",
    adult:
      "Emlyn Hughes Statue reached. This monument reflects public memory through sport and civic pride.",
  },

  salthouse_mills: {
    kid: "Salthouse Mills reached. This is part of Barrow’s strong working history.",
    teen: "Salthouse Mills reached. This pin takes you into the industrial side of the map.",
    adult:
      "Salthouse Mills reached. This is an industrial memory-site shaped by labour and production.",
  },

  submarine_memorial: {
    kid: "Submarine Memorial reached. This place remembers people and work connected to the sea.",
    teen: "Submarine Memorial reached. This pin links memory with the town’s modern defence identity.",
    adult:
      "Submarine Memorial reached. This site binds remembrance to Barrow’s submarine legacy.",
  },

  walney_bridge_entrance: {
    kid: "Walney Bridge Entrance reached. This is the crossing point between Barrow and Walney.",
    teen: "Walney Bridge Entrance reached. This pin is about crossing, transition, and identity.",
    adult:
      "Walney Bridge Entrance reached. You are at a threshold structure where geography and identity meet.",
  },

  earnse_bay: {
    kid: "Earnse Bay reached. This is a big coastal place with sea air and wide views.",
    teen: "Earnse Bay reached. This pin opens the map outward into coast and horizon.",
    adult:
      "Earnse Bay reached. This is a landscape pin where weather, coast, and scale dominate.",
  },

  piel_castle: {
    kid: "Piel Castle reached. This island castle once helped protect the coast.",
    teen: "Piel Castle reached. This landmark feels separate for a reason — defence and the sea matter here.",
    adult:
      "Piel Castle reached. You are entering a defensive coastal site where isolation and strategy converge.",
  },

  roose_station_platform: {
    kid: "Roose Station Platform reached. Trains helped connect people and places.",
    teen: "Roose Station Platform reached. This pin is about movement and route networks.",
    adult:
      "Roose Station Platform reached. This site reflects transport infrastructure and everyday movement.",
  },
};

/* =========================================================
   QA GROUP CONTENT
========================================================= */

export const QA_BY_GROUP = {
  town_history: {
    quiz: {
      kid: [
        {
          q: "What kind of place was Barrow before heavy industry?",
          options: [
            "A village",
            "A capital city",
            "A giant castle",
            "A theme park",
          ],
          answer: 0,
          fact: "Barrow began as a much smaller settlement before industrial growth.",
        },
        {
          q: "What helped Barrow grow quickly in the 1800s?",
          options: [
            "Iron and industry",
            "Banana farms",
            "Volcanoes",
            "Theme parks",
          ],
          answer: 0,
          fact: "Iron, docks, and industry helped Barrow grow fast.",
        },
      ],
      teen: [
        {
          q: "What best explains Barrow’s rapid growth?",
          options: [
            "Industry, iron, and shipbuilding",
            "Only farming",
            "Royal palaces",
            "Tourism alone",
          ],
          answer: 0,
          fact: "Barrow expanded rapidly through industry and shipbuilding.",
        },
        {
          q: "What kind of history do many central Barrow landmarks share?",
          options: [
            "Civic and industrial history",
            "Jungle history",
            "Desert history",
            "Volcanic history",
          ],
          answer: 0,
          fact: "Much of central Barrow reflects civic growth and industrial identity.",
        },
      ],
      adult: [
        {
          q: "How should central Barrow’s historic character be described?",
          options: [
            "Civic, industrial, and urban",
            "Purely rural",
            "Ancient royal",
            "Only recreational",
          ],
          answer: 0,
          fact: "Central Barrow reflects civic life, industry, and urban development.",
        },
        {
          q: "What ties many town-centre landmarks together?",
          options: [
            "Public life, memory, and growth",
            "Deep sea fishing only",
            "Airport logistics",
            "Monastic seclusion",
          ],
          answer: 0,
          fact: "Town-centre landmarks often express public life, memory, and growth.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Do town buildings help tell local history?",
          options: ["Yes", "No", "Only castles do", "Only beaches do"],
          answer: 0,
          fact: "Town buildings often help show how a place grew and changed.",
        },
      ],
      teen: [
        {
          q: "Why are town landmarks useful in local history?",
          options: [
            "They show how public life changed",
            "They replace maps",
            "They hide tunnels only",
            "They grow crops",
          ],
          answer: 0,
          fact: "Town landmarks help show how civic and daily life developed.",
        },
      ],
      adult: [
        {
          q: "What do civic landmarks often preserve?",
          options: [
            "Public memory and identity",
            "Only private wealth",
            "Only transport schedules",
            "Only military secrets",
          ],
          answer: 0,
          fact: "Civic landmarks often preserve public memory and identity.",
        },
      ],
    },
  },

  industry_history: {
    quiz: {
      kid: [
        {
          q: "What kind of work helped Barrow become famous?",
          options: [
            "Industry and shipbuilding",
            "Chocolate making",
            "Only farming",
            "Wizard school",
          ],
          answer: 0,
          fact: "Barrow became famous through industry and shipbuilding.",
        },
      ],
      teen: [
        {
          q: "What made Barrow important in industrial Britain?",
          options: [
            "Shipbuilding and heavy industry",
            "Only beaches",
            "Only theatre",
            "Only farming",
          ],
          answer: 0,
          fact: "Barrow became important through shipbuilding and heavy industry.",
        },
      ],
      adult: [
        {
          q: "What does an industrial landmark in Barrow usually point back to?",
          options: [
            "Labour, production, and growth",
            "Monastic prayer only",
            "Holiday tourism only",
            "Royal ceremony only",
          ],
          answer: 0,
          fact: "Industrial landmarks in Barrow often point to labour, production, and growth.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Did factories and mills change Barrow?",
          options: ["Yes", "No", "Only a little", "Not at all"],
          answer: 0,
          fact: "Factories, mills, and industry changed Barrow in major ways.",
        },
      ],
      teen: [
        {
          q: "Why do industrial sites matter historically?",
          options: [
            "They show how work shaped the town",
            "They are only decorative",
            "They replaced all roads",
            "They built castles",
          ],
          answer: 0,
          fact: "Industrial sites show how labour and production shaped the town.",
        },
      ],
      adult: [
        {
          q: "What is the historic value of industrial sites?",
          options: [
            "They preserve the story of labour and transformation",
            "They exist only for scenery",
            "They replaced civic life",
            "They were built mainly for tourism",
          ],
          answer: 0,
          fact: "Industrial sites preserve the story of labour and material transformation.",
        },
      ],
    },
  },

  statues_memorial: {
    quiz: {
      kid: [
        {
          q: "Why do towns have statues and memorials?",
          options: [
            "To remember people and events",
            "To hide treasure",
            "To launch rockets",
            "To grow food",
          ],
          answer: 0,
          fact: "Statues and memorials help towns remember people and events.",
        },
      ],
      teen: [
        {
          q: "What is the main purpose of a memorial or statue?",
          options: [
            "Public remembrance",
            "Road control",
            "Ticket sales",
            "Boat repair",
          ],
          answer: 0,
          fact: "Memorials and statues exist to support public remembrance.",
        },
      ],
      adult: [
        {
          q: "What do memorials and statues reveal about a town?",
          options: [
            "Who and what it chooses to remember",
            "Its crop yields",
            "Its underground caves",
            "Its weather patterns only",
          ],
          answer: 0,
          fact: "Memorials reveal who and what a town chooses to remember publicly.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Can statues help tell the story of a town?",
          options: ["Yes", "No", "Only maps can", "Only shops can"],
          answer: 0,
          fact: "Statues can help tell the story of a town and its people.",
        },
      ],
      teen: [
        {
          q: "Why are statues part of local history?",
          options: [
            "They preserve memory in public space",
            "They replace schools",
            "They run transport",
            "They build factories",
          ],
          answer: 0,
          fact: "Statues preserve memory in public space.",
        },
      ],
      adult: [
        {
          q: "What does a public statue most clearly do?",
          options: [
            "Turn memory into a visible civic object",
            "Direct road traffic",
            "Store official documents",
            "Control harbour trade",
          ],
          answer: 0,
          fact: "A public statue turns memory into a visible civic object.",
        },
      ],
    },
  },

  park_history: {
    quiz: {
      kid: [
        {
          q: "What kind of place is Barrow Park?",
          options: ["A park", "A harbour", "A factory", "An airport"],
          answer: 0,
          fact: "Barrow Park is one of the town’s important green spaces.",
        },
        {
          q: "What can people do in a park?",
          options: [
            "Play and relax",
            "Launch submarines",
            "Mine iron",
            "Build factories",
          ],
          answer: 0,
          fact: "Parks are made for play, walking, and shared public time.",
        },
      ],
      teen: [
        {
          q: "What makes the park good for quests?",
          options: [
            "Open space and landmarks",
            "Cargo cranes",
            "Runways",
            "Only shops",
          ],
          answer: 0,
          fact: "The park works well for quests because of its routes and landmarks.",
        },
        {
          q: "Why do parks matter in towns?",
          options: [
            "They create shared public space",
            "They replace ports",
            "They power factories",
            "They store cargo",
          ],
          answer: 0,
          fact: "Parks create shared public space in towns.",
        },
      ],
      adult: [
        {
          q: "What public role does a park often serve?",
          options: [
            "Leisure, memory, and social space",
            "Heavy freight movement",
            "Border control",
            "Industrial storage",
          ],
          answer: 0,
          fact: "Parks often serve leisure, memory, and social space.",
        },
        {
          q: "What best describes a strong park landmark?",
          options: [
            "A civic leisure feature",
            "A port loading tool",
            "A private military structure",
            "A freight yard device",
          ],
          answer: 0,
          fact: "Park landmarks are often civic leisure features within public space.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Can a park be an important part of town life?",
          options: ["Yes", "No", "Only roads matter", "Only factories matter"],
          answer: 0,
          fact: "Parks are important because they are shared spaces for the public.",
        },
      ],
      teen: [
        {
          q: "Why is a park part of local history?",
          options: [
            "It shows how towns value public leisure",
            "It replaces schools",
            "It acts like a factory",
            "It controls the sea",
          ],
          answer: 0,
          fact: "Parks show how towns create space for public leisure and gathering.",
        },
      ],
      adult: [
        {
          q: "How should a historic park be understood?",
          options: [
            "As designed public space",
            "As industrial overflow",
            "As transport-only land",
            "As unused leftover ground",
          ],
          answer: 0,
          fact: "A historic park should be understood as designed public space.",
        },
      ],
    },
  },

  park_cenotaph: {
    quiz: {
      kid: [
        {
          q: "What does the cenotaph honour?",
          options: [
            "Those lost in war",
            "Football winners",
            "Shop owners",
            "Bus drivers only",
          ],
          answer: 0,
          fact: "The cenotaph honours those lost in war.",
        },
      ],
      teen: [
        {
          q: "Why should a cenotaph be treated respectfully?",
          options: [
            "It is a memorial space",
            "It is a race track",
            "It is a market lane",
            "It is a skate zone",
          ],
          answer: 0,
          fact: "A cenotaph is a memorial space for remembrance.",
        },
      ],
      adult: [
        {
          q: "What civic purpose does a cenotaph serve?",
          options: [
            "Collective remembrance",
            "Retail promotion",
            "Cargo storage",
            "Traffic control",
          ],
          answer: 0,
          fact: "A cenotaph serves collective remembrance.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Is the cenotaph a place to remember people?",
          options: [
            "Yes",
            "No",
            "It is just decoration",
            "It is only for games",
          ],
          answer: 0,
          fact: "The cenotaph is a place for remembrance.",
        },
      ],
      teen: [
        {
          q: "What does the cenotaph show about the town?",
          options: [
            "That remembrance matters",
            "That only shopping matters",
            "That parks do not matter",
            "That roads are more important than memory",
          ],
          answer: 0,
          fact: "The cenotaph shows that remembrance matters in public life.",
        },
      ],
      adult: [
        {
          q: "Why is the cenotaph historically important?",
          options: [
            "It anchors public memory",
            "It stores old machinery",
            "It marks a rail junction",
            "It replaced a church",
          ],
          answer: 0,
          fact: "The cenotaph is historically important because it anchors public memory.",
        },
      ],
    },
  },

  abbey_history: {
    quiz: {
      kid: [
        {
          q: "Who lived at Furness Abbey long ago?",
          options: ["Monks", "Pirates", "Astronauts", "Robots"],
          answer: 0,
          fact: "Monks lived and worshipped at Furness Abbey.",
        },
        {
          q: "How old is Furness Abbey?",
          options: [
            "20 years",
            "100 years",
            "Over 800 years",
            "Built last week",
          ],
          answer: 2,
          fact: "Furness Abbey was founded in 1123.",
        },
      ],
      teen: [
        {
          q: "What kind of place was Furness Abbey?",
          options: [
            "A monastery",
            "A football ground",
            "A shopping centre",
            "A train station",
          ],
          answer: 0,
          fact: "Furness Abbey was a monastery.",
        },
        {
          q: "Which king closed many monasteries, including Furness Abbey?",
          options: ["Henry VIII", "King John", "Charles II", "Alfred"],
          answer: 0,
          fact: "Henry VIII dissolved monasteries across England.",
        },
      ],
      adult: [
        {
          q: "What was Furness Abbey’s main historic role?",
          options: [
            "Religious life and monastic power",
            "Modern retail",
            "Air travel",
            "Submarine launching",
          ],
          answer: 0,
          fact: "The abbey was a major religious and monastic site.",
        },
        {
          q: "What event ended Furness Abbey’s great power?",
          options: [
            "The Dissolution of the Monasteries",
            "A railway merger",
            "A coastal flood scheme",
            "A dock expansion",
          ],
          answer: 0,
          fact: "The Dissolution ended its monastic power.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Is Furness Abbey very old?",
          options: ["Yes", "No", "Only 20 years old", "Built last week"],
          answer: 0,
          fact: "Furness Abbey is hundreds of years old.",
        },
      ],
      teen: [
        {
          q: "What gives the abbey its strong atmosphere?",
          options: [
            "Ruins and history",
            "Airport lights",
            "Factory smoke",
            "Shopping signs",
          ],
          answer: 0,
          fact: "Its ruins and long history give it atmosphere.",
        },
      ],
      adult: [
        {
          q: "Why is Furness Abbey historically significant?",
          options: [
            "It reflects religious power and change",
            "It was a motorway junction",
            "It was a cinema complex",
            "It was a dock gate",
          ],
          answer: 0,
          fact: "Furness Abbey reflects major religious and political change.",
        },
      ],
    },
  },

  abbey_ghosts: {
    ghost: {
      kid: [
        "Stand still like you heard a ghost whisper.",
        "Do a brave monk pose.",
        "Point to where a ghost monk might appear.",
        "Whisper one word that fits the abbey.",
      ],
      teen: [
        "Name one thing here that makes the abbey feel eerie.",
        "Give this place a haunted-title in 3 words.",
        "Stand silent for 10 seconds and listen for echoes.",
        "What detail here would make the best ghost-story clue?",
      ],
      adult: [
        "Describe the abbey atmosphere in one word.",
        "What makes ruins especially effective for ghost stories?",
        "Does this place feel more haunted by memory, history, or imagination?",
        "What matters most here: stone, shadow, echo, or atmosphere?",
      ],
    },
  },

  docks_submarines: {
    quiz: {
      kid: [
        {
          q: "What is Barrow known for building today?",
          options: [
            "Submarines",
            "Chocolate castles",
            "Flying tractors",
            "Theme parks",
          ],
          answer: 0,
          fact: "Barrow is known for building submarines.",
        },
        {
          q: "Where can you learn about Barrow’s dock history?",
          options: ["Dock Museum", "Only the beach", "A farm", "A cinema"],
          answer: 0,
          fact: "The Dock Museum helps tell Barrow’s dock and ship story.",
        },
      ],
      teen: [
        {
          q: "Why are the docks important to Barrow?",
          options: [
            "They connect industry to trade",
            "They only grow food",
            "They replace roads",
            "They train actors",
          ],
          answer: 0,
          fact: "The docks supported shipbuilding, transport, and trade.",
        },
        {
          q: "Why is Barrow internationally known today?",
          options: [
            "Submarine building",
            "Volcano research",
            "Space launches",
            "Castle tourism",
          ],
          answer: 0,
          fact: "Barrow remains strongly associated with submarine construction.",
        },
      ],
      adult: [
        {
          q: "What gives Barrow continuing national importance?",
          options: [
            "Its defence and shipbuilding role",
            "Its medieval royal court",
            "Its airport network",
            "Its mountain agriculture",
          ],
          answer: 0,
          fact: "Barrow remains closely tied to defence manufacturing.",
        },
        {
          q: "Why are the docks historically significant in Barrow?",
          options: [
            "They enabled industrial output and connections",
            "They existed only for sport",
            "They replaced rail completely",
            "They were built only for tourism",
          ],
          answer: 0,
          fact: "The docks were critical to industrial transport and shipbuilding.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Did ships and docks help Barrow grow?",
          options: ["Yes", "No", "Only roads did", "Only farms did"],
          answer: 0,
          fact: "Ships and docks helped Barrow grow.",
        },
      ],
      teen: [
        {
          q: "What does the Dock Museum help preserve?",
          options: [
            "Barrow’s maritime and industrial story",
            "Only football history",
            "Only farming tools",
            "Only cinema posters",
          ],
          answer: 0,
          fact: "The Dock Museum preserves maritime and industrial history.",
        },
      ],
      adult: [
        {
          q: "What does the Dock Museum most strongly interpret?",
          options: [
            "Maritime industry, labour, and identity",
            "Luxury trade only",
            "Roman religion only",
            "Theatre culture only",
          ],
          answer: 0,
          fact: "The museum helps explain how shipbuilding shaped Barrow’s identity.",
        },
      ],
    },
  },

  islands_nature: {
    quiz: {
      kid: [
        {
          q: "What connects Walney Island to Barrow?",
          options: ["Bridge", "Volcano", "Castle wall", "Tunnel under London"],
          answer: 0,
          fact: "Walney Bridge connects Walney to Barrow.",
        },
        {
          q: "What can you often enjoy at coastal places like Earnse Bay?",
          options: [
            "Views and sea air",
            "Underground mines",
            "Skyscrapers",
            "Desert dunes",
          ],
          answer: 0,
          fact: "Coastal places are known for sea air, views, and changing weather.",
        },
      ],
      teen: [
        {
          q: "What is Walney known for as well as its size?",
          options: [
            "Wildlife and coastline",
            "Skyscrapers",
            "Coal mines",
            "Underground rail",
          ],
          answer: 0,
          fact: "Walney is known for wildlife, coastline, and birdlife.",
        },
        {
          q: "What kind of place is Piel Castle?",
          options: [
            "A coastal defensive castle",
            "A shopping arcade",
            "A train depot",
            "A factory",
          ],
          answer: 0,
          fact: "Piel Castle was built to help protect the coast.",
        },
      ],
      adult: [
        {
          q: "How should Walney be understood in relation to Barrow?",
          options: [
            "As part of the area’s wider coastal identity",
            "As an inland district",
            "As a market tunnel",
            "As a former abbey court",
          ],
          answer: 0,
          fact: "Walney adds an important coastal and ecological dimension to Barrow’s identity.",
        },
        {
          q: "What does Piel Castle symbolise in the wider landscape?",
          options: [
            "Coastal defence and strategic control",
            "Modern retail expansion",
            "Agricultural reform",
            "Airport planning",
          ],
          answer: 0,
          fact: "Piel Castle reflects the need to secure the coast and surrounding waters.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Is Walney an island?",
          options: ["Yes", "No", "Only sometimes", "Only in winter"],
          answer: 0,
          fact: "Walney is one of England’s largest islands.",
        },
      ],
      teen: [
        {
          q: "Why do island and coast pins feel different from town pins?",
          options: [
            "They are shaped by sea and landscape",
            "They are full of factories only",
            "They are indoor only",
            "They have no history",
          ],
          answer: 0,
          fact: "Coastal pins feel different because sea and landscape change the experience.",
        },
      ],
      adult: [
        {
          q: "What does a coastal landmark often add to a route?",
          options: [
            "Scale, exposure, and atmosphere",
            "Only traffic noise",
            "Only retail",
            "Only street lighting",
          ],
          answer: 0,
          fact: "Coastal landmarks often add scale, exposure, and atmosphere.",
        },
      ],
    },
  },
};

/* =========================================================
   EXACT PIN OVERRIDES
========================================================= */

export const QA_PIN_OVERRIDES = {
  home_base_marsh_st: {
    start: PIN_START_INTROS.home_base_marsh_st,
  },

  cenotaph_core: {
    start: PIN_START_INTROS.cenotaph_core,
    quiz: {
      kid: [
        {
          q: "What does the cenotaph remember?",
          options: [
            "War heroes",
            "Shopping days",
            "Markets",
            "Football matches",
          ],
          answer: 0,
          fact: "The cenotaph remembers people lost in war.",
        },
      ],
      teen: [
        {
          q: "Why should the cenotaph be treated with respect?",
          options: [
            "It is a memorial space",
            "It is a race track",
            "It is a market lane",
            "It is a game zone",
          ],
          answer: 0,
          fact: "The cenotaph is a memorial space for remembrance.",
        },
      ],
      adult: [
        {
          q: "What does the cenotaph most strongly represent?",
          options: [
            "Collective remembrance",
            "Retail activity",
            "Traffic management",
            "Tourist entertainment",
          ],
          answer: 0,
          fact: "The cenotaph represents collective remembrance.",
        },
      ],
    },
    history: {
      kid: [
        {
          q: "Is the cenotaph a place to remember people?",
          options: ["Yes", "No", "Only at night", "Only in summer"],
          answer: 0,
          fact: "The cenotaph is a place of remembrance.",
        },
      ],
      teen: [
        {
          q: "What does the cenotaph show about the town?",
          options: [
            "That remembrance matters",
            "That only roads matter",
            "That only sport matters",
            "That history is unimportant",
          ],
          answer: 0,
          fact: "The cenotaph shows that remembrance matters in public life.",
        },
      ],
      adult: [
        {
          q: "Why is the cenotaph historically important?",
          options: [
            "It anchors public memory",
            "It stores cargo",
            "It marks a shopping route",
            "It controls town traffic",
          ],
          answer: 0,
          fact: "The cenotaph is historically important because it anchors public memory.",
        },
      ],
    },
  },

  park_bandstand_core: {
    start: PIN_START_INTROS.park_bandstand_core,
    quiz: {
      kid: [
        {
          q: "What is a bandstand mainly used for?",
          options: [
            "Music and performances",
            "Fixing tractors",
            "Rocket launches",
            "Fishing boats",
          ],
          answer: 0,
          fact: "Bandstands are used for music and performances.",
        },
      ],
      teen: [
        {
          q: "What atmosphere fits a bandstand best?",
          options: [
            "Performance and celebration",
            "Heavy industry",
            "Freight loading",
            "Road repair",
          ],
          answer: 0,
          fact: "A bandstand is tied to performance and celebration.",
        },
      ],
      adult: [
        {
          q: "What public role does a bandstand often symbolise?",
          options: [
            "Shared entertainment and gathering",
            "Freight shipping",
            "Border defence",
            "Industrial storage",
          ],
          answer: 0,
          fact: "Bandstands often symbolise gathering and entertainment.",
        },
      ],
    },
  },

  furness_abbey_core: {
    start: PIN_START_INTROS.furness_abbey_core,
  },

  town_hall_clock: {
    start: PIN_START_INTROS.town_hall_clock,
    quiz: {
      kid: [
        {
          q: "What does a town hall clock help people do?",
          options: [
            "Know the time",
            "Bake bread",
            "Build ships",
            "Grow flowers",
          ],
          answer: 0,
          fact: "Clock landmarks helped towns run to a shared daily rhythm.",
        },
      ],
      teen: [
        {
          q: "Why are clock landmarks important in towns?",
          options: [
            "They help organise public life",
            "They replace libraries",
            "They launch trains",
            "They store cargo",
          ],
          answer: 0,
          fact: "Clock landmarks helped structure daily civic life.",
        },
      ],
      adult: [
        {
          q: "What does a civic clock most strongly represent?",
          options: [
            "Shared public rhythm",
            "Private wealth only",
            "Military secrecy",
            "Agricultural isolation",
          ],
          answer: 0,
          fact: "Civic clocks symbolise order, coordination, and shared urban time.",
        },
      ],
    },
  },

  barrow_library: {
    start: PIN_START_INTROS.barrow_library,
    quiz: {
      kid: [
        {
          q: "What do libraries help people do?",
          options: [
            "Learn and read",
            "Launch rockets",
            "Fix engines",
            "Catch fish",
          ],
          answer: 0,
          fact: "Libraries are places of learning, reading, and discovery.",
        },
      ],
      teen: [
        {
          q: "Why is a library important in a town?",
          options: [
            "It keeps knowledge available to everyone",
            "It replaces factories",
            "It controls traffic",
            "It stores submarines",
          ],
          answer: 0,
          fact: "Libraries are part of the public knowledge system of a town.",
        },
      ],
      adult: [
        {
          q: "What does a public library represent in civic life?",
          options: [
            "Shared access to knowledge",
            "Private military planning",
            "Trade regulation only",
            "Industrial extraction",
          ],
          answer: 0,
          fact: "A public library represents education, memory, and shared civic access to knowledge.",
        },
      ],
    },
  },

  james_ramsden_statue: {
    start: PIN_START_INTROS.james_ramsden_statue,
  },

  henry_schneider_statue: {
    start: PIN_START_INTROS.henry_schneider_statue,
  },

  custom_house: {
    start: PIN_START_INTROS.custom_house,
  },

  dock_museum_anchor: {
    start: PIN_START_INTROS.dock_museum_anchor,
  },

  dock_museum_submarine: {
    start: PIN_START_INTROS.dock_museum_submarine,
  },

  emlyn_hughes_statue: {
    start: PIN_START_INTROS.emlyn_hughes_statue,
  },

  salthouse_mills: {
    start: PIN_START_INTROS.salthouse_mills,
  },

  submarine_memorial: {
    start: PIN_START_INTROS.submarine_memorial,
  },

  walney_bridge_entrance: {
    start: PIN_START_INTROS.walney_bridge_entrance,
  },

  earnse_bay: {
    start: PIN_START_INTROS.earnse_bay,
  },

  piel_castle: {
    start: PIN_START_INTROS.piel_castle,
  },

  roose_station_platform: {
    start: PIN_START_INTROS.roose_station_platform,
  },

  abbey_boss: {
    boss: {
      kid: [
        {
          q: "Final Abbey Trial: Who lived here long ago?",
          options: ["Monks", "Aliens", "Pirates", "Cheese wizards"],
          answer: 0,
          fact: "Monks lived at Furness Abbey for centuries.",
        },
      ],
      teen: [
        {
          q: "FINAL BOSS: What event ended the abbey’s power?",
          options: [
            "The Dissolution of the Monasteries",
            "A volcano",
            "A railway crash",
            "A football riot",
          ],
          answer: 0,
          fact: "The Dissolution of the Monasteries ended its power.",
        },
      ],
      adult: [
        {
          q: "FINAL BOSS: What does Furness Abbey most strongly represent?",
          options: [
            "Religious power, memory, and political change",
            "Modern retail expansion",
            "Airport growth",
            "Weapons testing",
          ],
          answer: 0,
          fact: "It represents religious power, memory, and political change.",
        },
      ],
    },
  },

  park_boss_bandstand: {
    boss: {
      kid: [
        {
          q: "BOSS: Festival Revival! What is this place linked to?",
          options: [
            "Music and performance",
            "Mining",
            "Air travel",
            "Submarine docks",
          ],
          answer: 0,
          fact: "The bandstand is linked to music and public performance.",
        },
      ],
      teen: [
        {
          q: "BOSS: Festival Revival! What atmosphere fits this place best?",
          options: [
            "Performance and celebration",
            "Heavy industry",
            "Silent prayer only",
            "Airport security",
          ],
          answer: 0,
          fact: "This boss is tied to performance and celebration.",
        },
      ],
      adult: [
        {
          q: "BOSS: Festival Revival! What public role does a bandstand often symbolise?",
          options: [
            "Shared entertainment and gathering",
            "Freight shipping",
            "Border defence",
            "Agricultural storage",
          ],
          answer: 0,
          fact: "Bandstands often symbolise gathering and entertainment.",
        },
      ],
    },
  },

  park_boss_cenotaph: {
    boss: {
      kid: [
        {
          q: "BOSS: Memory Keeper! What does the cenotaph honour?",
          options: [
            "Those lost in war",
            "Football winners",
            "Train drivers",
            "Shop owners",
          ],
          answer: 0,
          fact: "The cenotaph honours those lost in war.",
        },
      ],
      teen: [
        {
          q: "BOSS: Memory Keeper! Why should this place be treated respectfully?",
          options: [
            "It is a memorial space",
            "It is a car park",
            "It is a skate zone",
            "It is a market lane",
          ],
          answer: 0,
          fact: "It is a memorial space for remembrance.",
        },
      ],
      adult: [
        {
          q: "BOSS: Memory Keeper! What civic purpose does a cenotaph serve?",
          options: [
            "Collective remembrance",
            "Retail promotion",
            "Cargo storage",
            "Ticket inspection",
          ],
          answer: 0,
          fact: "It serves collective remembrance.",
        },
      ],
    },
  },

  park_boss_skate: {
    boss: {
      kid: [
        {
          q: "BOSS: Park Champion! What matters most during a challenge?",
          options: [
            "Trying your best safely",
            "Cheating fast",
            "Giving up",
            "Ignoring everyone",
          ],
          answer: 0,
          fact: "The best win is doing your best safely.",
        },
      ],
      teen: [
        {
          q: "BOSS: Park Champion! What makes a strong challenger?",
          options: [
            "Confidence and control",
            "Chaos only",
            "Running away",
            "Breaking rules",
          ],
          answer: 0,
          fact: "A strong challenger shows confidence and control.",
        },
      ],
      adult: [
        {
          q: "BOSS: Park Champion! What does challenge mode reward most?",
          options: [
            "Skill, movement, and effort",
            "Noise only",
            "Stillness only",
            "Luck alone",
          ],
          answer: 0,
          fact: "Challenge mode rewards effort and skill.",
        },
      ],
    },
  },

  park_boss_mudman: {
    boss: {
      kid: [
        {
          q: "BOSS: Mudman Mystery! What best fits a mystery boss?",
          options: [
            "Clues and careful thinking",
            "Only shouting",
            "Only running",
            "Only sleeping",
          ],
          answer: 0,
          fact: "Mystery bosses are about clues and thinking.",
        },
      ],
      teen: [
        {
          q: "BOSS: Mudman Mystery! What wins a mystery challenge?",
          options: [
            "Observation and logic",
            "Random guessing only",
            "Ignoring clues",
            "Walking away",
          ],
          answer: 0,
          fact: "Observation and logic win mystery challenges.",
        },
      ],
      adult: [
        {
          q: "BOSS: Mudman Mystery! What makes mystery pins satisfying?",
          options: [
            "Pattern, clue, and reveal",
            "Pure noise",
            "Fast driving",
            "Ticket scanning",
          ],
          answer: 0,
          fact: "Mystery works through pattern, clue, and reveal.",
        },
      ],
    },
  },

  park_hidden_old_tree: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: What makes old trees special?",
          options: [
            "They hold age and history",
            "They are made of metal",
            "They float at sea",
            "They drive buses",
          ],
          answer: 0,
          fact: "Old trees can make places feel ancient and special.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: Why might an old tree feel important in a park?",
          options: [
            "It gives character and memory",
            "It runs the café",
            "It powers the lights",
            "It sells tickets",
          ],
          answer: 0,
          fact: "Old trees often give a park character and memory.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What can an old tree add to a landscape?",
          options: [
            "Depth, age, and continuity",
            "Traffic control",
            "Retail signage",
            "Industrial noise",
          ],
          answer: 0,
          fact: "An old tree adds a sense of depth and continuity.",
        },
      ],
    },
  },

  park_hidden_quiet_bench: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: Why is a quiet bench useful in a park?",
          options: [
            "It gives a calm place to rest",
            "It launches boats",
            "It repairs trains",
            "It grows apples",
          ],
          answer: 0,
          fact: "Quiet places help explorers rest and notice more.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: What does a hidden quiet bench add to a map?",
          options: [
            "A pause point",
            "A boss arena",
            "A market route",
            "A repair station",
          ],
          answer: 0,
          fact: "Quiet bench spots create pause points in a route.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What is valuable about hidden quiet spots?",
          options: [
            "They create reflection and contrast",
            "They produce power",
            "They direct traffic",
            "They store freight",
          ],
          answer: 0,
          fact: "Quiet hidden spots give reflection and contrast.",
        },
      ],
    },
  },

  park_hidden_secret_garden: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: What makes a secret garden feel special?",
          options: [
            "It feels hidden and magical",
            "It feels like a motorway",
            "It is noisy machinery",
            "It is a shipyard",
          ],
          answer: 0,
          fact: "Secret gardens feel special because they seem hidden and magical.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: Why do hidden garden spots work well in games?",
          options: [
            "They feel like secret rewards",
            "They feel like traffic jams",
            "They remove exploration",
            "They act like factories",
          ],
          answer: 0,
          fact: "Hidden gardens feel like secret rewards.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What does a hidden garden add to a quest map?",
          options: [
            "Atmosphere and contrast",
            "Freight logistics",
            "Industrial output",
            "Street lighting only",
          ],
          answer: 0,
          fact: "A hidden garden adds atmosphere and contrast.",
        },
      ],
    },
  },

  park_hidden_lake_spot: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: What makes lake spots fun for explorers?",
          options: [
            "They are calm and scenic",
            "They are loud factories",
            "They are airport gates",
            "They are bus depots",
          ],
          answer: 0,
          fact: "Lake spots often feel calm and scenic.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: What vibe does a hidden lake spot usually give?",
          options: [
            "Calm and observation",
            "Panic and noise",
            "Cargo loading",
            "City traffic",
          ],
          answer: 0,
          fact: "Hidden lake spots work well as calm observation points.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What does water add to a route experience?",
          options: [
            "Pause and atmosphere",
            "Only danger",
            "Only commerce",
            "Only speed",
          ],
          answer: 0,
          fact: "Water often adds pause and atmosphere.",
        },
      ],
    },
  },

  abbey_ghost_cloister: {
    ghost: {
      kid: [
        {
          q: "GHOST: Cloister Ghost! What should explorers use first in a spooky old place?",
          options: [
            "Courage and calm",
            "Shouting only",
            "Running into walls",
            "Throwing stones",
          ],
          answer: 0,
          fact: "The best explorers stay calm and brave.",
        },
      ],
      teen: [
        {
          q: "GHOST: Cloister Ghost! What gives a cloister its eerie power?",
          options: [
            "Silence, stone, and echo",
            "Traffic lights",
            "Loud music",
            "Shopping signs",
          ],
          answer: 0,
          fact: "Silent stone spaces and echoes give old cloisters their atmosphere.",
        },
      ],
      adult: [
        {
          q: "GHOST: Cloister Ghost! Why do enclosed ruin-spaces often feel haunted?",
          options: [
            "They combine memory, silence, and atmosphere",
            "They improve road traffic",
            "They generate electricity",
            "They hide market stalls",
          ],
          answer: 0,
          fact: "Enclosed ruins often feel haunted because place and imagination work together.",
        },
      ],
    },
  },

  abbey_headless_monk: {
    ghost: {
      kid: [
        {
          q: "GHOST ENCOUNTER: A monk appears in the mist. What should explorers use most?",
          options: [
            "Courage and calm",
            "Shouting only",
            "Running into walls",
            "Throwing mud",
          ],
          answer: 0,
          fact: "Ghost encounters work best with courage and calm.",
        },
      ],
      teen: [
        {
          q: "GHOST ENCOUNTER: What gives ghost stories their power?",
          options: [
            "Atmosphere and imagination",
            "Traffic lights",
            "Shopping receipts",
            "Bus timetables",
          ],
          answer: 0,
          fact: "Ghost stories work through atmosphere and imagination.",
        },
      ],
      adult: [
        {
          q: "GHOST ENCOUNTER: Why do haunted legends stay memorable?",
          options: [
            "They combine place, fear, and imagination",
            "They replace road signs",
            "They fuel factories",
            "They control harbour cranes",
          ],
          answer: 0,
          fact: "Haunted legends stay strong because they fuse place and imagination.",
        },
      ],
    },
  },

  abbey_whispering_trees: {
    ghost: {
      kid: [
        {
          q: "GHOST: Whispering Trees! What makes trees feel spooky in the wind?",
          options: [
            "Their sounds and shadows",
            "Their engines",
            "Their headlights",
            "Their concrete walls",
          ],
          answer: 0,
          fact: "Wind, shadows, and movement can make trees feel spooky.",
        },
      ],
      teen: [
        {
          q: "GHOST: Whispering Trees! What creates the eerie feeling here most?",
          options: [
            "Movement and sound",
            "Traffic cones",
            "Ticket barriers",
            "Shop windows",
          ],
          answer: 0,
          fact: "Movement and sound are often what make places feel eerie.",
        },
      ],
      adult: [
        {
          q: "GHOST: Whispering Trees! Why are natural spaces so effective in ghost stories?",
          options: [
            "Because sound, darkness, and uncertainty work together",
            "Because they improve Wi-Fi",
            "Because they store cargo",
            "Because they replace roads",
          ],
          answer: 0,
          fact: "Natural spaces often feel haunted because uncertainty and atmosphere build together.",
        },
      ],
    },
  },

  abbey_hidden_stone: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: A silent stone is hidden here. Why do stones matter in ruins?",
          options: [
            "They carry clues from the past",
            "They are remote controls",
            "They run trains",
            "They sell tickets",
          ],
          answer: 0,
          fact: "Stones in ruins can feel like clues from the past.",
        },
      ],
    },
  },

  abbey_hidden_mirror: {
    discovery: {
      teen: [
        {
          q: "DISCOVERY: Valley Mirror found. What do reflective hidden spots add?",
          options: [
            "Mood and mystery",
            "Cargo loading",
            "Market noise",
            "Traffic policing",
          ],
          answer: 0,
          fact: "Reflective hidden spots add mood and mystery.",
        },
      ],
    },
  },

  abbey_hidden_forge: {
    discovery: {
      adult: [
        {
          q: "DISCOVERY: Iron Forge Ruins found. What does a forge site suggest?",
          options: [
            "Labour and transformation",
            "Beach tourism only",
            "Airport lounges",
            "Religious silence only",
          ],
          answer: 0,
          fact: "Forge ruins suggest labour, heat, and transformation.",
        },
      ],
    },
  },
};

/* =========================================================
   RIDDLE BUILDERS
========================================================= */

const RIDDLE_FUNNY = {
  kid: [
    "A confused potato in a wizard hat",
    "Your dad’s lost TV remote",
    "A chicken wearing sunglasses",
    "A penguin driving a bus",
  ],
  teen: [
    "Your group chat at 2am",
    "A dramatic pigeon with attitude",
    "A seagull running a business",
    "Your mate after one hour of sleep",
  ],
  adult: [
    "That one drawer full of random cables",
    "Your sat-nav after a wrong turn",
    "A neighbour with strong opinions",
    "The weekly shop before payday",
  ],
};

const RIDDLE_CLOSE = {
  kid: ["A shadow", "A map", "A mirror", "A clock"],
  teen: ["An echo", "A sign", "A picture", "A tool"],
  adult: ["A symbol", "A signal", "A reflection", "A marker"],
};

const RIDDLE_VERY_CLOSE = {
  kid: ["A book", "A bottle", "A road", "A bell"],
  teen: ["A keypad", "A notebook", "A footprint", "A tower"],
  adult: ["A memory", "A pattern", "A route", "A record"],
};

function makeMcqFromRiddle(riddle, tier = "kid", salt = 0, forcedId = null) {
  if (!riddle?.q || !riddle?.a) {
    return makeFallbackTask("Broken riddle entry.", { mode: "logic" });
  }

  const correct = riddle.a;
  const funny = pickOne(RIDDLE_FUNNY[tier], salt + 11) || "A confused potato";
  const close = pickOne(RIDDLE_CLOSE[tier], salt + 22) || "A shadow";
  const veryClose = pickOne(RIDDLE_VERY_CLOSE[tier], salt + 33) || "A map";

  let options = [correct, veryClose, close, funny];
  options = [...new Set(options)];

  while (options.length < 4) {
    options.push(`Option ${options.length + 1}`);
  }

  const shuffled = shuffleSeeded(options, salt);
  const answer = shuffled.indexOf(correct);
  const riddleText = getTieredText(riddle.q, tier);

  return {
    id: forcedId || riddle.id || makeQuestionId("logic", riddle),
    q: riddleText,
    options: shuffled,
    answer,
    fact: riddle.a,
    meta: { type: "riddle", tier },
  };
}

/* =========================================================
   MASTER QUIZ BANK
========================================================= */

export const MASTER_QUIZ_BANK = {
  kid: [
    mq(
      "001",
      1,
      ["general", "space"],
      "Which planet is known as the Red Planet?",
      ["Venus", "Mars", "Jupiter", "Saturn"],
      1,
      "Mars looks red because of iron oxide on its surface."
    ),
    mq(
      "002",
      2,
      ["barrow", "industry"],
      "What is Barrow famous for building?",
      ["Submarines", "Castles", "Aeroplanes", "Race tracks"],
      0,
      "Barrow is strongly associated with submarine building."
    ),
    mq(
      "003",
      3,
      ["uk", "geography"],
      "Barrow is in which country?",
      ["England", "Germany", "Spain", "Italy"],
      0,
      "Barrow-in-Furness is in England."
    ),
    mq(
      "004",
      4,
      ["uk", "capital"],
      "What is the capital city of England?",
      ["London", "Leeds", "York", "Bristol"],
      0,
      "London is the capital of England."
    ),
    mq(
      "005",
      5,
      ["barrow", "coast"],
      "What natural feature is Barrow right beside?",
      ["The sea", "A desert", "A jungle", "A volcano"],
      0,
      "Barrow is a coastal town."
    ),
    mq(
      "006",
      6,
      ["logic", "place"],
      "Which one would NOT make sense to see in Barrow?",
      ["Ships", "The sea", "Houses", "Pyramids"],
      3,
      "Barrow has ships, houses, and the sea — not pyramids."
    ),
    mq(
      "007",
      7,
      ["barrow", "industry"],
      "Why is Barrow a good place for shipbuilding?",
      [
        "Because it is near the sea",
        "Because it is hot",
        "Because it is quiet",
        "Because it is tiny",
      ],
      0,
      "Sea access makes shipbuilding practical."
    ),
    mq(
      "008",
      8,
      ["space"],
      "Which planet is the biggest in our solar system?",
      ["Earth", "Mars", "Jupiter", "Venus"],
      2,
      "Jupiter is the largest planet in our solar system."
    ),
    mq(
      "009",
      9,
      ["animals", "world"],
      "Which animal causes the most human deaths each year?",
      ["Shark", "Lion", "Mosquito", "Snake"],
      2,
      "Mosquitoes are deadliest because they spread disease."
    ),
    mq(
      "010",
      10,
      ["animals"],
      "Which animal has three hearts?",
      ["Octopus", "Shark", "Dolphin", "Whale"],
      0,
      "An octopus has three hearts."
    ),
    mq(
      "011",
      11,
      ["science", "physics"],
      "If you dropped a hammer and a feather where there was no air, what would happen?",
      [
        "The feather falls slower",
        "The hammer falls faster",
        "They fall at the same speed",
        "It depends on colour",
      ],
      2,
      "Without air resistance, they fall the same."
    ),
    mq(
      "012",
      12,
      ["body"],
      "What is the largest organ in the human body?",
      ["Brain", "Liver", "Skin", "Heart"],
      2,
      "Skin is the body’s largest organ."
    ),
    mq(
      "013",
      13,
      ["world", "time"],
      "Which country has the most time zones?",
      ["USA", "Russia", "France", "China"],
      2,
      "France has the most time zones because of its overseas territories."
    ),
    mq(
      "014",
      14,
      ["science", "chemistry"],
      "What is the most common element in the universe?",
      ["Oxygen", "Hydrogen", "Carbon", "Iron"],
      1,
      "Hydrogen is the most abundant element in the universe."
    ),
    mq(
      "015",
      15,
      ["space"],
      "Which planet spins the opposite way to most planets?",
      ["Mars", "Venus", "Jupiter", "Saturn"],
      1,
      "Venus rotates in the opposite direction to most planets."
    ),
    mq(
      "016",
      16,
      ["world", "animals"],
      "Which continent has no native ants?",
      ["Africa", "Antarctica", "Australia", "Europe"],
      1,
      "Antarctica is too cold for native ants."
    ),
    mq(
      "017",
      17,
      ["animals"],
      "Which animal has its heart in its head region?",
      ["Octopus", "Shrimp", "Crab", "Jellyfish"],
      1,
      "A shrimp’s heart is located in its head region."
    ),
    mq(
      "018",
      18,
      ["technology", "ai"],
      "What does AI stand for?",
      [
        "Artificial Intelligence",
        "Automatic Internet",
        "Advanced Input",
        "Active Interface",
      ],
      0,
      "AI stands for Artificial Intelligence."
    ),
    mq(
      "019",
      19,
      ["maths"],
      "Which is bigger?",
      ["0.5", "1/2", "They are the same", "It depends"],
      2,
      "0.5 and 1/2 are exactly the same value."
    ),
    mq(
      "020",
      20,
      ["language"],
      "Which word is spelled correctly?",
      ["Definately", "Definitely", "Defanitely", "Definetly"],
      1,
      "Definitely is the correct spelling."
    ),
    mq(
      "021",
      21,
      ["science", "light"],
      "Which travels faster?",
      ["Sound", "Light", "Wind", "A car"],
      1,
      "Light travels much faster than sound."
    ),
    mq(
      "022",
      22,
      ["body"],
      "Which of these is not a bone?",
      ["Skull", "Rib", "Muscle", "Spine"],
      2,
      "A muscle is not a bone."
    ),
    mq(
      "023",
      23,
      ["barrow", "weather"],
      "Why does Barrow often feel windy?",
      [
        "It is near the coast",
        "It is very hot",
        "It is underground",
        "It has no roads",
      ],
      0,
      "Coastal exposure often makes places windier."
    ),
    mq(
      "024",
      24,
      ["animals"],
      "Which of these can live the longest?",
      ["Dog", "Elephant", "Tortoise", "Cat"],
      2,
      "Some tortoises can live for well over 100 years."
    ),
    mq(
      "025",
      25,
      ["science", "states"],
      "Which of these is NOT a liquid?",
      ["Water", "Oil", "Ice", "Milk"],
      2,
      "Ice is solid water."
    ),
    mq(
      "026",
      26,
      ["science", "heat"],
      "Which would melt fastest?",
      [
        "Ice in the sun",
        "Ice in the fridge",
        "Ice in the freezer",
        "Ice in the shade",
      ],
      0,
      "Heat speeds up melting."
    ),
    mq(
      "027",
      27,
      ["world", "oceans"],
      "Which is the largest ocean?",
      ["Atlantic", "Indian", "Pacific", "Arctic"],
      2,
      "The Pacific is the largest ocean on Earth."
    ),
    mq(
      "028",
      28,
      ["animals", "biology"],
      "Which of these is a mammal?",
      ["Shark", "Dolphin", "Tuna", "Octopus"],
      1,
      "Dolphins are mammals, not fish."
    ),
    mq(
      "029",
      29,
      ["science", "floating"],
      "Which of these would usually float?",
      ["Rock", "Coin", "Wood", "Metal bar"],
      2,
      "Wood often floats because it is less dense than water."
    ),
    mq(
      "030",
      30,
      ["barrow", "sea"],
      "Why has the sea been important to Barrow?",
      ["Fishing and ships", "Warmer weather", "Bigger roads", "Less rain"],
      0,
      "Sea access helped Barrow grow through ships and industry."
    ),
    mq(
      "031",
      31,
      ["water"],
      "Which contains the most water?",
      ["A cup", "A lake", "The ocean", "A bottle"],
      2,
      "The oceans contain most of Earth’s water."
    ),
    mq(
      "032",
      32,
      ["science", "boiling"],
      "What happens when water boils?",
      ["It freezes", "It turns into gas", "It disappears", "It gets heavier"],
      1,
      "Boiling turns liquid water into gas."
    ),
    mq(
      "033",
      33,
      ["space"],
      "Which object is closest to Earth?",
      ["The Moon", "The Sun", "Mars", "Jupiter"],
      0,
      "The Moon is Earth’s closest celestial neighbour."
    ),
    mq(
      "034",
      34,
      ["navigation"],
      "Which tool helps you find direction?",
      ["Compass", "Clock", "Calculator", "Thermometer"],
      0,
      "A compass helps you navigate by direction."
    ),
    mq(
      "035",
      35,
      ["animals"],
      "Which animal breathes through gills?",
      ["Dog", "Fish", "Bird", "Horse"],
      1,
      "Fish use gills to breathe underwater."
    ),
    mq(
      "036",
      36,
      ["heat"],
      "Which of these is hottest?",
      ["Ice", "Fire", "Water", "Wind"],
      1,
      "Fire is hotter than the others listed."
    ),
    mq(
      "037",
      37,
      ["barrow", "docks"],
      "Why does Barrow have docks?",
      ["For ships", "For cars", "For farms", "For houses"],
      0,
      "Barrow’s docks were built for shipping and industry."
    ),
    mq(
      "038",
      38,
      ["body", "energy"],
      "Which gives your body energy?",
      ["Food", "Air", "Water", "Light"],
      0,
      "Food provides the body with energy."
    ),
    mq(
      "039",
      39,
      ["space"],
      "Which of these is not now classed as a full planet?",
      ["Mars", "Venus", "Pluto", "Earth"],
      2,
      "Pluto is classed as a dwarf planet."
    ),
    mq(
      "040",
      40,
      ["materials"],
      "Which is the hardest natural material?",
      ["Wood", "Steel", "Diamond", "Glass"],
      2,
      "Diamond is the hardest naturally occurring material."
    ),
    mq(
      "041",
      41,
      ["animals"],
      "Which animal is cold-blooded?",
      ["Dog", "Snake", "Bird", "Horse"],
      1,
      "Snakes are cold-blooded."
    ),
    mq(
      "042",
      42,
      ["science", "floating"],
      "Which of these would sink in water?",
      ["Plastic bottle", "Wooden stick", "Metal spoon", "Sponge"],
      2,
      "A metal spoon sinks because it is denser than water."
    ),
    mq(
      "043",
      43,
      ["plants"],
      "What do plants need to make food?",
      ["Sunlight", "Darkness", "Wind", "Noise"],
      0,
      "Plants use sunlight during photosynthesis."
    ),
    mq(
      "044",
      44,
      ["body", "cooling"],
      "Which of these helps cool your body?",
      [
        "Sitting still",
        "Drinking water",
        "Closing your eyes",
        "Standing still",
      ],
      1,
      "Hydration helps your body regulate temperature."
    ),
    mq(
      "045",
      45,
      ["body", "behaviour"],
      "Which is a common sign of nervousness?",
      ["Sweaty hands", "Sleeping", "Eating slowly", "Stretching"],
      0,
      "Nervousness often causes sweaty hands."
    ),
    mq(
      "046",
      46,
      ["money", "modern"],
      "Which of these usually costs the most?",
      ["A sandwich", "A phone", "A pen", "A bottle of water"],
      1,
      "Phones usually cost much more than the other options."
    ),
    mq(
      "047",
      47,
      ["time", "behaviour"],
      "When does time often feel slow?",
      [
        "When you are bored",
        "When you are having fun",
        "When you are asleep",
        "When you are laughing",
      ],
      0,
      "Boredom often makes time feel slower."
    ),
    mq(
      "048",
      48,
      ["safety"],
      "What should you do first if something is too hot to touch?",
      ["Grab it", "Blow on it", "Ignore it", "Throw it"],
      1,
      "Blowing can help cool a hot surface slightly."
    ),
    mq(
      "049",
      49,
      ["social"],
      "Which of these is polite?",
      ["Interrupting", "Saying thank you", "Shouting", "Ignoring people"],
      1,
      "Saying thank you is polite."
    ),
    mq(
      "050",
      50,
      ["weight", "objects"],
      "Which of these would be hardest to carry for a long time?",
      ["A backpack", "A heavy suitcase", "A book", "A phone"],
      1,
      "Heavier objects take more effort to carry."
    ),
    mq(
      "051",
      51,
      ["animals"],
      "Which animal is known for poor eyesight?",
      ["Eagle", "Mole", "Cat", "Hawk"],
      1,
      "Moles rely more on touch and smell than vision."
    ),
    mq(
      "052",
      52,
      ["animals"],
      "Which of these has no bones?",
      ["Spider", "Jellyfish", "Fish", "Bird"],
      1,
      "Jellyfish do not have bones."
    ),
    mq(
      "053",
      53,
      ["vision"],
      "What helps you see better in the dark?",
      [
        "Turning lights off quickly",
        "Letting your eyes adjust",
        "Looking at your phone",
        "Closing one eye",
      ],
      1,
      "Your eyes need time to adjust to darkness."
    ),
    mq(
      "054",
      54,
      ["logic", "weight"],
      "Which is heavier?",
      ["1kg of feathers", "1kg of metal", "They weigh the same", "It depends"],
      2,
      "A kilogram is a kilogram whatever it is made of."
    ),
    mq(
      "055",
      55,
      ["survival", "body"],
      "Which helps you stay warm best?",
      [
        "Wet clothes",
        "Layered clothing",
        "Drinking cold water",
        "Standing still",
      ],
      1,
      "Layers trap warm air and help keep heat in."
    ),
    mq(
      "056",
      56,
      ["modern", "technology"],
      "Which of these stops working without electricity?",
      ["A book", "A phone", "A chair", "A shoe"],
      1,
      "A phone depends on electrical power."
    ),
    mq(
      "057",
      57,
      ["endurance", "humans"],
      "Which is actually very good over long distances?",
      ["Cheetah", "Horse", "Human", "Dog"],
      2,
      "Humans are surprisingly strong endurance runners."
    ),
    mq(
      "058",
      58,
      ["body", "cooling"],
      "What cools your body most naturally?",
      ["Sitting still", "Sweating", "Sleeping", "Blinking"],
      1,
      "Sweating cools the body as it evaporates."
    ),
    mq(
      "059",
      59,
      ["food", "health"],
      "Which of these can contain a lot of sugar?",
      ["Fruit juice", "Water", "Milk", "Bread"],
      0,
      "Fruit juice can contain a surprising amount of sugar."
    ),
    mq(
      "060",
      60,
      ["biology", "life"],
      "Which of these is not fully considered alive?",
      ["Tree", "Mushroom", "Virus", "Bacteria"],
      2,
      "Viruses cannot reproduce on their own."
    ),
    mq(
      "061",
      61,
      ["survival", "cold"],
      "Which makes you lose heat fastest?",
      ["Dry cold", "Wet cold", "Warm air", "A hat"],
      1,
      "Water removes body heat faster than dry air."
    ),
    mq(
      "062",
      62,
      ["visibility", "night"],
      "Which is hardest to see at night?",
      ["White shirt", "Yellow jacket", "Black clothing", "Reflective strip"],
      2,
      "Dark clothing is hardest to see at night."
    ),
    mq(
      "063",
      63,
      ["clothing", "survival"],
      "Which keeps you warmest?",
      [
        "One thick jacket",
        "Several thin layers",
        "Wet clothes",
        "Tight clothing",
      ],
      1,
      "Several layers trap more warm air."
    ),
    mq(
      "064",
      64,
      ["survival", "body"],
      "Which becomes critical first for survival?",
      ["Oxygen", "Water", "Food", "Sleep"],
      0,
      "You can only survive a few minutes without oxygen."
    ),
    mq(
      "065",
      65,
      ["science", "heat"],
      "Which keeps heat for longer?",
      ["Metal", "Water", "Air", "Paper"],
      1,
      "Water has a high heat capacity."
    ),
    mq(
      "066",
      66,
      ["sound"],
      "Which sound is hardest to hear?",
      ["Loud music", "Whisper", "Shouting", "Siren"],
      1,
      "A whisper has the lowest loudness."
    ),
    mq(
      "067",
      67,
      ["science", "evaporation"],
      "Which would dry fastest?",
      [
        "Water in the sun",
        "Water in the shade",
        "Water in a fridge",
        "Water indoors",
      ],
      0,
      "Warmth speeds up evaporation."
    ),
    mq(
      "068",
      68,
      ["weather", "body"],
      "Which makes you feel colder fastest?",
      ["Wind", "Still air", "Warm clothes", "Standing still"],
      0,
      "Wind chill strips heat away quickly."
    ),
    mq(
      "069",
      69,
      ["survival", "physics"],
      "Which causes the fastest heat loss?",
      ["Dry cold air", "Wet skin in wind", "Warm air", "Still air"],
      1,
      "Wet skin plus wind causes very rapid heat loss."
    ),
    mq(
      "070",
      70,
      ["survival", "body"],
      "What becomes critical fastest in your body?",
      ["Oxygen", "Water", "Fat", "Muscle"],
      0,
      "Oxygen deprivation becomes dangerous extremely quickly."
    ),
    mq(
      "071",
      71,
      ["science", "heat"],
      "Which cools down the slowest?",
      ["Metal", "Water", "Air", "Paper"],
      1,
      "Water changes temperature more slowly."
    ),
    mq(
      "072",
      72,
      ["physics", "movement"],
      "Which is hardest to stop once moving?",
      ["Bicycle", "Car", "Train", "Person"],
      2,
      "A train has huge momentum."
    ),
    mq(
      "073",
      73,
      ["fire", "science"],
      "What makes fire burn faster?",
      ["More oxygen", "Less oxygen", "Darkness", "Cold air"],
      0,
      "Fire needs oxygen to burn strongly."
    ),
    mq(
      "074",
      74,
      ["visibility", "weather"],
      "Which is hardest to see in fog?",
      ["Bright yellow", "White", "Reflective strip", "Flashing light"],
      1,
      "White can blend into fog."
    ),
    mq(
      "075",
      75,
      ["probability", "cards"],
      "If you shuffle a deck of cards properly, what is most likely true?",
      [
        "That exact order has probably happened before",
        "That exact order is likely completely new",
        "Deck orders repeat often",
        "There are only a few possible orders",
      ],
      1,
      "There are so many card orders that a shuffle is likely unique."
    ),
    mq(
      "076",
      76,
      ["probability", "coins"],
      "Which is true about exact coin-flip patterns?",
      [
        "A mixed-looking sequence is more likely",
        "Ten heads in a row is more likely",
        "Any exact sequence is equally likely",
        "It depends how random it feels",
      ],
      2,
      "Any exact sequence of fair flips is equally likely."
    ),
    mq(
      "077",
      77,
      ["science", "ships"],
      "Why can huge steel ships float?",
      [
        "Steel is lighter than water",
        "They displace enough water",
        "Their engines hold them up",
        "The sea wants them to float",
      ],
      1,
      "Floating depends on density and displacement, not just material."
    ),
    mq(
      "078",
      78,
      ["memory", "thinking"],
      "Which is often more accurate before you overthink?",
      [
        "Your first answer",
        "Your second answer",
        "A random answer",
        "The longest answer",
      ],
      0,
      "People often talk themselves out of correct first answers."
    ),
    mq(
      "079",
      79,
      ["science", "mirrors"],
      "Why does a mirror seem to swap left and right?",
      [
        "It flips everything sideways",
        "It reverses front-to-back",
        "Because of gravity",
        "Because it is magic",
      ],
      1,
      "Mirrors reverse front-to-back, and your brain interprets that strangely."
    ),
    mq(
      "080",
      80,
      ["weather", "space"],
      "Why do we see lightning before hearing thunder?",
      [
        "Light travels faster than sound",
        "Thunder happens later",
        "Clouds delay the sound on purpose",
        "Rain blocks thunder",
      ],
      0,
      "Light reaches you almost instantly compared with sound."
    ),
    mq(
      "081",
      81,
      ["logic", "language"],
      "How many letters are in the phrase 'the alphabet'?",
      ["26", "11", "10", "13"],
      1,
      "The phrase 'the alphabet' has 11 letters."
    ),
    mq(
      "082",
      82,
      ["logic", "wordplay"],
      "What has a neck but no head?",
      ["Bottle", "Shirt", "Person", "Guitar"],
      0,
      "A bottle has a neck."
    ),
    mq(
      "083",
      83,
      ["technology", "ai"],
      "Which of these can learn from lots of data?",
      ["Calculator", "AI system", "Clock", "Remote control"],
      1,
      "AI systems can learn patterns from data."
    ),
    mq(
      "084",
      84,
      ["logic", "paradox"],
      "If nothing is better than happiness, and pizza is better than nothing, what follows?",
      [
        "Pizza is worse than happiness",
        "Pizza is better than happiness",
        "Happiness is better than pizza",
        "No conclusion",
      ],
      1,
      "It is a word trick that makes pizza come out on top."
    ),
    mq(
      "085",
      85,
      ["maths", "logic"],
      "How many times can you take 1 away from 5?",
      ["5", "4", "1", "Infinite"],
      2,
      "After the first time, it is no longer 5."
    ),
    mq(
      "086",
      86,
      ["language"],
      "Which pair sounds the same but means different things?",
      ["Their / There", "Big / Large", "Run / Walk", "Fast / Quick"],
      0,
      "Their and there are homophones."
    ),
    mq(
      "087",
      87,
      ["logic", "lying"],
      "Which of these can intentionally lie?",
      ["A rock", "A book", "A person", "A chair"],
      2,
      "Lying requires intention."
    ),
    mq(
      "088",
      88,
      ["logic", "language"],
      "Which of these cannot be broken in a physical way?",
      ["Glass", "Stick", "Promise", "Phone"],
      2,
      "A promise is abstract, not physical."
    ),
    mq(
      "089",
      89,
      ["logic", "positions"],
      "If you pass the runner in second place, what place are you in?",
      ["First", "Second", "Third", "It depends"],
      1,
      "You take second place, not first."
    ),
    mq(
      "090",
      90,
      ["patterns", "maths"],
      "What comes next: 2, 6, 7, 21, 22...?",
      ["23", "44", "66", "24"],
      2,
      "The pattern alternates ×3 and +1."
    ),
    mq(
      "091",
      91,
      ["maths", "negatives"],
      "Which number comes before 0?",
      ["1", "-1", "0.5", "Nothing"],
      1,
      "The number line continues into negatives."
    ),
    mq(
      "092",
      92,
      ["logic", "classification"],
      "If all cats are animals, what must be true?",
      [
        "All animals are cats",
        "Some animals are cats",
        "No animals are cats",
        "Cats are not animals",
      ],
      1,
      "If cats are animals, then some animals are cats."
    ),
    mq(
      "093",
      93,
      ["time", "travel"],
      "If it takes 10 minutes to walk somewhere, how long is there and back?",
      ["10 minutes", "15 minutes", "20 minutes", "25 minutes"],
      2,
      "10 there and 10 back makes 20."
    ),
    mq(
      "094",
      94,
      ["patterns", "maths"],
      "What comes next: 1, 4, 9, 16...?",
      ["20", "25", "36", "18"],
      1,
      "These are square numbers."
    ),
    mq(
      "095",
      95,
      ["logic", "geometry"],
      "Which of these is impossible?",
      [
        "A square with 4 sides",
        "A triangle with 3 sides",
        "A circle with corners",
        "A rectangle with 4 sides",
      ],
      2,
      "A circle has no corners."
    ),
    mq(
      "096",
      96,
      ["barrow", "history", "industry"],
      "What most strongly helped Barrow grow long ago?",
      ["Industry and shipbuilding", "Only farming", "Only tourism", "Castles"],
      0,
      "Barrow grew rapidly through industry, docks, and shipbuilding."
    ),
    mq(
      "097",
      97,
      ["maths", "logic"],
      "A bat and a ball cost £1.10 in total. The bat costs £1 more than the ball. How much is the ball?",
      ["10p", "5p", "1p", "20p"],
      1,
      "The common wrong answer is 10p, but that would make the total £1.20."
    ),
    mq(
      "098",
      98,
      ["logic", "objects"],
      "You have a match, a candle, a lamp, and a fire. What do you light first?",
      ["The candle", "The lamp", "The fire", "The match"],
      3,
      "You must light the match first."
    ),
    mq(
      "099",
      99,
      ["science", "water"],
      "If you drop a stone into a glass already full of water, what happens?",
      [
        "Nothing",
        "Water spills out",
        "The water disappears",
        "The stone floats",
      ],
      1,
      "The stone displaces water, so it overflows."
    ),
    mq(
      "100",
      100,
      ["weather", "sound"],
      "If you see lightning and hear thunder 5 seconds later, roughly how far away is the storm?",
      ["1 mile", "5 miles", "10 miles", "Right above you"],
      0,
      "A rough rule is about 1 mile per 5 seconds."
    ),
  ],

  teen: [
    mq(
      "101",
      101,
      ["logic", "weight"],
      "Which weighs more?",
      ["1kg of feathers", "1kg of bricks", "They weigh the same", "It depends"],
      2,
      "A kilogram is a kilogram whatever it is made of."
    ),
    mq(
      "102",
      102,
      ["maths", "numbers"],
      "Which of these is a prime number?",
      ["9", "15", "17", "21"],
      2,
      "17 is prime because it is only divisible by 1 and itself."
    ),
    mq(
      "103",
      103,
      ["world", "geography"],
      "Which of these is not a continent?",
      ["Europe", "Africa", "Arctic", "Asia"],
      2,
      "The Arctic is a region, not a continent."
    ),
    mq(
      "104",
      104,
      ["science", "states"],
      "At boiling point, what does water turn into?",
      ["Ice", "Gas", "Solid", "Nothing"],
      1,
      "Boiling changes liquid water into gas."
    ),
    mq(
      "105",
      105,
      ["animals"],
      "Which is the fastest land animal?",
      ["Lion", "Cheetah", "Horse", "Tiger"],
      1,
      "The cheetah is the fastest land animal."
    ),
    mq(
      "106",
      106,
      ["maths", "shapes"],
      "Which shape has the greatest number of sides?",
      ["Pentagon", "Hexagon", "Octagon", "Triangle"],
      2,
      "An octagon has 8 sides."
    ),
    mq(
      "107",
      107,
      ["logic", "classification"],
      "Which one is the odd one out?",
      ["Apple", "Banana", "Carrot", "Orange"],
      2,
      "Carrot is a vegetable; the others are fruits."
    ),
    mq(
      "108",
      108,
      ["time"],
      "How many minutes are in an hour?",
      ["50", "60", "70", "100"],
      1,
      "There are 60 minutes in an hour."
    ),
    mq(
      "109",
      109,
      ["maths"],
      "Which value is larger?",
      ["0.25", "1/3", "They are equal", "0.2"],
      1,
      "1/3 is about 0.333..., so it is larger."
    ),
    mq(
      "110",
      110,
      ["plants", "science"],
      "Which input is essential for photosynthesis?",
      ["Sunlight", "Sand", "Metal", "Plastic"],
      0,
      "Plants use sunlight to make food."
    ),
    mq(
      "111",
      111,
      ["modern", "language"],
      "In texting, what does LOL stand for?",
      ["Lots of Luck", "Laugh Out Loud", "Love Our Life", "Look Over Left"],
      1,
      "LOL usually means Laugh Out Loud."
    ),
    mq(
      "112",
      112,
      ["logic", "time"],
      "Which month has 28 days?",
      ["February", "January", "All of them", "December"],
      2,
      "Every month has at least 28 days."
    ),
    mq(
      "113",
      113,
      ["language"],
      "What is the antonym of 'increase'?",
      ["Expand", "Reduce", "Improve", "Multiply"],
      1,
      "Reduce is the opposite of increase."
    ),
    mq(
      "114",
      114,
      ["modern", "technology"],
      "Which device usually requires charging?",
      ["Book", "Phone", "Table", "Spoon"],
      1,
      "Phones normally require electrical charging."
    ),
    mq(
      "115",
      115,
      ["maths"],
      "What is 2 + 2?",
      ["3", "4", "5", "6"],
      1,
      "2 + 2 = 4."
    ),
    mq(
      "116",
      116,
      ["science", "floating"],
      "Which of these can float on water?",
      ["Rock", "Apple", "Brick", "Metal bar"],
      1,
      "Apples float because they contain air."
    ),
    mq(
      "117",
      117,
      ["animals"],
      "What is a young dog called?",
      ["Cub", "Puppy", "Kitten", "Calf"],
      1,
      "A young dog is called a puppy."
    ),
    mq(
      "118",
      118,
      ["patterns", "maths"],
      "What comes next: 2, 4, 6, 8...?",
      ["9", "10", "11", "12"],
      1,
      "The pattern increases by 2 each time."
    ),
    mq(
      "119",
      119,
      ["modern", "internet"],
      "Which app is best known for short-form videos?",
      ["WhatsApp", "TikTok", "Excel", "Gmail"],
      1,
      "TikTok is known for short-form video content."
    ),
    mq(
      "120",
      120,
      ["science", "life"],
      "Which of these is non-living?",
      ["Tree", "Dog", "Rock", "Human"],
      2,
      "A rock is non-living."
    ),
    mq(
      "121",
      121,
      ["riddle", "logic"],
      "What gets wetter the more it dries?",
      ["Sponge", "Towel", "Paper", "Cloth"],
      1,
      "A towel gets wetter as it dries things."
    ),
    mq(
      "122",
      122,
      ["science", "sound"],
      "Which of these cannot be physically touched as an object?",
      ["Air", "Sound", "Water", "Sand"],
      1,
      "You can detect sound, but it is not a solid object."
    ),
    mq(
      "123",
      123,
      ["physics"],
      "Which object would likely hurt most if dropped on your foot?",
      ["Feather", "Brick", "Leaf", "Sponge"],
      1,
      "A brick has far greater mass and impact."
    ),
    mq(
      "124",
      124,
      ["language"],
      "Which word is a synonym of 'fast'?",
      ["Slow", "Quick", "Late", "Weak"],
      1,
      "Quick is a synonym of fast."
    ),
    mq(
      "125",
      125,
      ["maths"],
      "What is 1 minus 1?",
      ["1", "0", "2", "It depends"],
      1,
      "1 - 1 = 0."
    ),
    mq(
      "126",
      126,
      ["science", "heat"],
      "Which of these melts under enough heat first?",
      ["Ice", "Stone", "Glass", "Wood"],
      0,
      "Ice melts at a much lower temperature."
    ),
    mq(
      "127",
      127,
      ["logic"],
      "Which of these is not a number?",
      ["7", "12", "Blue", "100"],
      2,
      "Blue is a colour, not a number."
    ),
    mq(
      "128",
      128,
      ["modern"],
      "Which device is commonly used to take a selfie?",
      ["Phone", "Book", "Chair", "Plate"],
      0,
      "Phones are commonly used for selfies."
    ),
    mq(
      "129",
      129,
      ["maths"],
      "Which is the smallest?",
      ["1", "0", "10", "100"],
      1,
      "Zero is smaller than the other values listed."
    ),
    mq(
      "130",
      130,
      ["animals"],
      "Which of these can fly?",
      ["Dog", "Bird", "Cat", "Horse"],
      1,
      "Birds are adapted for flight."
    ),
    mq(
      "131",
      131,
      ["logic", "weight"],
      "Which weighs more?",
      [
        "A tonne of steel",
        "A tonne of feathers",
        "They weigh the same",
        "It depends",
      ],
      2,
      "A tonne is a tonne regardless of material."
    ),
    mq(
      "132",
      132,
      ["geometry", "logic"],
      "How many sides does a circle technically have?",
      ["0", "1", "Infinite", "2"],
      0,
      "A circle has no straight edges."
    ),
    mq(
      "133",
      133,
      ["patterns", "maths"],
      "What comes next: 1, 1, 2, 3, 5...?",
      ["6", "7", "8", "10"],
      2,
      "This is the Fibonacci sequence."
    ),
    mq(
      "134",
      134,
      ["language", "logic"],
      "Which word does not belong?",
      ["Running", "Swimming", "Thinking", "Jumping"],
      2,
      "Thinking is mental; the others are physical actions."
    ),
    mq(
      "135",
      135,
      ["physics"],
      "If dropped together in normal air, which lands first?",
      ["Ball", "Feather", "Same time", "It depends on colour"],
      0,
      "Air resistance slows the feather more."
    ),
    mq(
      "136",
      136,
      ["maths"],
      "Which of these is an odd number?",
      ["12", "18", "21", "30"],
      2,
      "21 is not divisible by 2."
    ),
    mq(
      "137",
      137,
      ["logic", "animals"],
      "Which statement is always correct?",
      [
        "All birds can fly",
        "All fish swim",
        "Some birds cannot fly",
        "All animals run",
      ],
      2,
      "Some birds, such as penguins, cannot fly."
    ),
    mq(
      "138",
      138,
      ["technology"],
      "Which of these stores the most data?",
      ["KB", "MB", "GB", "TB"],
      3,
      "A terabyte is larger than a gigabyte."
    ),
    mq(
      "139",
      139,
      ["maths"],
      "What is 3 minus 2?",
      ["1", "2", "3", "0"],
      0,
      "3 - 2 = 1."
    ),
    mq(
      "140",
      140,
      ["logic", "shapes"],
      "Which item is the odd one out?",
      ["Square", "Triangle", "Rectangle", "Cube"],
      1,
      "Triangle is the only 2D shape listed with 3 sides."
    ),
    mq(
      "141",
      141,
      ["logic", "positions"],
      "If you pass the person in 2nd place, what place are you now?",
      ["First", "Second", "Third", "Last"],
      1,
      "You take second place."
    ),
    mq(
      "142",
      142,
      ["patterns", "maths"],
      "Find the next number: 2, 6, 7, 21, 22...?",
      ["23", "44", "66", "24"],
      2,
      "The pattern alternates ×3 and +1."
    ),
    mq(
      "143",
      143,
      ["language"],
      "Which sentence is grammatically correct?",
      [
        "He don't like it",
        "He doesn't likes it",
        "He doesn't like it",
        "He not like it",
      ],
      2,
      "After doesn't, the verb stays in its base form."
    ),
    mq(
      "144",
      144,
      ["science", "mass"],
      "Which weighs more?",
      ["1kg of water", "1kg of ice", "They weigh the same", "Ice is heavier"],
      2,
      "Changing state changes volume, not mass."
    ),
    mq(
      "145",
      145,
      ["maths", "numberline"],
      "Which integer comes before zero?",
      ["1", "-1", "0.5", "None"],
      1,
      "Negative numbers continue below zero."
    ),
    mq(
      "146",
      146,
      ["logic"],
      "If all cats are animals, what follows?",
      [
        "All animals are cats",
        "Some animals are cats",
        "No animals are cats",
        "Cats are not animals",
      ],
      1,
      "If cats exist, then some animals are cats."
    ),
    mq(
      "147",
      147,
      ["time", "travel"],
      "If a trip takes 10 minutes one way, how long is the round trip?",
      ["10 minutes", "15 minutes", "20 minutes", "25 minutes"],
      2,
      "10 + 10 = 20 minutes."
    ),
    mq(
      "148",
      148,
      ["logic", "time"],
      "Which of these always increases?",
      ["Age", "Height", "Money", "Speed"],
      0,
      "Age always increases over time."
    ),
    mq(
      "149",
      149,
      ["patterns", "maths"],
      "What comes next: 1, 4, 9, 16...?",
      ["20", "25", "36", "18"],
      1,
      "These are square numbers."
    ),
    mq(
      "150",
      150,
      ["logic", "geometry"],
      "Which of these is impossible?",
      [
        "A square with 4 sides",
        "A triangle with 3 sides",
        "A circle with corners",
        "A rectangle with 4 sides",
      ],
      2,
      "A circle cannot have corners."
    ),
  ],

  adult: [
    mq(
      "201",
      201,
      ["physics", "flight"],
      "Why do aeroplanes fly more efficiently at high altitude?",
      [
        "Less gravity",
        "Thinner air reduces drag",
        "Engines work harder",
        "More oxygen",
      ],
      1,
      "Higher altitude means less drag because the air is thinner."
    ),
    mq(
      "202",
      202,
      ["memory", "learning"],
      "Which of these most improves long-term memory?",
      [
        "Re-reading notes",
        "Testing yourself",
        "Highlighting text",
        "Watching videos",
      ],
      1,
      "Active recall is more effective than passive review."
    ),
    mq(
      "203",
      203,
      ["science", "weather"],
      "Why can we see our breath on a cold day?",
      [
        "Cold air creates smoke",
        "Water vapour condenses",
        "Oxygen becomes visible",
        "Air freezes",
      ],
      1,
      "Warm breath meets cold air and the moisture condenses."
    ),
    mq(
      "204",
      204,
      ["memory", "thinking"],
      "Which situation is most likely to create a false memory?",
      [
        "Seeing something once",
        "Repeatedly imagining it",
        "Ignoring it",
        "Writing it once",
      ],
      1,
      "Repeated imagination can blur into memory."
    ),
    mq(
      "205",
      205,
      ["money", "psychology"],
      "Why do prices often end in .99 instead of .00?",
      [
        "Easier to calculate",
        "They feel cheaper psychologically",
        "Tax reasons",
        "No reason",
      ],
      1,
      "Prices ending in .99 exploit perception and seem lower."
    ),
    mq(
      "206",
      206,
      ["body", "cooling"],
      "Which would cool the body fastest?",
      [
        "Sitting still",
        "Sweating with airflow",
        "Drinking cold water",
        "Standing in shade",
      ],
      1,
      "Evaporation is a very effective cooling mechanism."
    ),
    mq(
      "207",
      207,
      ["science", "mirrors"],
      "Why do mirrors appear to reverse left and right?",
      [
        "They flip horizontally",
        "They flip front-to-back",
        "They reflect sideways",
        "They distort the eye",
      ],
      1,
      "Mirrors reverse depth rather than truly swapping left and right."
    ),
    mq(
      "208",
      208,
      ["information", "truth"],
      "Which is more reliable over time?",
      [
        "A single expert opinion",
        "Multiple independent sources",
        "A viral post",
        "A guess",
      ],
      1,
      "Independent agreement is stronger than one isolated source."
    ),
    mq(
      "209",
      209,
      ["science", "chemistry"],
      "Why do onions make your eyes water?",
      [
        "Heat release",
        "A gas irritates your eyes",
        "Oxygen exposure",
        "A smell reaction only",
      ],
      1,
      "Cutting onions releases irritating chemicals that affect the eyes."
    ),
    mq(
      "210",
      210,
      ["maths", "growth"],
      "Which grows faster over time?",
      [
        "Adding the same amount repeatedly",
        "Increasing by a percentage",
        "Random change",
        "No growth",
      ],
      1,
      "Percentage growth compounds over time."
    ),
    mq(
      "211",
      211,
      ["thinking", "errors"],
      "Why is it harder to spot your own mistakes than someone else’s?",
      [
        "You care less",
        "Your brain fills in what it expects",
        "You forget faster",
        "You are always tired",
      ],
      1,
      "The brain often auto-corrects expected patterns."
    ),
    mq(
      "212",
      212,
      ["systems", "scale"],
      "If a system works 99% of the time, what becomes obvious at huge scale?",
      [
        "It becomes perfect",
        "Errors become noticeable",
        "It stops working",
        "Nothing changes",
      ],
      1,
      "Small failure rates become significant when repeated enough times."
    ),
    mq(
      "213",
      213,
      ["social", "communication"],
      "Why do people often trust confident speakers more than accurate ones?",
      [
        "Confidence signals certainty",
        "Accuracy is harder to judge",
        "People prefer simple delivery",
        "All of the above",
      ],
      3,
      "Confidence often feels convincing even when accuracy is weak."
    ),
    mq(
      "214",
      214,
      ["decision", "logic"],
      "Which decision is usually the most dangerous?",
      [
        "A rushed decision",
        "A delayed decision",
        "A confident but wrong decision",
        "No decision at all",
      ],
      2,
      "Confidence can make bad decisions harder to question."
    ),
    mq(
      "215",
      215,
      ["habits", "brain"],
      "Why do habits become easier over time?",
      [
        "They require less thought",
        "They become automatic",
        "The brain optimises them",
        "All of the above",
      ],
      3,
      "Habits reduce cognitive effort by becoming automatic."
    ),
    mq(
      "216",
      216,
      ["growth", "systems"],
      "Which is usually more powerful over time?",
      [
        "A big one-time effort",
        "Small consistent actions",
        "Random effort",
        "Waiting",
      ],
      1,
      "Consistency compounds."
    ),
    mq(
      "217",
      217,
      ["planning", "time"],
      "Why do people struggle to estimate time accurately?",
      [
        "They guess",
        "They ignore details",
        "They underestimate complexity",
        "Time changes speed",
      ],
      2,
      "People often miss hidden steps and underestimate complexity."
    ),
    mq(
      "218",
      218,
      ["habits", "change"],
      "Which is harder to change?",
      ["A decision", "A habit", "A thought", "A plan"],
      1,
      "Habits are deeply reinforced and automatic."
    ),
    mq(
      "219",
      219,
      ["information", "communication"],
      "Why do simple ideas spread faster than complex ones?",
      [
        "Easier to understand",
        "Easier to remember",
        "Easier to repeat",
        "All of the above",
      ],
      3,
      "Simple ideas move faster because they are easier to process and repeat."
    ),
    mq(
      "220",
      220,
      ["learning", "performance"],
      "Which is most likely to improve performance?",
      [
        "Doing something once",
        "Repeating with feedback",
        "Guessing",
        "Watching others only",
      ],
      1,
      "Feedback loops improve learning far more than repetition alone."
    ),
  ],
};

function getMasterQuizPoolForTier(tier = "kid") {
  return attachIds(MASTER_QUIZ_BANK?.[tier] || [], `master_quiz_${tier}`);
}

/* =========================================================
   ADAPTIVE SYSTEM
========================================================= */

const ADAPTIVE_TIER_DEFAULTS = {
  kid: { rating: 55, min: 1, max: 100 },
  teen: { rating: 150, min: 101, max: 200 },
  adult: { rating: 210, min: 201, max: 220 },
};

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).filter(Boolean).map((v) => String(v)))];
}

function getPinById(pinId) {
  if (!pinId || !Array.isArray(PINS)) return null;
  return PINS.find((p) => String(p.id) === String(pinId)) || null;
}

function getPinZone(pin) {
  return pin?.zone || pin?.set || "core";
}

function getPinGroup(pin) {
  return pin?.qaGroup || null;
}

function getRecentIds(input = {}) {
  const recent = input.recentQuestionIds || input.recentIds || [];
  return Array.isArray(recent) ? recent.map(String) : [];
}

function getRecentTags(input = {}) {
  const recent = input.recentQuestionTags || input.recentTags || [];
  return Array.isArray(recent) ? recent.map(String) : [];
}

function chooseEntryAvoidingRecent(pool, recentIds, salt = 0) {
  if (!pool.length) return null;

  const recentSet = new Set((recentIds || []).map(String));
  const filtered = pool.filter((item) => !recentSet.has(String(item.id)));

  if (filtered.length) return pickOne(filtered, salt);
  return pickOne(pool, salt);
}

function getExactPinOverride(pinId, mode, tier) {
  return (
    QA_PIN_OVERRIDES?.[pinId]?.[mode]?.[tier] ||
    QA_PIN_OVERRIDES?.[pinId]?.[mode]?.kid ||
    null
  );
}

function getGroupPool(group, mode, tier) {
  if (!group) return [];
  const groupBlock = QA_BY_GROUP?.[group];
  if (!groupBlock) return [];

  if (mode === "logic") {
    return attachIds(RIDDLE_POOL, `${group}_logic_${tier}`);
  }

  if (mode === "mindfulness") {
    return attachIds(
      combinePools(MINDFULNESS_POOL[tier] || [], MINDFULNESS_POOL.kid || []),
      `${group}_mindfulness_${tier}`
    );
  }

  if (["activity", "battle", "family", "speed"].includes(mode)) {
    let merged = [];
    if (mode === "activity") {
      merged = combinePools(ACTIVITY_POOL[tier] || [], ACTIVITY_POOL.kid || []);
    }
    if (mode === "battle") {
      merged = combinePools(BATTLE_POOL[tier] || [], BATTLE_POOL.kid || []);
    }
    if (mode === "family") {
      merged = combinePools(FAMILY_POOL[tier] || [], FAMILY_POOL.kid || []);
    }
    if (mode === "speed") {
      merged = combinePools(SPEED_POOL[tier] || [], SPEED_POOL.kid || []);
    }
    return attachIds(merged, `${group}_${mode}_${tier}`);
  }

  const exact = groupBlock?.[mode]?.[tier] || [];
  const kidFallback = tier !== "kid" ? groupBlock?.[mode]?.kid || [] : [];

  return attachIds(
    combinePools(exact, kidFallback),
    `${group}_${mode}_${tier}`
  );
}

function getZoneFunPool(zone, mode, tier) {
  if (mode === "logic") {
    return attachIds(RIDDLE_POOL, `${zone}_logic_${tier}`);
  }

  if (mode === "mindfulness") {
    return attachIds(
      combinePools(MINDFULNESS_POOL[tier] || [], MINDFULNESS_POOL.kid || []),
      `${zone}_mindfulness_${tier}`
    );
  }

  if (mode === "activity") {
    return attachIds(
      combinePools(ACTIVITY_POOL[tier] || [], ACTIVITY_POOL.kid || []),
      `${zone}_activity_${tier}`
    );
  }

  if (mode === "battle") {
    return attachIds(
      combinePools(BATTLE_POOL[tier] || [], BATTLE_POOL.kid || []),
      `${zone}_battle_${tier}`
    );
  }

  if (mode === "family") {
    return attachIds(
      combinePools(FAMILY_POOL[tier] || [], FAMILY_POOL.kid || []),
      `${zone}_family_${tier}`
    );
  }

  if (mode === "speed") {
    return attachIds(
      combinePools(SPEED_POOL[tier] || [], SPEED_POOL.kid || []),
      `${zone}_speed_${tier}`
    );
  }

  if (mode === "ghost") {
    if (zone === "abbey") {
      return attachIds(
        combinePools(
          QA_BY_GROUP.abbey_ghosts.ghost?.[tier] || [],
          tier !== "kid" ? QA_BY_GROUP.abbey_ghosts.ghost?.kid || [] : []
        ),
        `${zone}_ghost_${tier}`
      );
    }

    const genericGhost = {
      kid: [
        "Stand still for 5 seconds and listen for the tiniest sound nearby.",
        "Do a spooky statue pose.",
        "Point at the place a ghost might hide.",
        "Whisper one word that fits this place.",
      ],
      teen: [
        "Name one thing here that feels eerie.",
        "Give this place a ghost-story title.",
        "Stand silent for 10 seconds and listen.",
        "Say a one-line warning for this area.",
      ],
      adult: [
        "Describe the atmosphere here in one word.",
        "What detail makes this place feel unsettled or still?",
        "Stand quietly for 10 seconds and notice the soundscape.",
        "What would make this location work in a local ghost story?",
      ],
    };

    return attachIds(
      combinePools(genericGhost[tier] || [], genericGhost.kid || []),
      `${zone}_ghost_${tier}`
    );
  }

  if (
    mode === "quiz" ||
    mode === "history" ||
    mode === "boss" ||
    mode === "discovery"
  ) {
    return [];
  }

  return [];
}

function resolvePinStartIntro(pinId, tier = "kid") {
  return (
    QA_PIN_OVERRIDES?.[pinId]?.start?.[tier] ||
    QA_PIN_OVERRIDES?.[pinId]?.start?.kid ||
    PIN_START_INTROS?.[pinId]?.[tier] ||
    PIN_START_INTROS?.[pinId]?.kid ||
    ""
  );
}

function resolvePool({ pinId, pin, zone, group, mode, tier }) {
  const exactOverride = getExactPinOverride(pinId, mode, tier);
  if (Array.isArray(exactOverride) && exactOverride.length) {
    return {
      pool: attachIds(exactOverride, `${pinId}_${mode}_${tier}`),
      source: "pin-exact",
    };
  }

  if (pin?.hidden && mode === "discovery") {
    const hiddenOverride =
      QA_PIN_OVERRIDES?.[pinId]?.discovery?.[tier] ||
      QA_PIN_OVERRIDES?.[pinId]?.discovery?.kid ||
      [];

    if (Array.isArray(hiddenOverride) && hiddenOverride.length) {
      return {
        pool: attachIds(hiddenOverride, `${pinId}_discovery_${tier}`),
        source: "pin-discovery",
      };
    }
  }

  const groupPool = getGroupPool(group, mode, tier);
  if (groupPool.length) {
    return {
      pool: groupPool,
      source: `group-${group}`,
    };
  }

  const zoneFunPool = getZoneFunPool(zone, mode, tier);
  if (zoneFunPool.length) {
    return {
      pool: zoneFunPool,
      source: `zone-fun-${zone}`,
    };
  }

  return {
    pool: [],
    source: "none",
  };
}

export function getDefaultAdaptiveProfile(tier = "kid") {
  const safeTier = normaliseTier(tier);
  const base = ADAPTIVE_TIER_DEFAULTS[safeTier] || ADAPTIVE_TIER_DEFAULTS.kid;

  return {
    tier: safeTier,
    rating: base.rating,
    confidence: 0.5,
    streak: 0,
    correct: 0,
    wrong: 0,
    tagRatings: {},
    recentTags: [],
    recentQuestionIds: [],
  };
}

export function normaliseAdaptiveProfile(profile = {}, tier = "kid") {
  const safeTier = normaliseTier(tier);
  const base = getDefaultAdaptiveProfile(safeTier);

  return {
    ...base,
    ...(profile || {}),
    tier: safeTier,
    rating: clamp(
      profile?.rating ?? base.rating,
      ADAPTIVE_TIER_DEFAULTS[safeTier].min,
      ADAPTIVE_TIER_DEFAULTS[safeTier].max
    ),
    confidence: clamp(profile?.confidence ?? base.confidence, 0, 1),
    streak: Number.isFinite(Number(profile?.streak))
      ? Number(profile.streak)
      : 0,
    correct: Number.isFinite(Number(profile?.correct))
      ? Number(profile.correct)
      : 0,
    wrong: Number.isFinite(Number(profile?.wrong)) ? Number(profile.wrong) : 0,
    tagRatings:
      profile?.tagRatings && typeof profile.tagRatings === "object"
        ? { ...profile.tagRatings }
        : {},
    recentTags: Array.isArray(profile?.recentTags)
      ? profile.recentTags.map(String).slice(-12)
      : [],
    recentQuestionIds: Array.isArray(profile?.recentQuestionIds)
      ? profile.recentQuestionIds.map(String).slice(-24)
      : [],
  };
}

function getDefaultDifficultyForContext({
  tier = "kid",
  mode = "quiz",
  source = "none",
}) {
  const tierBase = tier === "kid" ? 55 : tier === "teen" ? 150 : 210;

  const modeOffset =
    mode === "quiz"
      ? 0
      : mode === "history"
      ? -8
      : mode === "logic"
      ? 6
      : mode === "boss"
      ? 12
      : mode === "discovery"
      ? -4
      : mode === "mindfulness"
      ? -12
      : 0;

  const sourceOffset =
    source === "pin-exact"
      ? 8
      : String(source).startsWith("group-")
      ? 4
      : String(source).startsWith("zone-fun-")
      ? -6
      : 0;

  return tierBase + modeOffset + sourceOffset;
}

function deriveDifficulty(entry, context = {}) {
  if (Number.isFinite(Number(entry?.difficulty))) {
    return Number(entry.difficulty);
  }

  return getDefaultDifficultyForContext(context);
}

function deriveTags(entry, context = {}) {
  const tags = [];

  if (Array.isArray(entry?.tags)) {
    tags.push(...entry.tags);
  }

  if (context.mode) tags.push(context.mode);
  if (context.zone) tags.push(`zone:${context.zone}`);
  if (context.group) tags.push(`group:${context.group}`);
  if (context.pinId) tags.push(`pin:${context.pinId}`);
  if (context.source) tags.push(`source:${context.source}`);

  if (context.mode === "quiz") {
    if (String(context.source).includes("group-")) tags.push("local");
    if (String(context.zone).includes("abbey")) tags.push("history");
    if (String(context.zone).includes("park")) tags.push("park");
    if (String(context.zone).includes("core")) tags.push("core");
  }

  if (context.mode === "mindfulness") {
    tags.push("reflection");
    tags.push("calm");
  }

  return uniqueStrings(tags);
}

function scoreEntryForAdaptivePick(entry, context = {}) {
  const profile = context.profile;
  const target = Number(
    profile.rating || getDefaultDifficultyForContext(context)
  );
  const difficulty = deriveDifficulty(entry, context);
  const tags = deriveTags(entry, context);
  const recentIds = new Set(getRecentIds(context.input));
  const recentTags = getRecentTags(context.input);
  const recentProfileTags = Array.isArray(profile.recentTags)
    ? profile.recentTags
    : [];
  const mergedRecentTags = [...recentTags, ...recentProfileTags].slice(-12);

  let score = Math.abs(difficulty - target);

  if (recentIds.has(String(entry.id))) score += 1000;

  const overlapCount = tags.filter((tag) =>
    mergedRecentTags.includes(tag)
  ).length;
  score += overlapCount * 9;

  const tagRatings = profile.tagRatings || {};
  const avgTagRating = tags.length
    ? tags.reduce((sum, tag) => sum + Number(tagRatings[tag] || 0), 0) /
      tags.length
    : 0;

  score -= avgTagRating * 1.5;

  const confidenceWindow =
    profile.confidence >= 0.75 ? 14 : profile.confidence >= 0.5 ? 20 : 28;

  const distanceOutsideWindow = Math.max(
    0,
    Math.abs(difficulty - target) - confidenceWindow
  );
  score += distanceOutsideWindow * 2.5;

  return {
    entry,
    score,
    difficulty,
    tags,
  };
}

function chooseAdaptiveEntry(pool, context = {}) {
  if (!Array.isArray(pool) || !pool.length) return null;

  const scored = pool
    .map((entry) => scoreEntryForAdaptivePick(entry, context))
    .sort((a, b) => a.score - b.score);

  const viable = scored.filter((item) => item.score < 1000);
  const shortlist = (viable.length ? viable : scored).slice(0, 5);
  if (!shortlist.length) return null;

  const pick = pickOne(shortlist, context.salt || 0) || shortlist[0];
  return {
    picked: pick.entry,
    difficulty: pick.difficulty,
    tags: pick.tags,
  };
}

export function updateAdaptiveProfile(profileInput = {}, result = {}) {
  const tier = normaliseTier(result?.tier || profileInput?.tier || "kid");
  const profile = normaliseAdaptiveProfile(profileInput, tier);
  const min = ADAPTIVE_TIER_DEFAULTS[tier].min;
  const max = ADAPTIVE_TIER_DEFAULTS[tier].max;

  const isCorrect = !!result.isCorrect;
  const questionDifficulty = Number.isFinite(Number(result?.difficulty))
    ? Number(result.difficulty)
    : profile.rating;

  const recentQuestionIds = [
    ...profile.recentQuestionIds,
    ...(result?.questionId ? [String(result.questionId)] : []),
  ].slice(-24);

  const recentTags = [
    ...profile.recentTags,
    ...(Array.isArray(result?.tags) ? result.tags : []).map(String),
  ].slice(-12);

  const diffDelta = questionDifficulty - profile.rating;
  const difficultyBonus = clamp(Math.round(diffDelta / 12), -4, 4);

  const ratingChange = isCorrect
    ? 7 + Math.max(0, difficultyBonus)
    : -6 + Math.min(0, difficultyBonus);

  const nextRating = clamp(profile.rating + ratingChange, min, max);

  const nextConfidence = clamp(
    profile.confidence + (isCorrect ? 0.06 : -0.05),
    0,
    1
  );

  const nextStreak = isCorrect ? profile.streak + 1 : 0;

  const nextTagRatings = { ...(profile.tagRatings || {}) };
  const tags = Array.isArray(result?.tags) ? result.tags.map(String) : [];
  tags.forEach((tag) => {
    const current = Number(nextTagRatings[tag] || 0);
    nextTagRatings[tag] = clamp(current + (isCorrect ? 1 : -1), -10, 10);
  });

  return {
    ...profile,
    tier,
    rating: nextRating,
    confidence: nextConfidence,
    streak: nextStreak,
    correct: profile.correct + (isCorrect ? 1 : 0),
    wrong: profile.wrong + (isCorrect ? 0 : 1),
    tagRatings: nextTagRatings,
    recentTags,
    recentQuestionIds,
  };
}

/* =========================================================
   MAIN EXPORTS
========================================================= */

export function getPinStartIntro(pinId, tier = "kid") {
  return resolvePinStartIntro(pinId, normaliseTier(tier));
}

export function getQA(input = {}) {
  const pinId = input.pinId || null;
  const pin = getPinById(pinId);
  const zone = input.zone || getPinZone(pin);
  const group = getPinGroup(pin);
  const mode = input.mode || "quiz";
  const tier = normaliseTier(input.tier || "kid");
  const recentIds = getRecentIds(input);

  const rawSalt = Number(input.salt || Date.now());
  const stableSalt =
    rawSalt +
    String(pinId || "none").length * 97 +
    String(zone).length * 37 +
    String(mode).length * 19 +
    String(tier).length * 11 +
    String(group || "nogroup").length * 13;

  const resolved = resolvePool({
    pinId,
    pin,
    zone,
    group,
    mode,
    tier,
  });

  let pool = resolved.pool;
  let source = resolved.source;

  if (mode === "quiz") {
    const masterPool = getMasterQuizPoolForTier(tier);

    if (masterPool.length) {
      const blended = [...masterPool];

      if (resolved.pool?.length) {
        const localMixCount = Math.min(3, resolved.pool.length);
        const localSlice = shuffleSeeded(
          [...resolved.pool],
          stableSalt + 500
        ).slice(0, localMixCount);
        blended.push(...localSlice);
      }

      pool = combinePools(blended);
      pool = attachIds(pool, `adaptive_quiz_${tier}`);
      source = resolved.pool?.length
        ? `master+${resolved.source}`
        : "master-quiz";
    }
  }

  if (!pool.length) {
    return makeFallbackTask(
      `No ${mode} content found for ${pinId || zone} (${tier}).`,
      {
        pinId,
        zone,
        group,
        mode,
        tier,
        source,
      }
    );
  }

  const adaptiveProfile = normaliseAdaptiveProfile(
    input.adaptiveProfile || input.quizProfile || {},
    tier
  );

  let adaptivePick = null;
  if (mode === "quiz") {
    adaptivePick = chooseAdaptiveEntry(pool, {
      profile: adaptiveProfile,
      input,
      tier,
      mode,
      zone,
      group,
      pinId,
      source,
      salt: stableSalt,
    });
  }

  const picked =
    adaptivePick?.picked ||
    chooseEntryAvoidingRecent(pool, recentIds, stableSalt);

  if (!picked) {
    return makeFallbackTask("No task could be chosen.", {
      pinId,
      zone,
      group,
      source,
      mode,
      tier,
    });
  }

  if (mode === "logic" && picked?.q && picked?.a) {
    const built = makeMcqFromRiddle(picked, tier, stableSalt, picked.id);
    built.meta = {
      ...(built.meta || {}),
      zone,
      group,
      pinId,
      source,
      mode,
      tier,
      questionId: built.id,
      difficulty: deriveDifficulty(picked, { tier, mode, source }),
      tags: deriveTags(picked, { tier, mode, source, zone, group, pinId }),
      adaptiveRating: adaptiveProfile.rating,
    };
    return built;
  }

  if (picked?.q && Array.isArray(picked?.options)) {
    const originalOptions = [...picked.options];
    const correctText = originalOptions[picked.answer];
    const shuffledOptions = shuffleSeeded(originalOptions, stableSalt + 123);
    const answer = shuffledOptions.indexOf(correctText);

    const qText = getTieredText(picked.q, tier);
    const factText = getTieredText(picked.fact, tier) || picked.fact || "";
    const difficulty =
      adaptivePick?.difficulty ??
      deriveDifficulty(picked, { tier, mode, source });
    const tags =
      adaptivePick?.tags ??
      deriveTags(picked, { tier, mode, source, zone, group, pinId });

    return {
      ...picked,
      q: qText,
      fact: factText,
      options: shuffledOptions,
      answer,
      meta: {
        ...(picked.meta || {}),
        zone,
        group,
        pinId,
        source,
        mode,
        tier,
        questionId: picked.id,
        difficulty,
        tags,
        adaptiveRating: adaptiveProfile.rating,
      },
    };
  }

  if (picked?._type === "prompt" && typeof picked.value === "string") {
    return {
      ...makePromptTask(picked.value, mode, picked.id),
      meta: {
        zone,
        group,
        pinId,
        source,
        mode,
        tier,
        promptOnly: true,
        questionId: picked.id,
        difficulty: deriveDifficulty(picked, { tier, mode, source }),
        tags: deriveTags(picked, { tier, mode, source, zone, group, pinId }),
        adaptiveRating: adaptiveProfile.rating,
      },
    };
  }

  if (typeof picked === "string") {
    return {
      ...makePromptTask(picked, mode),
      meta: {
        zone,
        group,
        pinId,
        source,
        mode,
        tier,
        promptOnly: true,
        questionId: makeQuestionId(
          `${zone}_${group || "nogroup"}_${mode}_${tier}`,
          picked
        ),
        difficulty: deriveDifficulty({ q: picked }, { tier, mode, source }),
        tags: deriveTags(
          { q: picked },
          { tier, mode, source, zone, group, pinId }
        ),
        adaptiveRating: adaptiveProfile.rating,
      },
    };
  }

  return makeFallbackTask("Task format not recognised.", {
    zone,
    group,
    pinId,
    source,
    mode,
    tier,
  });
}