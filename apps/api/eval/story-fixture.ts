/**
 * A short story with known continuity errors, for measuring Story Memory.
 * Each planted contradiction says which entity and detail should be flagged.
 * The story also contains changes that are NOT errors (time passing, a death,
 * a haircut); flagging those counts as a false alarm.
 */

export interface PlantedContradiction {
  description: string;
  /** Matches a warning whose entity name contains this (case-insensitive) */
  entity: string;
  /** ...and whose two values contain one of these words each */
  values: [string[], string[]];
}

export const BOOK = {
  title: "The Salt Road",
  genre: "Literary fiction",
  premise:
    "On the Isle of Islay in the 1980s, sixteen-year-old Isla Ross holds her family together " +
    "after her grandmother's death, until a storm forces her to take her father's boat out alone.",
};

export const CHAPTERS: { title: string; content: string }[] = [
  {
    title: "The Village",
    content: `Isla Ross was sixteen the summer the herring came back. She lived in Portnahaven, a huddle of white cottages on the west coast of Islay, where the Atlantic arrived without warning and left the same way.

Her father, Ruaridh Ross, was a fisherman, out before light and home after dark, his hands cracked from rope and salt. Her mother had died when Isla was small, and the house belonged, in every way that mattered, to her grandmother Agnes, who still baked bread every morning at eighty-one.

Isla had her mother's green eyes, everyone said so, usually right before they said something kind and sad.

Her brother Finn was twelve, sandy-haired and all elbows, and he followed her everywhere that summer, asking questions about the sea that she could not answer.`,
  },
  {
    title: "The Kittiwake",
    content: `Their father's boat was the Kittiwake, a blue-hulled creel boat with a wheelhouse barely big enough for one. Isla had learned to steer her before she could ride a bicycle.

On Saturdays she mended creels on the pier while Finn counted crabs. Dr Eilidh Munro, the island's doctor, stopped on her rounds to watch. She was a tall woman with a voice like gravel, and she had delivered half the children in the village, Isla and Finn included.

"Your gran's chest is bad," Dr Munro told Isla quietly, so Finn would not hear. "Keep her warm. Keep her sitting down, if she'll let you."

Agnes did not let anyone keep her sitting down.`,
  },
  {
    title: "Grandmother's Bread",
    content: `Agnes died in August, in her chair by the stove, with flour still on her hands. Isla found her when she came in from the pier.

The funeral was small and windy. Finn, fifteen and suddenly too old to cry in front of people, stood beside the grave with his fists in his pockets. Their father said almost nothing for a week.

Afterwards Isla took over the baking, badly at first. The bread came out flat and grey, and Finn ate it anyway and told her it was the best he had ever had, which was how she knew he missed Agnes as much as she did.`,
  },
  {
    title: "The Fall",
    content: `In September Isla slipped on the weed at the bottom of the harbour steps and fell hard onto the stone. Her left hand took the weight of it. Dr Munro strapped it up and said nothing was broken, only sprained, and that she was to rest it for a fortnight.

Isla did not rest it. There were creels to mend and a house to run, and her father was at sea for longer and longer each day, as if the boat were the only place he could stand to be.

She learned to tie knots one-handed, slowly, with her teeth.`,
  },
  {
    title: "The Forecast",
    content: `The forecast came over the radio on a Tuesday: a gale moving in from the west, earlier than expected. Isla listened to it twice, her right hand, still bandaged from the fall, resting on the kitchen table.

Her father was out past the skerries. Finn stood at the window watching the sky go the colour of a bruise.

Isla caught her reflection in the dark glass, her brown eyes wide and frightened, and made herself look away. Someone had to be calm. It had always been Agnes. Now it would have to be her.`,
  },
  {
    title: "The Doctor's Advice",
    content: `She ran to the surgery first, because it was the closest place with a telephone. Dr Munro was locking up. He listened to her, frowning, and rang the coastguard himself, his big hands steady on the receiver.

"They'll go out when they can," he said. "Not before. You'll stay here, Isla."

When she got home, Agnes was at the stove, stirring a pot, and turned to tell her to take her wet boots off before she ruined the floor. Isla did as she was told. She always did, with Agnes.

The wind rose all evening.`,
  },
  {
    title: "The Guillemot",
    content: `At midnight there was still no word. Isla took the keys from the hook by the door, the keys to the Guillemot, her father's boat, which she had steered since she was small.

Finn tried to stop her. She told him to wait by the radio, and for once he listened.

Their father had not always been a fisherman. Before the sea took hold of him he had been the schoolteacher in Port Charlotte, and he still corrected people's grammar when he was tired. Isla thought about that as she cast off, of all the strange things to think about.`,
  },
  {
    title: "Eight Years Later",
    content: `Eight years later, Isla was twenty-four and running the boat herself. Her father had come home that night, half-drowned and furious, and had never gone out alone again.

Finn had grown into his elbows. His sandy hair was cut short now, and he was training to be a doctor in Glasgow, which Dr Munro claimed full credit for.

Sometimes, on the pier at Portnahaven, on the east coast of Islay, where the sun came up over the water, Isla still caught herself listening for the radio, and for her grandmother's voice telling her to take her boots off.`,
  },
];

export const PLANTED: PlantedContradiction[] = [
  {
    description: "Isla's eyes: green (ch. 1) vs brown (ch. 5)",
    entity: "isla",
    values: [["green"], ["brown"]],
  },
  {
    description: "Finn's age in the same summer: twelve (ch. 1) vs fifteen (ch. 3)",
    entity: "finn",
    values: [
      ["12", "twelve"],
      ["15", "fifteen"],
    ],
  },
  {
    description: "Agnes dies (ch. 3) but is cooking and talking (ch. 6)",
    entity: "agnes",
    values: [
      ["dead", "died", "deceased"],
      ["alive", "living", "cooking", "stove"],
    ],
  },
  {
    description: "The family boat: the Kittiwake (ch. 2) vs the Guillemot (ch. 7)",
    entity: "",
    values: [["kittiwake"], ["guillemot"]],
  },
  {
    description: "Dr Munro: a woman (ch. 2) vs a man (ch. 6)",
    entity: "munro",
    values: [
      ["woman", "female", "she"],
      ["man", "male", "he"],
    ],
  },
  {
    description: "The injured hand: left (ch. 4) vs right (ch. 5)",
    entity: "isla",
    values: [["left"], ["right"]],
  },
  {
    description: "Portnahaven: west coast (ch. 1) vs east coast (ch. 8)",
    entity: "portnahaven",
    values: [["west"], ["east"]],
  },
];

/** Changes the story explains; a good checker should NOT flag these. */
export const NOT_CONTRADICTIONS = [
  "Isla is sixteen (ch. 1) and twenty-four eight years later (ch. 8)",
  "Agnes is alive (ch. 1) and dies (ch. 3)",
  "Finn's sandy hair is cut short eight years later (ch. 8)",
  "Ruaridh is a fisherman (ch. 1) who used to be a schoolteacher (ch. 7)",
];
