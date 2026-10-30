// Curated relationships, not a fixed sequence of questions. Keep each analogy's
// direction consistent and each right-hand word unique within its relationship.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMQVerbalData = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => ({
  synonyms: [
    [1, ["quick", "rapid", "fast"]], [1, ["begin", "start", "commence"]],
    [1, ["help", "assist", "aid"]], [1, ["large", "big", "huge"]],
    [1, ["small", "tiny", "little"]], [1, ["happy", "glad", "joyful"]],
    [2, ["purchase", "buy"]], [2, ["select", "choose", "pick"]],
    [2, ["construct", "build"]], [2, ["depart", "leave"]],
    [2, ["honest", "truthful", "sincere"]], [2, ["necessary", "essential", "required"]],
    [3, ["obsolete", "outdated"]], [3, ["scarcity", "shortage"]],
    [3, ["reluctant", "unwilling"]], [3, ["elated", "delighted", "jubilant"]],
    [3, ["melancholy", "sad", "sorrowful"]], [3, ["obtain", "acquire"]],
    [4, ["meticulous", "painstaking"]], [4, ["dormant", "inactive"]],
    [4, ["perplex", "confuse", "bewilder"]], [4, ["hostile", "antagonistic"]],
    [4, ["concise", "succinct"]], [4, ["ample", "plentiful", "abundant"]],
    [5, ["abate", "subside"]], [5, ["ameliorate", "improve"]],
    [5, ["exacerbate", "worsen"]], [5, ["taciturn", "reticent"]],
    [5, ["ephemeral", "transient", "fleeting"]], [5, ["elucidate", "clarify"]]
  ],
  opposites: [
    [1, "increase", "decrease"], [1, "accept", "reject"], [1, "victory", "defeat"],
    [1, "entrance", "exit"], [1, "up", "down"], [1, "left", "right"],
    [2, "expand", "contract"], [2, "include", "exclude"], [2, "permit", "forbid"],
    [2, "reveal", "conceal"], [2, "temporary", "permanent"], [2, "ascend", "descend"],
    [3, "optimistic", "pessimistic"], [3, "mandatory", "optional"],
    [3, "transparent", "opaque"], [3, "rigid", "flexible"],
    [3, "surplus", "shortage"], [3, "advance", "retreat"],
    [4, "synthetic", "natural"], [4, "volatile", "stable"],
    [4, "literal", "figurative"], [4, "abstract", "concrete"],
    [4, "inferior", "superior"], [4, "diligent", "lazy"],
    [5, "garrulous", "taciturn"], [5, "benevolent", "malevolent"],
    [5, "prodigal", "thrifty"], [5, "recalcitrant", "obedient"],
    [5, "placid", "turbulent"], [5, "candid", "guarded"]
  ],
  other: [
    [1, "lock", "key"], [1, "knife", "fork"], [1, "salt", "pepper"],
    [1, "sun", "moon"], [1, "cat", "dog"], [1, "pen", "paper"],
    [2, "thunder", "lightning"], [2, "teacher", "student"], [2, "doctor", "patient"],
    [2, "question", "answer"], [2, "bread", "butter"], [2, "wheel", "road"],
    [3, "symptom", "disease"], [3, "goal", "plan"], [3, "income", "wealth"],
    [3, "price", "value"], [3, "library", "reader"], [3, "seed", "soil"],
    [4, "climate", "weather"], [4, "revenue", "profit"], [4, "urgent", "important"],
    [4, "legal", "ethical"], [4, "strategy", "tactic"], [4, "belief", "knowledge"],
    [5, "mass", "weight"], [5, "accuracy", "validity"], [5, "data", "evidence"],
    [5, "map", "territory"], [5, "hypothesis", "experiment"], [5, "correlation", "causation"]
  ],
  analogies: [
    [1, "young animal → adult", [["puppy","dog"],["kitten","cat"],["lamb","sheep"],["foal","horse"],["duckling","duck"],["gosling","goose"],["piglet","pig"]]],
    [1, "body part → covering", [["hand","glove"],["foot","shoe"],["head","hat"],["leg","trouser"],["finger","thimble"],["neck","scarf"]]],
    [2, "animal → home", [["bird","nest"],["bee","hive"],["spider","web"],["horse","stable"],["dog","kennel"],["pig","sty"]]],
    [2, "worker → tool", [["painter","brush"],["sculptor","chisel"],["carpenter","saw"],["tailor","needle"],["woodcutter","axe"],["gardener","rake"]]],
    [3, "instrument → measured quantity", [["thermometer","temperature"],["clock","time"],["barometer","pressure"],["hygrometer","humidity"],["odometer","distance"],["altimeter","altitude"],["speedometer","speed"]]],
    [3, "collection → contents", [["library","books"],["archive","documents"],["arsenal","weapons"],["herd","cattle"],["flock","sheep"],["fleet","ships"],["bouquet","flowers"]]],
    [4, "specialist → subject of study", [["botanist","plants"],["zoologist","animals"],["geologist","rocks"],["entomologist","insects"],["ornithologist","birds"],["ichthyologist","fish"]]],
    [4, "adjective → something lacking", [["insipid","flavour"],["monotonous","variety"],["arid","moisture"],["destitute","wealth"],["apathetic","interest"],["lethargic","energy"]]],
    [5, "verb → synonym", [["ameliorate","improve"],["exacerbate","worsen"],["elucidate","clarify"],["obfuscate","confuse"],["castigate","criticise"],["venerate","revere"],["placate","soothe"]]],
    [5, "adjective → opposite", [["garrulous","taciturn"],["ostentatious","modest"],["recalcitrant","obedient"],["prodigal","thrifty"],["placid","turbulent"],["ephemeral","permanent"],["benevolent","malevolent"]]]
  ]
}));
