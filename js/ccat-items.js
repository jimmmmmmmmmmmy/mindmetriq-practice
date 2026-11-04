// Original practice items for an unofficial Criteria-style aptitude drill.
// Templates, word lists, and figures are authored for this app. A seed picks
// numbers, order, and distractors. Nothing here is copied from a CCAT form.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CCATItems = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const AREAS = ["math", "verbal", "spatial"];
  const TYPES = {
    math: ["word", "ratio", "percent", "series", "syllogism"],
    verbal: ["analogy", "lexical", "cloze", "detail"],
    spatial: ["series", "matrix", "odd"],
  };
  const MOCK_MS = 15 * 60 * 1000;
  const PEOPLE = ["Mina", "Owen", "Priya", "Luis", "Hana", "Theo", "Greta", "Samir", "Inez", "Karl", "Nora", "Felix"];
  const SETS = ["North", "East", "South", "West", "Inner", "Outer", "Upper", "Lower"];
  const CRATES = ["Red", "Blue", "Green", "Gold", "Ivory", "Amber"];
  const LOCKS = [["gate", "lamp"], ["hatch", "bulb"], ["drawer", "light"], ["case", "beacon"]];
  const KINDS = ["circle", "square", "triangle", "diamond", "hex", "arrow"];

  const RELATIONS = [
    { id: "tool-action", level: 1, phrase: (a, b) => `a ${a} is used to ${b}`, pairs: [["needle", "sew"], ["whisk", "stir"], ["grater", "shred"], ["ladle", "scoop"], ["pliers", "grip"], ["chisel", "carve"]] },
    { id: "place-worker", level: 2, phrase: (a, b) => `a ${a} is a place a ${b} works`, pairs: [["cockpit", "pilot"], ["galley", "cook"], ["newsroom", "reporter"], ["orchard", "grower"], ["clinic", "nurse"], ["studio", "sculptor"]] },
    { id: "part-whole", level: 2, phrase: (a, b) => `a ${a} is part of a ${b}`, pairs: [["spoke", "wheel"], ["petal", "flower"], ["rung", "ladder"], ["keel", "boat"], ["bristle", "brush"], ["page", "book"]] },
    { id: "material", level: 3, phrase: (a, b) => `a ${a} is made of ${b}`, pairs: [["candle", "wax"], ["tire", "rubber"], ["jeans", "denim"], ["horseshoe", "iron"], ["sweater", "wool"], ["boot", "leather"]] },
    { id: "degree", level: 4, phrase: (a, b) => `${b} is a stronger form of ${a}`, pairs: [["chilly", "freezing"], ["damp", "soaked"], ["quiet", "silent"], ["dim", "dark"], ["glad", "overjoyed"], ["cool", "cold"]] },
    { id: "boundary", level: 5, phrase: (a, b) => `${b} is the matching end of ${a}`, pairs: [["dawn", "dusk"], ["depart", "arrive"], ["sow", "reap"], ["ignite", "extinguish"], ["board", "disembark"], ["hire", "dismiss"]] },
  ];

  const LEX = [
    { word: "scarce", syn: "rare", ant: "abundant", decoys: ["purple", "square", "salty", "weekly"] },
    { word: "rapid", syn: "swift", ant: "slow", decoys: ["wooden", "round", "spicy", "monthly"] },
    { word: "ancient", syn: "old", ant: "modern", decoys: ["plaid", "sour", "striped", "sweet"] },
    { word: "brief", syn: "short", ant: "lengthy", decoys: ["orange", "oval", "bitter", "silky"] },
    { word: "fragile", syn: "brittle", ant: "sturdy", decoys: ["triangular", "bland", "woolen", "narrow"] },
    { word: "hollow", syn: "empty", ant: "solid", decoys: ["tangy", "creamy", "steep", "floral"] },
    { word: "timid", syn: "shy", ant: "bold", decoys: ["copper", "linear", "roasted", "coastal"] },
    { word: "precise", syn: "exact", ant: "vague", decoys: ["velvet", "cubic", "minted", "polar"] },
    { word: "noisy", syn: "loud", ant: "quiet", decoys: ["canvas", "dotted", "lemon", "rustic"] },
    { word: "genuine", syn: "real", ant: "fake", decoys: ["knitted", "spiral", "herbal", "urban"] },
    { word: "vacant", syn: "unoccupied", ant: "occupied", decoys: ["bronze", "circular", "toasted", "inland"] },
    { word: "generous", syn: "charitable", ant: "stingy", decoys: ["fuzzy", "diagonal", "peppery", "lunar"] },
    { word: "mandatory", syn: "required", ant: "optional", decoys: ["glossy", "hexagonal", "smoky", "suburban"] },
    { word: "permanent", syn: "lasting", ant: "temporary", decoys: ["matte", "radial", "nutty", "nocturnal"] },
    { word: "severe", syn: "harsh", ant: "mild", decoys: ["crisp", "vertical", "floral", "daily"] },
    { word: "begin", syn: "start", ant: "finish", decoys: ["borrow", "paint", "fold", "measure"] },
    { word: "conceal", syn: "hide", ant: "reveal", decoys: ["swim", "bake", "dig", "sew"] },
    { word: "permit", syn: "allow", ant: "forbid", decoys: ["whisper", "jog", "knit", "tow"] },
    { word: "repair", syn: "fix", ant: "damage", decoys: ["clap", "rinse", "mail", "sort"] },
    { word: "expand", syn: "enlarge", ant: "shrink", decoys: ["sketch", "pour", "lift", "chop"] },
  ];

  const CLOZE = [
    { difficulty: 1, sentence: "The baker set the trays aside so the dough could ______ before baking.", choices: ["rise", "vote", "rust", "migrate", "applaud"], answer: "rise", explanation: "Dough is left to rise before it is baked. The other words are not steps in baking bread." },
    { difficulty: 1, sentence: "Please ______ the door so the cold stays outside.", choices: ["shut", "boil", "translate", "harvest", "appoint"], answer: "shut", explanation: "Shutting the door keeps the cold outside. The other verbs do not act on a door in this way." },
    { difficulty: 1, sentence: "The sky was ______, so she took a coat.", choices: ["dark", "wooden", "square", "minted", "weekly"], answer: "dark", explanation: "A dark sky is a reason to take a coat. The other words do not describe a sky." },
    { difficulty: 1, sentence: "He drank a full ______ of water after the run.", choices: ["glass", "ladder", "curtain", "violin", "receipt"], answer: "glass", explanation: "A glass is a container you can drink from. The other nouns are not drink containers." },
    { difficulty: 2, sentence: "The librarian asked visitors to ______ while people were reading.", choices: ["whisper", "gallop", "ignite", "dissolve", "excavate"], answer: "whisper", explanation: "A library asks for quiet speech. The other verbs would disturb the room or do not fit the request." },
    { difficulty: 2, sentence: "The mechanic replaced the worn brake ______ before the trip.", choices: ["pads", "sonnets", "tides", "passwords", "orchards"], answer: "pads", explanation: "Brake pads are the parts a mechanic replaces when brakes are worn. The other nouns are unrelated to brakes." },
    { difficulty: 2, sentence: "They packed a ______ so the sandwiches stayed cold.", choices: ["cooler", "compass", "trumpet", "invoice", "subway"], answer: "cooler", explanation: "A cooler keeps food cold. A compass, trumpet, invoice, or subway does not." },
    { difficulty: 2, sentence: "The gardener cut the ______ back so light could reach the lower leaves.", choices: ["hedge", "kettle", "receipt", "trumpet", "subway"], answer: "hedge", explanation: "A hedge is a plant a gardener cuts back. The other nouns are not plants in a garden bed." },
    { difficulty: 3, sentence: "The committee voted to ______ the meeting until the report arrived.", choices: ["postpone", "sharpen", "irrigate", "braid", "refund"], answer: "postpone", explanation: "To postpone a meeting is to hold it later. The other verbs do not delay a meeting." },
    { difficulty: 3, sentence: "The nurse wrote the patient's ______ on the chart.", choices: ["pulse", "luggage", "melody", "mortgage", "dialect"], answer: "pulse", explanation: "A pulse is a measurement a nurse records. The other nouns are not vital signs." },
    { difficulty: 3, sentence: "A kitchen ______ measures how heavy a bag of flour is.", choices: ["scale", "poem", "ferry", "lawsuit", "umbrella"], answer: "scale", explanation: "A scale measures weight. The other nouns do not measure how heavy something is." },
    { difficulty: 3, sentence: "The hikers stayed on the marked path so they would not ______ the moss.", choices: ["crush", "recite", "distill", "recruit", "applaud"], answer: "crush", explanation: "Stepping off the path would crush the moss. The other verbs do not describe that harm." },
    { difficulty: 4, sentence: "The editor asked the writer to ______ the last paragraph so the point was easier to see.", choices: ["clarify", "ignite", "transplant", "auction", "evaporate"], answer: "clarify", explanation: "Clarify means to make the point easier to understand. The other verbs do not improve a paragraph's meaning." },
    { difficulty: 4, sentence: "The town built a ramp so the entrance would be ______ for people using wheels.", choices: ["accessible", "fluorescent", "alphabetical", "airborne", "deciduous"], answer: "accessible", explanation: "A ramp makes an entrance accessible. The other adjectives do not describe that goal." },
    { difficulty: 4, sentence: "The chemist used a pipette to ______ a few drops into the beaker.", choices: ["transfer", "applaud", "harvest", "indict", "upholster"], answer: "transfer", explanation: "A pipette transfers a small amount of liquid. The other verbs are not lab measuring actions." },
    { difficulty: 5, sentence: "The witness was told to ______ the rumor and describe only what she had seen.", choices: ["ignore", "irrigate", "laminate", "deputize", "oxidize"], answer: "ignore", explanation: "She was told to leave the rumor out and report only what she saw. The other verbs do not mean that." },
    { difficulty: 5, sentence: "The analyst found a ______ because the total did not equal the sum of the rows.", choices: ["discrepancy", "harvest", "sonnet", "pulley", "monsoon"], answer: "discrepancy", explanation: "A discrepancy is a mismatch between numbers. The other nouns are not errors in a total." },
    { difficulty: 5, sentence: "The old chart is less ______ than the new survey of the same coastline.", choices: ["accurate", "knitted", "salaried", "toasted", "rhyming"], answer: "accurate", explanation: "A newer survey is the more accurate chart of the coastline. The other adjectives do not compare map quality." },
  ];

  function hashSeed(input) {
    if (typeof input === "number" && Number.isFinite(input)) return input >>> 0;
    const text = String(input);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  function shuffle(rng, list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy;
  }

  function pickDistinct(rng, pool, count) {
    return shuffle(rng, pool).slice(0, count);
  }

  function band(rng, difficulty, min, max, cap) {
    const grown = max + (difficulty - 1) * Math.max(1, Math.round((max - min) / 2));
    return randInt(rng, min, Math.min(cap, Math.max(min, grown)));
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const next = x % y;
      x = y;
      y = next;
    }
    return x || 1;
  }

  function titled(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  function fig(kind, rot, fill, count) {
    const rotational = kind === "arrow" || kind === "triangle";
    return { kind, rot: rotational ? rot : 0, fill, count };
  }

  function figureKey(figure) {
    return [figure.kind, figure.rot, figure.fill, figure.count].join(":");
  }

  function numericChoices(rng, answer, extras) {
    if (!Number.isInteger(answer) || answer < 0) throw new Error("Answer must be a non-negative integer");
    const wrong = [];
    const seeds = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer * 2, Math.floor(answer / 2)].concat(extras || []);
    for (const value of seeds) {
      if (!Number.isInteger(value) || value < 0 || value === answer || wrong.includes(value)) continue;
      wrong.push(value);
      if (wrong.length === 4) break;
    }
    let delta = 1;
    while (wrong.length < 4 && delta < 80) {
      for (const value of [answer + delta, answer - delta]) {
        if (value >= 0 && value !== answer && !wrong.includes(value)) wrong.push(value);
        if (wrong.length === 4) break;
      }
      delta++;
    }
    if (wrong.length < 4) throw new Error("Not enough numeric distractors");
    const values = shuffle(rng, [answer, ...wrong.slice(0, 4)]);
    return {
      choices: values.map(value => ({ text: String(value), key: String(value) })),
      answer: values.indexOf(answer),
    };
  }

  function textChoices(rng, correct, wrongs) {
    const unique = [];
    for (const wrong of wrongs) {
      if (!wrong || wrong === correct || unique.includes(wrong)) continue;
      unique.push(wrong);
    }
    if (unique.length < 4) throw new Error("Not enough text distractors for " + correct);
    const values = shuffle(rng, [correct, ...unique.slice(0, 4)]);
    return {
      choices: values.map(text => ({ text, key: text })),
      answer: values.indexOf(correct),
    };
  }

  function figureChoices(rng, correct, wrongs) {
    const values = shuffle(rng, [correct, ...wrongs]);
    const correctKey = figureKey(correct);
    return {
      choices: values.map(figure => ({ text: "", key: figureKey(figure), figure })),
      answer: values.findIndex(figure => figureKey(figure) === correctKey),
    };
  }

  function mathItem(type, rule, prompt, explanation, answer, meta, rng, extras) {
    const packed = numericChoices(rng, answer, extras);
    return {
      type,
      prompt,
      stimulus: null,
      explanation: `${explanation} Answer: ${answer}.`,
      meta: Object.assign({ rule, answer }, meta),
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  function logicItem(rule, prompt, explanation, correct, wrongs, meta, rng) {
    const packed = textChoices(rng, correct, wrongs);
    return {
      type: "syllogism",
      prompt,
      stimulus: null,
      explanation,
      meta: Object.assign({ rule, conclusion: correct }, meta),
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  function makeWord(rng, difficulty, variant) {
    const rule = ["sum", "diff", "product", "money", "rate", "leftover", "change", "twostep", "work"][variant % 9];
    if (rule === "sum") {
      const a = band(rng, difficulty, 12, 40, 120);
      const b = band(rng, difficulty, 6, 25, 80);
      const answer = a + b;
      return mathItem("word", rule, `A stand sold ${a} cups of tea in the morning and ${b} in the afternoon. How many cups were sold in total?`, `Add the two periods: ${a} + ${b} = ${answer}.`, answer, { a, b }, rng, [a, b, Math.abs(a - b)]);
    }
    if (rule === "diff") {
      const a = band(rng, difficulty, 18, 46, 90);
      const b = randInt(rng, 1, a - 1);
      const answer = a - b;
      return mathItem("word", rule, `A bin held ${a} bolts. A technician used ${b}. How many bolts are left in the bin?`, `Subtract the bolts that were used: ${a} - ${b} = ${answer}.`, answer, { a, b }, rng, [a, b, a + b]);
    }
    if (rule === "product") {
      const a = band(rng, difficulty, 3, 8, 14);
      const b = band(rng, difficulty, 4, 9, 16);
      const answer = a * b;
      return mathItem("word", rule, `A tray has ${a} rows of ${b} muffins. How many muffins are on the tray?`, `Multiply the rows by the muffins in each row: ${a} × ${b} = ${answer}.`, answer, { a, b }, rng, [a, b, a + b]);
    }
    if (rule === "money") {
      const a = band(rng, difficulty, 4, 12, 30);
      const b = band(rng, difficulty, 2, 8, 20);
      const c = band(rng, difficulty, 1, 4, 8);
      const d = band(rng, difficulty, 1, 4, 8);
      const answer = a * c + b * d;
      return mathItem("word", rule, `Adult tickets cost $${a} and child tickets cost $${b}. What is the cost of ${plural(c, "adult ticket")} and ${plural(d, "child ticket")}?`, `The adults cost ${a} × ${c} and the children cost ${b} × ${d}, so the total is ${answer}.`, answer, { a, b, c, d }, rng, [a * c, b * d, a + b, c + d]);
    }
    if (rule === "rate") {
      const rate = band(rng, difficulty, 3, 8, 15);
      let minutes = band(rng, difficulty, 2, 9, 20);
      if (minutes === rate) minutes += 1;
      const pages = rate * minutes;
      return mathItem("word", rule, `A printer produces ${rate} pages each minute. How many minutes does it need to produce ${pages} pages?`, `Divide the pages by the rate: ${pages} ÷ ${rate} = ${minutes}.`, minutes, { rate, pages }, rng, [rate, pages, pages * rate]);
    }
    if (rule === "leftover") {
      const k = band(rng, difficulty, 3, 7, 12);
      const boxes = band(rng, difficulty, 2, 6, 10);
      const leftover = randInt(rng, 1, k - 1);
      const n = boxes * k + leftover;
      return mathItem("word", rule, `${n} jars are packed with ${k} jars in each full box. How many jars are left over?`, `${boxes} full boxes use ${boxes * k} jars, and ${n} - ${boxes * k} = ${leftover}.`, leftover, { n, k }, rng, [boxes, k, n, boxes * k]);
    }
    if (rule === "change") {
      const price = band(rng, difficulty, 3, 9, 24);
      const qty = band(rng, difficulty, 2, 4, 8);
      const cost = price * qty;
      const bills = [20, 50, 100, 200].filter(bill => bill > cost);
      const bill = bills[randInt(rng, 0, bills.length - 1)];
      const answer = bill - cost;
      return mathItem("word", rule, `A buyer pays with a $${bill} note for ${plural(qty, "item")} at $${price} each. How many dollars of change are due?`, `The items cost ${price} × ${qty} = ${cost}. Change is ${bill} - ${cost} = ${answer}.`, answer, { bill, price, qty }, rng, [cost, bill, price, qty]);
    }
    if (rule === "twostep") {
      const s = band(rng, difficulty, 8, 20, 40);
      const r = band(rng, difficulty, 2, 6, 12);
      const h = band(rng, difficulty, 2, 4, 6);
      const t = randInt(rng, 1, s - 1);
      const answer = s + r * h - t;
      return mathItem("word", rule, `A shelf starts with ${s} books. A clerk adds ${r} books an hour for ${h} hours, then removes ${t} books. How many books are on the shelf?`, `The clerk adds ${r} × ${h} = ${r * h} books, then removes ${t}: ${s} + ${r * h} - ${t} = ${answer}.`, answer, { s, r, h, t }, rng, [s + r * h, s - t, r * h]);
    }
    const pairs = [];
    for (let a = 2; a <= 12; a++) {
      for (let b = a; b <= 16; b++) if ((a * b) % (a + b) === 0) pairs.push([a, b]);
    }
    const pair = pairs[randInt(rng, 0, pairs.length - 1)];
    const names = pickDistinct(rng, PEOPLE, 2);
    const answer = pair[0] * pair[1] / (pair[0] + pair[1]);
    return mathItem("word", "work", `${names[0]} finishes a job in ${pair[0]} hours. ${names[1]} finishes the same job in ${pair[1]} hours. Working together at those rates, how many hours do they need for one job?`, `Their rates add to 1/${pair[0]} + 1/${pair[1]} = ${(pair[0] + pair[1])}/${pair[0] * pair[1]} of the job per hour, so one job takes ${answer} hours.`, answer, { a: pair[0], b: pair[1] }, rng, [pair[0], pair[1], pair[0] + pair[1], pair[0] * pair[1]]);
  }

  function makeRatio(rng, difficulty, variant) {
    const rule = ["scale", "split", "mix"][variant % 3];
    const a = band(rng, difficulty, 2, 5, 9);
    let b = band(rng, difficulty, 3, 7, 12);
    if (b === a) b += 1;
    if (rule === "scale") {
      const k = band(rng, difficulty, 2, 6, 12);
      const n = a * k;
      const answer = b * k;
      return mathItem("ratio", rule, `The ratio of oak boards to pine boards is ${a}:${b}. There are ${n} oak boards. How many pine boards are there?`, `Each ${a} oak boards correspond to ${b} pine boards. ${n} ÷ ${a} × ${b} = ${answer}.`, answer, { a, b, n }, rng, [n, a, b, n + a]);
    }
    const parts = a + b;
    const k = band(rng, difficulty, 3, 8, 15);
    const total = parts * k;
    if (rule === "split") {
      const answer = Math.max(a, b) * k;
      return mathItem("ratio", rule, `A prize of $${total} is shared in the ratio ${a}:${b}. How many dollars does the larger share receive?`, `The shares are ${parts} equal parts of $${k}. The larger number of parts is ${Math.max(a, b)}, so that share is ${answer}.`, answer, { a, b, total }, rng, [total, Math.min(a, b) * k, k, a + b]);
    }
    const answer = a * k;
    return mathItem("ratio", "mix", `Red paint and blue paint are mixed in the ratio ${a}:${b}. How many liters of red paint are in a ${total}-liter batch?`, `The batch has ${parts} equal parts of ${k} liters. Red paint is ${a} of those parts, so it is ${answer} liters.`, answer, { a, b, total }, rng, [total, b * k, k, parts]);
  }

  function percentBase(rng, difficulty) {
    const rates = difficulty >= 5 ? [5, 10, 12, 15, 16, 20, 25, 40, 50] : difficulty >= 4 ? [5, 10, 15, 20, 25, 40, 50] : [5, 10, 20, 25, 50];
    const rate = rates[randInt(rng, 0, rates.length - 1)];
    const unit = 100 / gcd(rate, 100);
    let mult = randInt(rng, 2, 4 + difficulty * 2);
    let base = unit * mult;
    let guard = 0;
    while ((base === 100 || base === rate) && guard < 4) {
      mult += 1;
      base = unit * mult;
      guard++;
    }
    return { rate, base };
  }

  function makePercent(rng, difficulty, variant) {
    const rule = ["increase", "of", "discount", "reverse", "portion"][variant % 5];
    const picked = percentBase(rng, difficulty);
    const rate = picked.rate;
    const base = picked.base;
    if (rule === "increase") {
      const answer = base * (100 + rate) / 100;
      return mathItem("percent", rule, `A fare of $${base} rises by ${rate}%. What is the new fare in dollars?`, `${rate}% of ${base} is ${base * rate / 100}. Add that increase to the original fare.`, answer, { base, rate }, rng, [base, base * rate / 100, base - base * rate / 100]);
    }
    if (rule === "of") {
      const answer = base * rate / 100;
      return mathItem("percent", rule, `What is ${rate}% of ${base}?`, `${rate}% means ${rate}/100. ${base} × ${rate}/100 = ${answer}.`, answer, { base, rate }, rng, [base, rate, base + rate]);
    }
    if (rule === "discount") {
      const answer = base * (100 - rate) / 100;
      return mathItem("percent", rule, `A coat priced at $${base} is discounted by ${rate}%. What is the sale price in dollars?`, `The discount is ${base * rate / 100}. Subtract it from ${base}.`, answer, { base, rate }, rng, [base, base * rate / 100, base + base * rate / 100]);
    }
    if (rule === "reverse") {
      const sale = base * (100 - rate) / 100;
      return mathItem("percent", rule, `After a ${rate}% discount, a lamp costs $${sale}. What was the price before the discount?`, `The sale price is ${100 - rate}% of the original. ${sale} ÷ ${100 - rate} × 100 = ${base}.`, base, { sale, rate }, rng, [sale, rate, sale + rate]);
    }
    const part = base * rate / 100;
    return mathItem("percent", "portion", `${part} is what percent of ${base}?`, `${part} ÷ ${base} × 100 = ${rate}.`, rate, { part, whole: base }, rng, [part, base, 100 - rate, rate + 10]);
  }

  function makeSeries(rng, difficulty, variant) {
    const rule = ["arith", "geo", "square", "fib", "alt", "accel"][variant % 6];
    let seq;
    let answer;
    let meta;
    let because;
    if (rule === "arith") {
      const start = band(rng, difficulty, 3, 18, 40);
      const diff = band(rng, difficulty, 2, 7, 14);
      seq = Array.from({ length: 6 }, (_, i) => start + i * diff);
      meta = { start, diff };
      because = `Each number increases by ${diff}.`;
    } else if (rule === "geo") {
      const start = randInt(rng, 2, difficulty > 3 ? 4 : 3);
      const ratio = difficulty > 3 && rng() < 0.5 ? 3 : 2;
      seq = Array.from({ length: 6 }, (_, i) => start * ratio ** i);
      meta = { start, ratio };
      because = `Each number is multiplied by ${ratio}.`;
    } else if (rule === "square") {
      const start = band(rng, difficulty, 1, 4, 8);
      const add = randInt(rng, 0, difficulty > 2 ? 4 : 2);
      seq = Array.from({ length: 6 }, (_, i) => (start + i) ** 2 + add);
      meta = { start, add };
      because = add ? `These are squares of ${start} onward, each increased by ${add}.` : `These are consecutive squares starting at ${start}².`;
    } else if (rule === "fib") {
      const a = randInt(rng, 1, 4 + difficulty);
      const b = randInt(rng, 1, 4 + difficulty);
      seq = [a, b];
      while (seq.length < 6) seq.push(seq[seq.length - 2] + seq[seq.length - 1]);
      meta = { a, b };
      because = "Each number is the sum of the two numbers before it.";
    } else if (rule === "alt") {
      const start = band(rng, difficulty, 3, 15, 30);
      const p = band(rng, difficulty, 2, 6, 11);
      let q = band(rng, difficulty, 3, 8, 13);
      if (q === p) q += 1;
      const diffs = [p, q, p, q, p];
      seq = [start];
      for (const diff of diffs) seq.push(seq[seq.length - 1] + diff);
      meta = { start, p, q };
      because = `The differences alternate between ${p} and ${q}.`;
    } else {
      const start = band(rng, difficulty, 2, 12, 24);
      const first = band(rng, difficulty, 2, 5, 9);
      const step = randInt(rng, 1, difficulty > 3 ? 4 : 3);
      seq = [start];
      for (let i = 0; i < 5; i++) seq.push(seq[seq.length - 1] + first + i * step);
      meta = { start, first, step };
      because = `The differences start at ${first} and grow by ${step} each time.`;
    }
    answer = seq[5];
    const shown = seq.slice(0, 5);
    return mathItem("series", rule, `What number comes next: ${shown.join(", ")}?`, `${because} The next number is ${answer}.`, answer, meta, rng, [shown[4], shown[0], answer + (meta.diff || meta.ratio || meta.step || 2)]);
  }

  function makeSyllogism(rng, difficulty, variant) {
    const rule = ["chain", "none", "tollens", "exactly", "order"][variant % 5];
    if (rule === "chain") {
      const names = pickDistinct(rng, SETS, 3);
      const person = pickDistinct(rng, PEOPLE, 1)[0];
      const correct = `${person}'s badge belongs to ${names[2]}.`;
      return logicItem(rule, `Every ${names[0]} badge belongs to ${names[1]}. Every ${names[1]} badge belongs to ${names[2]}. ${person}'s badge belongs to ${names[0]}. Which of the following must be true?`, `${person}'s badge starts in ${names[0]}, so it also belongs to ${names[1]} and then to ${names[2]}. The reverse, that every ${names[2]} badge belongs to ${names[0]}, does not follow.`, correct, [
        `${person}'s badge does not belong to ${names[2]}.`,
        `Every ${names[2]} badge belongs to ${names[0]}.`,
        `${person}'s badge does not belong to ${names[1]}.`,
        `No ${names[0]} badge belongs to ${names[1]}.`,
      ], { person, a: names[0], b: names[1], c: names[2] }, rng);
    }
    if (rule === "none") {
      const names = pickDistinct(rng, SETS, 3);
      const correct = `No ${names[2]} badge belongs to ${names[1]}.`;
      return logicItem(rule, `No ${names[0]} badge belongs to ${names[1]}. Every ${names[2]} badge belongs to ${names[0]}. Which of the following must be true?`, `Every ${names[2]} badge is a ${names[0]} badge, and no ${names[0]} badge belongs to ${names[1]}. So no ${names[2]} badge belongs to ${names[1]}.`, correct, [
        `A ${names[2]} badge belongs to ${names[1]}.`,
        `Every ${names[1]} badge belongs to ${names[2]}.`,
        `No ${names[0]} badge belongs to ${names[2]}.`,
        `Every ${names[2]} badge belongs to ${names[1]}.`,
      ], { a: names[0], b: names[1], c: names[2] }, rng);
    }
    if (rule === "tollens") {
      const pair = LOCKS[randInt(rng, 0, LOCKS.length - 1)];
      const correct = `The ${pair[0]} is not locked.`;
      return logicItem(rule, `If the ${pair[0]} is locked, then the ${pair[1]} is on. The ${pair[1]} is off. Which of the following must be true?`, `The ${pair[1]} is off, so the rule "if locked, then on" means the ${pair[0]} cannot be locked.`, correct, [
        `The ${pair[0]} is locked.`,
        `The ${pair[1]} is on.`,
        `The ${pair[0]} is locked and the ${pair[1]} is on.`,
        `The ${pair[1]} being off locks the ${pair[0]}.`,
      ], { thing: pair[0], lamp: pair[1] }, rng);
    }
    if (rule === "exactly") {
      const names = pickDistinct(rng, CRATES, 3);
      const correct = `The ${names[2]} crate holds the spare key.`;
      return logicItem(rule, `Exactly one crate holds the spare key: ${names[0]}, ${names[1]}, or ${names[2]}. The ${names[0]} crate does not hold it. The ${names[1]} crate does not hold it. Which of the following must be true?`, `The ${names[0]} and ${names[1]} crates are ruled out. Exactly one crate holds the key, so it is the ${names[2]} crate.`, correct, [
        `The ${names[0]} crate holds the spare key.`,
        `The ${names[1]} crate holds the spare key.`,
        `The ${names[0]}, ${names[1]}, and ${names[2]} crates all hold the spare key.`,
        "None of the crates hold the spare key.",
      ], { x: names[0], y: names[1], z: names[2] }, rng);
    }
    const names = pickDistinct(rng, PEOPLE, 4);
    const correct = `${names[0]} finishes first.`;
    return logicItem("order", `Four runners — ${names[0]}, ${names[1]}, ${names[2]}, and ${names[3]} — finish in a strict order, with no ties. ${names[0]} finishes before ${names[1]}. ${names[1]} finishes before ${names[2]}. ${names[3]} finishes after ${names[2]}. Which of the following must be true?`, `${names[0]} is before ${names[1]}, ${names[1]} is before ${names[2]}, and ${names[2]} is before ${names[3]}. ${names[0]} finishes first.`, correct, [
      `${names[1]} finishes first.`,
      `${names[2]} finishes first.`,
      `${names[3]} finishes first.`,
      `${names[2]} finishes last.`,
    ], { people: names, befores: [[names[0], names[1]], [names[1], names[2]], [names[2], names[3]]] }, rng);
  }

  function nearest(list, difficulty, levelOf) {
    let best = Infinity;
    for (const entry of list) best = Math.min(best, Math.abs(levelOf(entry) - difficulty));
    return list.filter(entry => Math.abs(levelOf(entry) - difficulty) === best);
  }

  function makeAnalogy(rng, difficulty) {
    const relation = nearest(RELATIONS, difficulty, entry => entry.level)[randInt(rng, 0, nearest(RELATIONS, difficulty, entry => entry.level).length - 1)];
    const picked = pickDistinct(rng, relation.pairs, 2);
    const left = picked[0];
    const right = picked[1];
    const banned = new Set(relation.pairs.map(pair => pair[1]));
    const pool = [];
    for (const other of RELATIONS) {
      if (other.id === relation.id) continue;
      for (const pair of other.pairs) if (!banned.has(pair[1]) && !pool.includes(pair[1])) pool.push(pair[1]);
    }
    const wrongs = shuffle(rng, pool).slice(0, 4).map(titled);
    const correct = titled(right[1]);
    const packed = textChoices(rng, correct, wrongs);
    const sentence = (pair) => {
      const text = relation.phrase(pair[0], pair[1]);
      return text.charAt(0).toUpperCase() + text.slice(1);
    };
    return {
      type: "analogy",
      prompt: `${titled(left[0])} is to ${left[1]} as ${titled(right[0])} is to ____.`,
      stimulus: null,
      explanation: `${sentence(left)}. In the same way, ${sentence(right).charAt(0).toLowerCase()}${sentence(right).slice(1)}.`,
      meta: { rule: "analogy", relation: relation.id, left, right },
      choices: packed.choices.map(choice => ({ text: choice.text, key: choice.text.toLowerCase() })),
      answer: packed.answer,
    };
  }

  function makeLexical(rng, difficulty, variant) {
    const ask = variant % 2 === 0 ? "synonym" : "antonym";
    const leveled = LEX.map((entry, index) => ({ entry, level: Math.max(1, Math.min(5, Math.ceil((index + 1) / 4))) }));
    const pool = nearest(leveled, difficulty, row => row.level);
    const entry = pool[randInt(rng, 0, pool.length - 1)].entry;
    const correct = ask === "synonym" ? entry.syn : entry.ant;
    const opposite = ask === "synonym" ? entry.ant : entry.syn;
    const decoys = shuffle(rng, entry.decoys).slice(0, 3);
    const packed = textChoices(rng, correct, [opposite, ...decoys]);
    const prompt = ask === "synonym"
      ? `Which word is closest in meaning to ${entry.word.toUpperCase()}?`
      : `Which word is most nearly the opposite of ${entry.word.toUpperCase()}?`;
    const explanation = ask === "synonym"
      ? `${titled(entry.syn)} means nearly the same as ${entry.word}. ${titled(entry.ant)} is an opposite, so it does not fit.`
      : `${titled(entry.ant)} is an opposite of ${entry.word}. ${titled(entry.syn)} has a similar meaning, so it does not fit.`;
    return {
      type: "lexical",
      prompt,
      stimulus: null,
      explanation,
      meta: { rule: ask, word: entry.word, syn: entry.syn, ant: entry.ant, decoys: entry.decoys },
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  function makeCloze(rng, difficulty) {
    const pool = nearest(CLOZE, difficulty, entry => entry.difficulty);
    const entry = pool[randInt(rng, 0, pool.length - 1)];
    const packed = textChoices(rng, entry.answer, entry.choices.filter(choice => choice !== entry.answer));
    return {
      type: "cloze",
      prompt: entry.sentence,
      stimulus: null,
      explanation: entry.explanation,
      meta: { rule: "cloze", answer: entry.answer, sentence: entry.sentence },
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

  function otherChar(rng, current) {
    const start = randInt(rng, 0, CODE_ALPHABET.length - 1);
    for (let step = 0; step < CODE_ALPHABET.length; step++) {
      const next = CODE_ALPHABET[(start + step) % CODE_ALPHABET.length];
      if (next !== current) return next;
    }
    return current === "A" ? "B" : "A";
  }

  function codeOf(rng, length) {
    let out = "";
    for (let i = 0; i < length; i++) out += CODE_ALPHABET[randInt(rng, 0, CODE_ALPHABET.length - 1)];
    return out;
  }

  function letters(rng, count) {
    let out = "";
    for (let i = 0; i < count; i++) out += LETTERS[randInt(rng, 0, LETTERS.length - 1)];
    return out;
  }

  function digits(rng, count) {
    let out = "";
    for (let i = 0; i < count; i++) out += String(randInt(rng, 0, 9));
    return out;
  }

  function mutateCode(rng, code) {
    const chars = code.split("");
    const i = randInt(rng, 0, chars.length - 1);
    const j = randInt(rng, 0, chars.length - 1);
    if (i !== j && rng() < 0.5) {
      const swap = chars[i];
      chars[i] = chars[j];
      chars[j] = swap;
    }
    if (chars.join("") === code) chars[i] = otherChar(rng, chars[i]);
    if (chars.join("") === code) chars[(i + 1) % chars.length] = otherChar(rng, chars[(i + 1) % chars.length]);
    return chars.join("");
  }

  function makeDetail(rng, difficulty, variant) {
    const rule = ["exact", "hamming", "pattern"][variant % 3];
    if (rule === "exact") {
      const length = 5 + Math.min(4, difficulty);
      const code = codeOf(rng, length);
      const wrong = [];
      let guard = 0;
      while (wrong.length < 4 && guard < 40) {
        const next = mutateCode(rng, code);
        if (next !== code && next.length === code.length && !wrong.includes(next)) wrong.push(next);
        guard++;
      }
      if (wrong.length < 4) throw new Error("Could not mutate a code");
      const packed = textChoices(rng, code, wrong);
      return {
        type: "detail",
        prompt: "Which option matches this code exactly?",
        stimulus: { kind: "code", text: code },
        explanation: `Only one option copies ${code} character for character. The others change or swap a character.`,
        meta: { rule, code },
        choices: packed.choices,
        answer: packed.answer,
      };
    }
    if (rule === "hamming") {
      const length = 6 + Math.min(3, difficulty);
      const left = codeOf(rng, length);
      const distance = randInt(rng, 1, Math.min(4, length - 1));
      const indexes = shuffle(rng, Array.from({ length }, (_, index) => index)).slice(0, distance);
      const chars = left.split("");
      for (const index of indexes) chars[index] = otherChar(rng, chars[index]);
      const right = chars.join("");
      const pool = [];
      for (let value = 0; value <= length; value++) if (value !== distance) pool.push(String(value));
      const packed = textChoices(rng, String(distance), shuffle(rng, pool).slice(0, 4));
      return {
        type: "detail",
        prompt: "How many character positions differ between these two codes?",
        stimulus: { kind: "pair", left, right },
        explanation: `${distance} position${distance === 1 ? "" : "s"} differ. Compare the codes one character at a time.`,
        meta: { rule, left, right },
        choices: packed.choices,
        answer: packed.answer,
      };
    }
    const pattern = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;
    const codes = [];
    let guard = 0;
    while (codes.length < 4 && guard < 40) {
      const code = `${letters(rng, 2)}-${digits(rng, 3)}-${letters(rng, 2)}`;
      if (!codes.includes(code)) codes.push(code);
      guard++;
    }
    let bad = "";
    guard = 0;
    while (guard < 20) {
      const kind = randInt(rng, 0, 3);
      const head = letters(rng, 2);
      const tail = letters(rng, 2);
      const mid = digits(rng, 3);
      if (kind === 0) bad = `${head}${mid}-${tail}`;
      else if (kind === 1) bad = `${head}-${mid}${randInt(rng, 0, 9)}-${tail}`;
      else if (kind === 2) bad = `${head}-${digits(rng, 2)}${letters(rng, 1)}-${tail}`;
      else bad = `${letters(rng, 3)}-${mid}-${tail}`;
      if (!codes.includes(bad) && !pattern.test(bad)) break;
      guard++;
    }
    if (codes.includes(bad) || pattern.test(bad)) throw new Error("Could not build a pattern-breaking code");
    const packed = textChoices(rng, bad, codes);
    return {
      type: "detail",
      prompt: "Which code does not match the pattern of two letters, a dash, three digits, a dash, and two letters?",
      stimulus: null,
      explanation: `${bad} breaks the pattern. The other codes are two letters, three digits, and two letters, separated by dashes.`,
      meta: { rule },
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  function seriesFrames(meta) {
    if (meta.rule === "cycle") return Array.from({ length: 5 }, (_, i) => fig(meta.kinds[i % meta.kinds.length], 0, meta.fill, meta.count));
    if (meta.rule === "rotate") return Array.from({ length: 5 }, (_, i) => fig("arrow", (meta.start + i * 90) % 360, meta.fill, meta.count));
    if (meta.rule === "grow") return Array.from({ length: 5 }, (_, i) => fig(meta.kind, 0, meta.fill, i + 1));
    return Array.from({ length: 5 }, (_, i) => fig(meta.kinds[i % 2], 0, meta.fills[i % 2], meta.count));
  }

  function shapeName(kind, count) {
    return `${count === 1 ? "a" : count} ${kind}${count === 1 ? "" : "s"}`;
  }

  function makeShapeSeries(rng, difficulty, variant) {
    const rule = ["cycle", "rotate", "grow", "alternate"][variant % 4];
    const fill = rng() < 0.7 ? "solid" : "none";
    const count = 1;
    let meta;
    let because;
    if (rule === "cycle") {
      meta = { rule, kinds: pickDistinct(rng, KINDS, 3), fill, count };
      because = `The shapes repeat every three steps: ${meta.kinds.join(", ")}. The next shape continues that cycle.`;
    } else if (rule === "rotate") {
      meta = { rule, start: [0, 90, 180, 270][randInt(rng, 0, 3)], fill, count };
      because = "The arrow turns 90 degrees clockwise each step. After a full turn, the next arrow matches the first direction.";
    } else if (rule === "grow") {
      meta = { rule, kind: KINDS[randInt(rng, 0, KINDS.length - 1)], fill };
      because = `One shape is added each step. After four, the next figure has five ${meta.kind}s.`;
    } else {
      const kinds = pickDistinct(rng, KINDS, 2);
      meta = { rule, kinds, fills: ["solid", "none"], count };
      because = `The shape alternates between ${kinds[0]} and ${kinds[1]}, and the fill alternates between solid and outline. The next figure matches the first on both.`;
    }
    const frames = seriesFrames(meta);
    const correct = frames[4];
    let wrongs;
    if (rule === "cycle") {
      const outsider = KINDS.find(kind => !meta.kinds.includes(kind));
      const otherFill = meta.fill === "solid" ? "none" : "solid";
      wrongs = meta.kinds.filter(kind => kind !== correct.kind).map(kind => fig(kind, 0, meta.fill, meta.count));
      wrongs.push(fig(correct.kind, 0, otherFill, meta.count), fig(outsider, 0, meta.fill, meta.count));
    } else if (rule === "rotate") {
      const otherFill = meta.fill === "solid" ? "none" : "solid";
      wrongs = [0, 90, 180, 270].filter(rot => rot !== correct.rot).map(rot => fig("arrow", rot, meta.fill, meta.count));
      wrongs.push(fig("arrow", correct.rot, otherFill, meta.count));
    } else if (rule === "grow") {
      wrongs = [1, 2, 3, 4].map(count => fig(meta.kind, 0, meta.fill, count));
    } else {
      const outsider = KINDS.find(kind => !meta.kinds.includes(kind));
      wrongs = [
        fig(meta.kinds[0], 0, "none", meta.count),
        fig(meta.kinds[1], 0, "solid", meta.count),
        fig(meta.kinds[1], 0, "none", meta.count),
        fig(outsider, 0, "solid", meta.count),
      ];
    }
    const packed = figureChoices(rng, correct, wrongs);
    return {
      type: "series",
      prompt: "Which figure comes next in the series?",
      stimulus: { kind: "series", frames: frames.slice(0, 4) },
      explanation: because,
      meta,
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  function matrixCells(meta) {
    const cells = [];
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        if (meta.rule === "sumgrid") cells.push(fig(meta.kind, 0, "solid", row + column + 1));
        else if (meta.rule === "latin") cells.push(fig(meta.symbols[(row + column + meta.shift) % 3], 0, "solid", 1));
        else cells.push(fig("arrow", column * 90, meta.fill, row + 1));
      }
    }
    return cells;
  }

  function makeMatrix(rng, difficulty, variant) {
    const rule = ["sumgrid", "latin", "turngrid"][variant % 3];
    let meta;
    let because;
    if (rule === "sumgrid") {
      meta = { rule, kind: KINDS[randInt(rng, 0, KINDS.length - 1)] };
      because = `Every cell uses the same shape. Its count is the row number plus the column number, counting from 1, so the bottom-right cell has 5.`;
    } else if (rule === "latin") {
      meta = { rule, symbols: pickDistinct(rng, KINDS, 3), shift: randInt(rng, 0, 2) };
      const answerKind = meta.symbols[(2 + 2 + meta.shift) % 3];
      because = `Each row and each column contains each shape once. The missing shape is the ${answerKind}.`;
    } else {
      meta = { rule, fill: ["solid", "none", "stripe"][randInt(rng, 0, 2)] };
      because = "Across each row, the arrows turn 90 degrees clockwise per column. Down each column, one arrow is added per row. The bottom-right cell has 3 arrows pointing down.";
    }
    const cells = matrixCells(meta);
    const correct = cells[8];
    let wrongs;
    if (rule === "sumgrid") wrongs = [1, 2, 3, 4].map(count => fig(meta.kind, 0, "solid", count));
    else if (rule === "latin") wrongs = shuffle(rng, KINDS.filter(kind => kind !== correct.kind)).slice(0, 4).map(kind => fig(kind, 0, "solid", 1));
    else wrongs = [0, 90, 270].map(rot => fig("arrow", rot, meta.fill, 3)).concat([fig("arrow", 180, meta.fill, 2)]);
    const packed = figureChoices(rng, correct, wrongs);
    return {
      type: "matrix",
      prompt: "Which figure belongs in the empty cell?",
      stimulus: { kind: "matrix", cells: cells.slice(0, 8).concat([null]) },
      explanation: because,
      meta,
      choices: packed.choices,
      answer: packed.answer,
    };
  }

  function describeFigure(figure) {
    const facing = { 0: "up", 90: "right", 180: "down", 270: "left" }[figure.rot] || "up";
    const fill = figure.fill === "solid" ? "solid" : figure.fill === "none" ? "outline" : "striped";
    const noun = figure.count === 1 ? figure.kind : `${figure.kind}s`;
    const direction = figure.kind === "arrow" || figure.kind === "triangle" ? ` pointing ${facing}` : "";
    return `${figure.count} ${fill} ${noun}${direction}`;
  }

  function makeOdd(rng, difficulty, variant) {
    const rule = ["shape", "rotate", "fill", "count"][variant % 4];
    let kind = KINDS[randInt(rng, 0, KINDS.length - 1)];
    if (rule === "rotate") kind = "arrow";
    const fill = rule === "fill" ? "solid" : (rng() < 0.5 ? "solid" : "none");
    const count = rule === "count" ? 2 : 1 + (difficulty > 3 ? randInt(rng, 0, 2) : 0);
    const common = fig(kind, 0, fill, count);
    let odd;
    if (rule === "shape") {
      const others = KINDS.filter(name => name !== common.kind);
      odd = fig(others[randInt(rng, 0, others.length - 1)], 0, common.fill, common.count);
    } else if (rule === "rotate") odd = fig("arrow", 180, common.fill, common.count);
    else if (rule === "fill") odd = fig(common.kind, common.rot, "stripe", common.count);
    else odd = fig(common.kind, common.rot, common.fill, 4);
    const answer = randInt(rng, 0, 4);
    const figures = Array.from({ length: 5 }, (_, index) => index === answer ? odd : common);
    return {
      type: "odd",
      prompt: "Which figure does not belong with the others?",
      stimulus: null,
      explanation: `Four figures show ${describeFigure(common)}. The different figure shows ${describeFigure(odd)}.`,
      meta: { rule, common, odd },
      choices: figures.map(figure => ({ text: "", key: figureKey(figure), figure })),
      answer,
    };
  }

  const MAKERS = {
    "math:word": makeWord,
    "math:ratio": makeRatio,
    "math:percent": makePercent,
    "math:series": makeSeries,
    "math:syllogism": makeSyllogism,
    "verbal:analogy": makeAnalogy,
    "verbal:lexical": makeLexical,
    "verbal:cloze": makeCloze,
    "verbal:detail": makeDetail,
    "spatial:series": makeShapeSeries,
    "spatial:matrix": makeMatrix,
    "spatial:odd": makeOdd,
  };

  function fingerprint(item) {
    const bits = [item.area, item.type, item.prompt];
    const stimulus = item.stimulus;
    if (stimulus) {
      if (stimulus.frames) bits.push(stimulus.frames.map(figureKey).join("."));
      if (stimulus.cells) bits.push(stimulus.cells.map(cell => cell ? figureKey(cell) : "_").join("."));
      if (stimulus.text) bits.push(stimulus.text);
      if (stimulus.left) bits.push(stimulus.left + "~" + stimulus.right);
    }
    bits.push(item.choices.map(choice => choice.key).join("|"), String(item.answer));
    return bits.join("||");
  }

  function ramp(index, count, rng) {
    const t = count === 1 ? 0 : index / (count - 1);
    const jitter = (rng() - 0.5) * 1.2;
    return Math.max(1, Math.min(5, Math.round(1 + t * 4 + jitter)));
  }

  function interleave(rng) {
    const left = { math: 18, verbal: 16, spatial: 16 };
    const seq = [];
    while (seq.length < 50) {
      const previous = seq[seq.length - 1];
      let options = ["math", "verbal", "spatial"].filter(area => left[area] > 0 && area !== previous);
      if (!options.length) options = ["math", "verbal", "spatial"].filter(area => left[area] > 0);
      const waiting = {};
      for (const area of options) {
        let gap = 0;
        for (let i = seq.length - 1; i >= 0 && seq[i] !== area; i--) gap++;
        waiting[area] = gap;
      }
      const longest = Math.max(...options.map(area => waiting[area]));
      options = options.filter(area => waiting[area] === longest);
      const most = Math.max(...options.map(area => left[area]));
      options = options.filter(area => left[area] === most);
      const area = options[Math.floor(rng() * options.length)];
      seq.push(area);
      left[area]--;
    }
    return seq;
  }

  function paceOf(value) {
    if (value == null) return 18;
    if (!Number.isInteger(value) || value < 8 || value > 90) throw new RangeError("Drill pace must be an integer from 8 to 90 seconds");
    return value;
  }

  function buildTest(options) {
    const settings = options || {};
    const kind = settings.kind === "drill" ? "drill" : "mock";
    const area = kind === "drill" ? settings.area : null;
    if (kind === "drill" && !AREAS.includes(area)) throw new Error("A drill needs math, spatial, or verbal");
    const seed = hashSeed(settings.seed == null ? 1 : settings.seed);
    const rng = mulberry32(seed);
    const count = kind === "drill" ? 10 : 50;
    const pace = kind === "drill" ? paceOf(settings.secondsPerQuestion) : null;
    const areas = kind === "drill" ? Array.from({ length: count }, () => area) : interleave(rng);
    const seen = {};
    const used = new Set();
    const items = areas.map((itemArea, index) => {
      const difficulty = ramp(index, count, rng);
      const type = TYPES[itemArea][seen[itemArea] || 0];
      seen[itemArea] = ((seen[itemArea] || 0) + 1) % TYPES[itemArea].length;
      const key = itemArea + ":" + type;
      let item;
      let guard = 0;
      do {
        item = MAKERS[key](rng, difficulty, Math.floor(index / TYPES[itemArea].length) + guard);
        item.area = itemArea;
        item.type = type;
        item.difficulty = difficulty;
        item.dedupe = fingerprint(item);
        guard++;
      } while (used.has(item.dedupe) && guard < 8);
      used.add(item.dedupe);
      return item;
    });
    return {
      seed,
      kind,
      area,
      count,
      durationMs: kind === "drill" ? count * pace * 1000 : MOCK_MS,
      secondsPerQuestion: pace,
      items,
    };
  }

  function sampleItem(area, type, difficulty, seed, variant) {
    const item = MAKERS[area + ":" + type](mulberry32(hashSeed(seed)), difficulty, variant || 0);
    item.area = area;
    item.type = type;
    item.difficulty = difficulty;
    item.dedupe = fingerprint(item);
    return item;
  }

  function catalog() {
    return {
      families: Object.keys(MAKERS).length,
      mathTemplates: 9 + 3 + 5 + 6 + 5,
      spatialRules: 4 + 3 + 4,
      analogyRelations: RELATIONS.length,
      analogyPairs: RELATIONS.reduce((total, relation) => total + relation.pairs.length, 0),
      lexicalEntries: LEX.length,
      clozeItems: CLOZE.length,
      detailKinds: 3,
    };
  }

  return {
    AREAS,
    TYPES,
    MOCK_MS,
    buildTest,
    sampleItem,
    catalog,
    fingerprint,
    figureKey,
    banks: { CLOZE, LEX, RELATIONS },
  };
});
