import type { ListeningTest } from "@/lib/content/types";

export const communityHallTest: ListeningTest = {
  id: "gt-community-hall",
  skill: "listening",
  title: "Listening Practice — Booking a Community Hall",
  timeMinutes: 10,
  sections: [
    {
      id: "p1",
      name: "Part 1",
      audioUrl: "/audio/listening/gt-community-hall-p1.wav",
      script:
        "Receptionist: Good morning, Riverside Community Centre, how can I help you? " +
        "Caller: Hi, I'd like to book a room for a children's party next month. " +
        "Receptionist: Of course. What date were you thinking of? " +
        "Caller: Saturday the fourteenth, in the afternoon. " +
        "Receptionist: Let me check. Yes, the main hall is free from two o'clock. How many guests are you expecting? " +
        "Caller: About twenty-five children, plus a few parents. " +
        "Receptionist: That's fine, the hall holds up to sixty. The afternoon rate is forty pounds for three hours. " +
        "Caller: Great. Does that include tables and chairs? " +
        "Receptionist: Yes, tables and chairs are included, but you'll need to bring your own decorations. " +
        "Caller: Understood. Is there a kitchen we can use? " +
        "Receptionist: There's a small kitchen with a kettle and a fridge, but no oven, so please bring food ready to serve. " +
        "Caller: Perfect. And how do I pay? " +
        "Receptionist: We take a ten-pound deposit now to hold the booking, and the rest on the day.",
      questions: [
        { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
          prompt: "Booking date: Saturday the ______.", accepted: ["fourteenth", "14th", "14"] },
        { id: "l2", number: 2, type: "sentence_completion", wordLimit: 1,
          prompt: "The main hall is free from ______ o'clock.", accepted: ["two", "2"] },
        { id: "l3", number: 3, type: "sentence_completion", wordLimit: 1,
          prompt: "Number of children expected: ______.", accepted: ["twenty-five", "25"] },
        { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
          prompt: "Afternoon rate: £______ for three hours.", accepted: ["forty", "40"] },
        { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
          prompt: "Deposit required now: £______.", accepted: ["ten", "10"] },
        { id: "l6", number: 6, type: "single_choice",
          prompt: "What is included in the hire price?",
          options: [
            { value: "A", label: "decorations" },
            { value: "B", label: "tables and chairs" },
            { value: "C", label: "food" },
          ],
          accepted: ["B"] },
        { id: "l7", number: 7, type: "single_choice",
          prompt: "What does the kitchen NOT have?",
          options: [
            { value: "A", label: "a kettle" },
            { value: "B", label: "a fridge" },
            { value: "C", label: "an oven" },
          ],
          accepted: ["C"] },
        { id: "l8", number: 8, type: "true_false_notgiven",
          prompt: "The caller must pay the full amount at the time of booking.",
          accepted: ["false"] },
      ],
    },
  ],
};
