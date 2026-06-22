import type { ReadingTest } from "@/lib/content/types";

export const toolLibrariesTest: ReadingTest = {
  id: "gt-tool-libraries",
  skill: "reading",
  variant: "general-training",
  title: "GT Reading Practice — Community Tool Libraries",
  timeMinutes: 20,
  sections: [
    {
      id: "s1",
      name: "Section 3: General Reading",
      passageTitle: "Community Tool Libraries",
      passageParagraphs: [
        "A tool library works much like a library of books, except that instead of borrowing novels or textbooks, members borrow tools. From electric drills and ladders to lawnmowers and sewing machines, a tool library lends out equipment that many people need only occasionally. Members pay a modest annual fee and can then borrow items for a set period, usually a week.",
        "The idea is not new. The first tool-lending schemes appeared in the United States in the 1940s, often run by public libraries as a small side service. They grew slowly until the early twenty-first century, when concerns about waste and the rising cost of living gave them fresh appeal. Today there are hundreds of tool libraries worldwide, many of them run by volunteers.",
        "Supporters point to several benefits. Borrowing rather than buying saves money, particularly for expensive items used once or twice a year. It also saves space, since a single shared drill can replace dozens sitting idle in private cupboards. Environmentally, sharing reduces the demand for manufacturing and cuts the waste created when cheap tools break and are thrown away.",
        "Tool libraries are not without challenges. Tools wear out faster than books and require regular maintenance, so most libraries set aside part of their budget for repairs and replacement. Some items, such as chainsaws, are considered too dangerous to lend without training, and a few libraries offer short workshops so that members can learn to use unfamiliar equipment safely.",
        "For many members, though, the greatest value is social. Tool libraries often become community hubs where neighbours meet, swap advice, and help one another with projects. In this way they lend far more than tools.",
      ],
      questions: [
        {
          id: "q1", number: 1, type: "true_false_notgiven",
          prompt: "Members of a tool library can usually keep a borrowed item for one month.",
          accepted: ["false"],
        },
        {
          id: "q2", number: 2, type: "true_false_notgiven",
          prompt: "The first tool-lending schemes were often run by public libraries.",
          accepted: ["true"],
        },
        {
          id: "q3", number: 3, type: "true_false_notgiven",
          prompt: "Tool libraries became more popular partly because of concerns about waste.",
          accepted: ["true"],
        },
        {
          id: "q4", number: 4, type: "true_false_notgiven",
          prompt: "Some tool libraries are run by volunteers.",
          accepted: ["true"],
        },
        {
          id: "q5", number: 5, type: "sentence_completion", wordLimit: 2,
          prompt: "Members pay a modest annual ______ to join a tool library.",
          accepted: ["fee"],
        },
        {
          id: "q6", number: 6, type: "sentence_completion", wordLimit: 1,
          prompt: "A single shared drill can replace dozens sitting ______ in private cupboards.",
          accepted: ["idle"],
        },
        {
          id: "q7", number: 7, type: "sentence_completion", wordLimit: 1,
          prompt: "Most libraries set aside part of their ______ for repairs and replacement.",
          accepted: ["budget"],
        },
        {
          id: "q8", number: 8, type: "single_choice",
          prompt: "According to the passage, tool libraries save space because:",
          options: [
            { value: "A", label: "members visit them less often" },
            { value: "B", label: "one shared tool can replace many privately owned ones" },
            { value: "C", label: "tools take up less room than books" },
          ],
          accepted: ["B"],
        },
        {
          id: "q9", number: 9, type: "single_choice",
          prompt: "The writer says that for many members the greatest value of a tool library is:",
          options: [
            { value: "A", label: "financial" },
            { value: "B", label: "environmental" },
            { value: "C", label: "social" },
          ],
          accepted: ["C"],
        },
        {
          id: "q10", number: 10, type: "short_answer", wordLimit: 2,
          prompt: "What do a few libraries offer so that members can learn to use unfamiliar equipment safely?",
          accepted: ["workshops", "short workshops"],
        },
      ],
    },
  ],
};
