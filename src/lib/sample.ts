import type { StudySet } from "./models";

export function sampleSet(): StudySet {
  const now = new Date().toISOString();
  return {
    id: "sample-photosynthesis",
    title: "The science of photosynthesis",
    subject: "Biology",
    notes: `Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. It takes place in chloroplasts, which contain the green pigment chlorophyll. Chlorophyll absorbs light, especially red and blue light.

The overall equation for photosynthesis is: carbon dioxide + water + light energy → glucose + oxygen. Plants absorb water through their roots and take in carbon dioxide through small openings in their leaves called stomata. Oxygen is released as a by-product.

Photosynthesis has two main stages. The light-dependent reactions take place in the thylakoid membranes of the chloroplast. They use light energy to split water, release oxygen, and produce ATP and NADPH.

The Calvin cycle takes place in the stroma, the fluid inside the chloroplast. It uses ATP and NADPH from the light-dependent reactions to fix carbon dioxide into sugars. The Calvin cycle does not directly require light, but it depends on the products of the light-dependent reactions.

The rate of photosynthesis is affected by light intensity, carbon dioxide concentration, and temperature. A limiting factor is the factor in shortest supply that restricts the rate. Increasing one factor only helps until another factor becomes limiting.

Glucose made during photosynthesis can be used in respiration to release energy, stored as starch, or used to make cellulose for cell walls. Photosynthesis is important because it supplies food energy to ecosystems and releases oxygen into the atmosphere.`,
    createdAt: now,
    updatedAt: now,
    folderId: null,
    tags: [],
    cardSchedule: {},
    generation: null,
    cardReviews: {},
    attempts: [],
    quizDraft: null,
  };
}
