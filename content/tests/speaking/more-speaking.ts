import type { SpeakingTest } from "@/lib/content/speaking";

/**
 * Additional original Speaking practice sets across Parts 1–3. Topics are original
 * and follow the IELTS General Training speaking format. The `topic` guides the
 * live AI examiner.
 */
export const moreSpeakingTests: SpeakingTest[] = [
  {
    id: "gt-speaking-p1-hometown",
    skill: "speaking",
    title: "Speaking Part 1 — Hometown & Home",
    part: "1",
    topic:
      "Interview the candidate with everyday questions about their hometown and where they live: " +
      "where they are from, what they like about it, whether they live in a house or an apartment, " +
      "their favourite room, and whether they would like to move in the future.",
  },
  {
    id: "gt-speaking-p1-work-study",
    skill: "speaking",
    title: "Speaking Part 1 — Work or Study",
    part: "1",
    topic:
      "Ask the candidate about their work or studies: what they do or study, why they chose it, " +
      "what a typical day is like, what they enjoy most, and what they would like to do in the future.",
  },
  {
    id: "gt-speaking-p1-free-time",
    skill: "speaking",
    title: "Speaking Part 1 — Free Time & Hobbies",
    part: "1",
    topic:
      "Ask the candidate about their free time: what they like to do to relax, whether they prefer " +
      "indoor or outdoor activities, who they spend free time with, and how their hobbies have changed.",
  },
  {
    id: "gt-speaking-p2-helpful-person",
    skill: "speaking",
    title: "Speaking Part 2 — A helpful person",
    part: "2",
    topic:
      "Describe a person who has helped you. You should say who the person is, how you know them, " +
      "what they did to help you, and explain how you felt about their help.",
  },
  {
    id: "gt-speaking-p2-place-relax",
    skill: "speaking",
    title: "Speaking Part 2 — A place to relax",
    part: "2",
    topic:
      "Describe a place where you like to relax. You should say where it is, how often you go there, " +
      "what you do there, and explain why it helps you relax.",
  },
  {
    id: "gt-speaking-p2-skill-learned",
    skill: "speaking",
    title: "Speaking Part 2 — A skill you learned",
    part: "2",
    topic:
      "Describe a useful skill you have learned. You should say what the skill is, when and how you " +
      "learned it, how difficult it was, and explain why it is useful to you.",
  },
  {
    id: "gt-speaking-p2-memorable-trip",
    skill: "speaking",
    title: "Speaking Part 2 — A memorable journey",
    part: "2",
    topic:
      "Describe a journey or trip that you remember well. You should say where you went, who you went " +
      "with, what you did, and explain why the journey was memorable.",
  },
  {
    id: "gt-speaking-p3-technology",
    skill: "speaking",
    title: "Speaking Part 3 — Technology & society",
    part: "3",
    topic:
      "Lead a discussion about technology in daily life: how technology has changed the way people " +
      "communicate, the advantages and disadvantages of smartphones, whether technology brings people " +
      "closer together, and how it might change everyday life in the future.",
  },
  {
    id: "gt-speaking-p3-environment",
    skill: "speaking",
    title: "Speaking Part 3 — The environment",
    part: "3",
    topic:
      "Lead a discussion about the environment: the most serious environmental problems today, who is " +
      "responsible for protecting the environment, what ordinary people can do to help, and whether " +
      "individuals or governments can make a bigger difference.",
  },
];
