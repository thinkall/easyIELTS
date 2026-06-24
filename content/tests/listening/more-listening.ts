import type { ListeningTest } from "@/lib/content/types";

/**
 * Additional original Listening practice tests. All scripts and questions are
 * original, copyright-free, and written in the IELTS General Training style.
 * These have no pre-generated audio file: the app reads the script aloud with
 * multi-voice text-to-speech at runtime. Every accepted answer is supported by
 * the script.
 */
const rawListeningTests: ListeningTest[] = [
  {
    id: "gt-listening-library",
    skill: "listening",
    title: "Listening Practice — Joining the Library",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Librarian: Good afternoon, Greenfield Library, how can I help? " +
          "Visitor: Hello, I'd like to join the library, please. " +
          "Librarian: Of course. Can I take your full name? " +
          "Visitor: Yes, it's Daniel Carter. " +
          "Librarian: Thank you. And your address? " +
          "Visitor: It's 12 Maple Road. " +
          "Librarian: Lovely. Membership is free for local residents, but I'll need to see proof of address, such as a recent electricity bill. " +
          "Visitor: I have one here. How many books can I borrow at a time? " +
          "Librarian: You can borrow up to eight books, and you can keep them for three weeks. " +
          "Visitor: Great. What happens if I return them late? " +
          "Librarian: There's a small charge of twenty pence per book for each day they're overdue. " +
          "Visitor: And can I use the computers? " +
          "Librarian: Yes, members get one hour of free internet a day. Just book a slot at the front desk. " +
          "Visitor: Perfect, thank you.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 2,
            prompt: "Member's name: ______.", accepted: ["Daniel Carter"] },
          { id: "l2", number: 2, type: "sentence_completion", wordLimit: 3,
            prompt: "Address: ______.", accepted: ["12 Maple Road"] },
          { id: "l3", number: 3, type: "sentence_completion", wordLimit: 1,
            prompt: "Maximum number of books that can be borrowed: ______.", accepted: ["eight", "8"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 2,
            prompt: "Books can be kept for ______.", accepted: ["three weeks", "3 weeks"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
            prompt: "Late charge: ______ pence per book per day.", accepted: ["twenty", "20"] },
          { id: "l6", number: 6, type: "single_choice",
            prompt: "What does the visitor need to show to join?",
            options: [
              { value: "A", label: "a passport" },
              { value: "B", label: "proof of address" },
              { value: "C", label: "a bank card" },
            ],
            accepted: ["B"] },
          { id: "l7", number: 7, type: "single_choice",
            prompt: "How much free internet do members get each day?",
            options: [
              { value: "A", label: "thirty minutes" },
              { value: "B", label: "one hour" },
              { value: "C", label: "two hours" },
            ],
            accepted: ["B"] },
          { id: "l8", number: 8, type: "true_false_notgiven",
            prompt: "Library membership costs a yearly fee for local residents.",
            accepted: ["false"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-gym",
    skill: "listening",
    title: "Listening Practice — Gym Enquiry",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Staff: Hello, Fitness First, this is Maria speaking. " +
          "Caller: Hi, I'm interested in joining your gym. Could you tell me about the membership? " +
          "Staff: Certainly. We have two options: a monthly plan at thirty-five pounds a month, or an annual plan at three hundred and sixty pounds for the year. " +
          "Caller: The annual one sounds cheaper overall. What's included? " +
          "Staff: Both plans include the gym, the swimming pool and all the group classes. " +
          "Caller: Do I need to bring anything for my first visit? " +
          "Staff: Just a towel and a padlock for the lockers. We provide everything else. " +
          "Caller: What are your opening hours? " +
          "Staff: We open at six in the morning and close at ten at night on weekdays. At weekends we close earlier, at eight. " +
          "Caller: And is there parking? " +
          "Staff: Yes, there's a free car park for members behind the building. " +
          "Caller: That's helpful. Can I come in for a tour first? " +
          "Staff: Of course. Just ask for me, Maria, at reception.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
            prompt: "Monthly plan: £______ a month.", accepted: ["thirty-five", "35"] },
          { id: "l2", number: 2, type: "sentence_completion", wordLimit: 3,
            prompt: "Annual plan: £______ for the year.", accepted: ["three hundred and sixty", "360"] },
          { id: "l3", number: 3, type: "sentence_completion", wordLimit: 2,
            prompt: "For a first visit, bring a towel and a ______.", accepted: ["padlock"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
            prompt: "Weekday opening time: ______ in the morning.", accepted: ["six", "6"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
            prompt: "Weekend closing time: ______ at night.", accepted: ["eight", "8"] },
          { id: "l6", number: 6, type: "single_choice",
            prompt: "Which of these is included in both membership plans?",
            options: [
              { value: "A", label: "a personal trainer" },
              { value: "B", label: "the swimming pool" },
              { value: "C", label: "free meals" },
            ],
            accepted: ["B"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "Parking is free for members.",
            accepted: ["true"] },
          { id: "l8", number: 8, type: "true_false_notgiven",
            prompt: "The caller cannot visit the gym before joining.",
            accepted: ["false"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-museum-tour",
    skill: "listening",
    title: "Listening Practice — Museum Tour Information",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 2 (Monologue)",
        script:
          "Guide: Good morning everyone, and welcome to the City Museum. My name is Tom and I'll give you some information before you explore. " +
          "The museum has three floors. On the ground floor you'll find the gift shop and the café, which serves drinks and light meals until four o'clock. " +
          "The first floor is dedicated to local history, with displays about how the town grew from a small fishing village. " +
          "The top floor holds our science gallery, which is especially popular with families because almost everything there can be touched and tried. " +
          "Photography is allowed throughout the museum, but please do not use flash, as it can damage the older objects. " +
          "Free guided tours start from this desk at eleven o'clock and again at two. Each tour lasts about forty-five minutes. " +
          "If you have any large bags, please leave them in the lockers near the entrance; they're free to use. " +
          "Finally, the museum closes at five, but the last entry is at half past four. Enjoy your visit.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
            prompt: "Number of floors in the museum: ______.", accepted: ["three", "3"] },
          { id: "l2", number: 2, type: "single_choice",
            prompt: "Where is the café located?",
            options: [
              { value: "A", label: "the ground floor" },
              { value: "B", label: "the first floor" },
              { value: "C", label: "the top floor" },
            ],
            accepted: ["A"] },
          { id: "l3", number: 3, type: "single_choice",
            prompt: "Which floor is most popular with families?",
            options: [
              { value: "A", label: "the ground floor" },
              { value: "B", label: "the first floor" },
              { value: "C", label: "the top floor" },
            ],
            accepted: ["C"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
            prompt: "The first floor is about local ______.", accepted: ["history"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
            prompt: "Guided tours last about ______ minutes.", accepted: ["forty-five", "45"] },
          { id: "l6", number: 6, type: "sentence_completion", wordLimit: 2,
            prompt: "Large bags should be left in the ______ near the entrance.", accepted: ["lockers"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "Visitors may take photographs but must not use flash.",
            accepted: ["true"] },
          { id: "l8", number: 8, type: "sentence_completion", wordLimit: 3,
            prompt: "The last entry to the museum is at ______.", accepted: ["half past four", "4:30", "four thirty"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-cooking-course",
    skill: "listening",
    title: "Listening Practice — Cooking Course Booking",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Tutor: Hello, Riverside Cookery School. " +
          "Caller: Hi, I'd like to book a place on one of your evening courses. " +
          "Tutor: Wonderful. We have two starting next month: Italian cooking on Tuesdays, and Thai cooking on Thursdays. " +
          "Caller: I'll go for the Thai course, please. How many weeks does it run? " +
          "Tutor: It runs for six weeks, two hours each evening, from seven to nine. " +
          "Caller: And the cost? " +
          "Tutor: It's ninety pounds for the whole course, and that includes all the ingredients. " +
          "Caller: Do I need to bring any equipment? " +
          "Tutor: No, we provide all the pots and knives. Just wear comfortable clothes and bring an apron if you have one. " +
          "Caller: Where exactly is the school? " +
          "Tutor: We're at 5 Bridge Street, above the bakery. " +
          "Caller: Great. Can I pay on the first evening? " +
          "Tutor: We ask for a deposit of twenty pounds to reserve your place, and the rest on the first night. " +
          "Caller: That's fine. My name is Sarah Bennett. " +
          "Tutor: Thank you, Sarah, you're booked in.",
        questions: [
          { id: "l1", number: 1, type: "single_choice",
            prompt: "Which course does the caller choose?",
            options: [
              { value: "A", label: "Italian cooking" },
              { value: "B", label: "Thai cooking" },
              { value: "C", label: "French cooking" },
            ],
            accepted: ["B"] },
          { id: "l2", number: 2, type: "sentence_completion", wordLimit: 1,
            prompt: "The course runs for ______ weeks.", accepted: ["six", "6"] },
          { id: "l3", number: 3, type: "sentence_completion", wordLimit: 3,
            prompt: "Each class runs from seven to ______.", accepted: ["nine", "9"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
            prompt: "Total cost of the course: £______.", accepted: ["ninety", "90"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
            prompt: "Deposit required to reserve a place: £______.", accepted: ["twenty", "20"] },
          { id: "l6", number: 6, type: "sentence_completion", wordLimit: 3,
            prompt: "The school's address is ______.", accepted: ["5 Bridge Street"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "The price of the course includes all the ingredients.",
            accepted: ["true"] },
          { id: "l8", number: 8, type: "true_false_notgiven",
            prompt: "Students must bring their own knives and pots.",
            accepted: ["false"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-volunteer",
    skill: "listening",
    title: "Listening Practice — Volunteering at a Festival",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Organiser: Hello, Summer Arts Festival volunteer line, James speaking. " +
          "Caller: Hi, I saw you're looking for volunteers and I'd like to help. " +
          "Organiser: That's great, thank you. The festival runs over a weekend in July, the nineteenth and twentieth. " +
          "Caller: I'm free both days. What sort of jobs are there? " +
          "Organiser: We need people for three main roles: helping at the information tent, selling tickets, and stewarding, which means guiding visitors and keeping the paths clear. " +
          "Caller: I think I'd prefer the information tent. " +
          "Organiser: No problem. Volunteers do a shift of four hours, and you'll get a free festival t-shirt and lunch on each day you work. " +
          "Caller: Do I need any experience? " +
          "Organiser: Not at all. We run a short training session on the Friday evening before the festival, at six o'clock. " +
          "Caller: Where do I sign up? " +
          "Organiser: I'll email you a form. Could I take your name? " +
          "Caller: It's Olivia Reed. " +
          "Organiser: Thanks, Olivia. I'll send the form today.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
            prompt: "The festival takes place over a weekend in ______.", accepted: ["July"] },
          { id: "l2", number: 2, type: "single_choice",
            prompt: "Which role does the caller prefer?",
            options: [
              { value: "A", label: "the information tent" },
              { value: "B", label: "selling tickets" },
              { value: "C", label: "stewarding" },
            ],
            accepted: ["A"] },
          { id: "l3", number: 3, type: "sentence_completion", wordLimit: 1,
            prompt: "Each volunteer shift lasts ______ hours.", accepted: ["four", "4"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 2,
            prompt: "Volunteers receive a free festival ______ and lunch.", accepted: ["t-shirt", "tshirt"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
            prompt: "Training is held on Friday at ______ o'clock.", accepted: ["six", "6"] },
          { id: "l6", number: 6, type: "sentence_completion", wordLimit: 2,
            prompt: "Volunteer's name: ______.", accepted: ["Olivia Reed"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "Volunteers need previous experience to take part.",
            accepted: ["false"] },
          { id: "l8", number: 8, type: "true_false_notgiven",
            prompt: "Stewards guide visitors and keep the paths clear.",
            accepted: ["true"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-apartment",
    skill: "listening",
    title: "Listening Practice — Renting an Apartment",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Agent: Good morning, Hillside Lettings. " +
          "Caller: Hello, I'm calling about the apartment you advertised on Park Lane. " +
          "Agent: Yes, the two-bedroom flat. It's still available. " +
          "Caller: How much is the rent? " +
          "Agent: It's eight hundred and fifty pounds a month, and the bills are not included. " +
          "Caller: Is it furnished? " +
          "Agent: It comes partly furnished, with a sofa, a bed and a dining table, but no kitchen appliances. " +
          "Caller: Which floor is it on? " +
          "Agent: It's on the second floor, and unfortunately there's no lift, so it's stairs only. " +
          "Caller: That's okay. Are pets allowed? " +
          "Agent: Small pets such as cats are allowed, but no dogs, I'm afraid. " +
          "Caller: When would it be available? " +
          "Agent: From the first of next month. We'd need a deposit equal to one month's rent before you move in. " +
          "Caller: Could I arrange a viewing? " +
          "Agent: Certainly. How about Thursday at five o'clock?",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
            prompt: "Number of bedrooms: ______.", accepted: ["two", "2"] },
          { id: "l2", number: 2, type: "sentence_completion", wordLimit: 3,
            prompt: "Monthly rent: £______.", accepted: ["eight hundred and fifty", "850"] },
          { id: "l3", number: 3, type: "single_choice",
            prompt: "Which item is NOT provided with the flat?",
            options: [
              { value: "A", label: "a sofa" },
              { value: "B", label: "a bed" },
              { value: "C", label: "kitchen appliances" },
            ],
            accepted: ["C"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
            prompt: "The flat is on the ______ floor.", accepted: ["second", "2nd"] },
          { id: "l5", number: 5, type: "single_choice",
            prompt: "Which pets are allowed?",
            options: [
              { value: "A", label: "cats" },
              { value: "B", label: "dogs" },
              { value: "C", label: "no pets at all" },
            ],
            accepted: ["A"] },
          { id: "l6", number: 6, type: "true_false_notgiven",
            prompt: "The bills are included in the rent.",
            accepted: ["false"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "There is no lift in the building.",
            accepted: ["true"] },
          { id: "l8", number: 8, type: "sentence_completion", wordLimit: 2,
            prompt: "A viewing is arranged for Thursday at ______.", accepted: ["five o'clock", "five", "5", "5 o'clock"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-college-orientation",
    skill: "listening",
    title: "Listening Practice — College Orientation",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 2 (Monologue)",
        script:
          "Speaker: Welcome, everyone, to Westbrook College. I'm here to give you a quick guide to your first week. " +
          "Your timetable will be available online from Monday, and you can also collect a printed copy from the student office on the ground floor. " +
          "Classes begin on Wednesday this week, not Monday, to give you time to settle in. " +
          "The library is open from eight in the morning until nine at night during term, and you'll need your student card to borrow books. " +
          "Lunch is served in the canteen between twelve and two, and there's a smaller coffee bar that stays open all day. " +
          "If you feel unwell, the medical room is next to the main reception, and there's a nurse available every weekday morning. " +
          "We strongly recommend joining at least one of the college clubs; there are over thirty to choose from, and the sign-up fair is on Friday in the sports hall. " +
          "Finally, if you ever have a problem, your personal tutor is the first person to contact. You'll meet your tutor on Thursday afternoon.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
            prompt: "Timetables are available online from ______.", accepted: ["Monday"] },
          { id: "l2", number: 2, type: "single_choice",
            prompt: "On which day do classes begin?",
            options: [
              { value: "A", label: "Monday" },
              { value: "B", label: "Wednesday" },
              { value: "C", label: "Friday" },
            ],
            accepted: ["B"] },
          { id: "l3", number: 3, type: "sentence_completion", wordLimit: 1,
            prompt: "The library closes at ______ at night.", accepted: ["nine", "9"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 2,
            prompt: "Students need their ______ to borrow books.", accepted: ["student card"] },
          { id: "l5", number: 5, type: "single_choice",
            prompt: "Where is the medical room?",
            options: [
              { value: "A", label: "next to the main reception" },
              { value: "B", label: "in the library" },
              { value: "C", label: "in the sports hall" },
            ],
            accepted: ["A"] },
          { id: "l6", number: 6, type: "sentence_completion", wordLimit: 1,
            prompt: "The clubs sign-up fair is on ______.", accepted: ["Friday"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "There are more than thirty college clubs to choose from.",
            accepted: ["true"] },
          { id: "l8", number: 8, type: "sentence_completion", wordLimit: 2,
            prompt: "Students will meet their personal tutor on ______ afternoon.", accepted: ["Thursday"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-bike-hire",
    skill: "listening",
    title: "Listening Practice — Hiring a Bicycle",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Assistant: Hello, City Cycle Hire, how can I help? " +
          "Customer: Hi, I'd like to hire a bike for the day. " +
          "Assistant: Sure. We have standard bikes at twelve pounds a day, and electric bikes at twenty pounds a day. " +
          "Customer: I'll take a standard one, thanks. Does that include a helmet? " +
          "Assistant: Yes, a helmet and a lock are both included, free of charge. " +
          "Customer: Great. Do I need to leave anything as a deposit? " +
          "Assistant: We ask for a deposit of thirty pounds, which you get back when you return the bike undamaged. " +
          "Customer: What time do I need to bring it back? " +
          "Assistant: By six o'clock this evening, please. After that there's a late fee of five pounds an hour. " +
          "Customer: Understood. Could you recommend a route? " +
          "Assistant: The riverside path is lovely and flat, perfect for a relaxed ride. Here's a free map. " +
          "Customer: Thank you. Oh, what if I get a flat tyre? " +
          "Assistant: Just call the number on the map, and we'll come and help you.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
            prompt: "Standard bike: £______ a day.", accepted: ["twelve", "12"] },
          { id: "l2", number: 2, type: "sentence_completion", wordLimit: 1,
            prompt: "Electric bike: £______ a day.", accepted: ["twenty", "20"] },
          { id: "l3", number: 3, type: "single_choice",
            prompt: "What is included free with the bike?",
            options: [
              { value: "A", label: "a helmet and a lock" },
              { value: "B", label: "a water bottle" },
              { value: "C", label: "a repair kit" },
            ],
            accepted: ["A"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
            prompt: "Deposit required: £______.", accepted: ["thirty", "30"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 2,
            prompt: "The bike must be returned by ______ this evening.", accepted: ["six o'clock", "six", "6", "6 o'clock"] },
          { id: "l6", number: 6, type: "sentence_completion", wordLimit: 1,
            prompt: "Late fee: £______ an hour.", accepted: ["five", "5"] },
          { id: "l7", number: 7, type: "sentence_completion", wordLimit: 2,
            prompt: "The assistant recommends the ______ path.", accepted: ["riverside"] },
          { id: "l8", number: 8, type: "true_false_notgiven",
            prompt: "The deposit is returned if the bike comes back undamaged.",
            accepted: ["true"] },
        ],
      },
    ],
  },
  {
    id: "gt-listening-doctor",
    skill: "listening",
    title: "Listening Practice — Registering at a Health Centre",
    timeMinutes: 10,
    sections: [
      {
        id: "p1",
        name: "Part 1",
        script:
          "Receptionist: Good morning, Oakwood Health Centre. " +
          "Patient: Hello, I've just moved to the area and I'd like to register. " +
          "Receptionist: Welcome. I can help you with that. Could I take your name? " +
          "Patient: Yes, it's Emma Wilson. " +
          "Receptionist: Thank you. And your date of birth? " +
          "Patient: The third of March, nineteen ninety. " +
          "Receptionist: Lovely. I'll need to give you a registration form to complete. You can hand it back with proof of your new address. " +
          "Patient: No problem. How do I book an appointment once I'm registered? " +
          "Receptionist: You can call us, or use our website. For non-urgent matters there's usually a wait of two to three days. " +
          "Patient: And if it's urgent? " +
          "Receptionist: We keep some appointments free each morning. Call at eight o'clock sharp, as they go quickly. " +
          "Patient: Good to know. Do you have a pharmacy here? " +
          "Receptionist: There isn't one inside, but there's a chemist just across the road. " +
          "Patient: Perfect, thank you for your help.",
        questions: [
          { id: "l1", number: 1, type: "sentence_completion", wordLimit: 2,
            prompt: "Patient's name: ______.", accepted: ["Emma Wilson"] },
          { id: "l2", number: 2, type: "sentence_completion", wordLimit: 3,
            prompt: "Date of birth: the third of ______, 1990.", accepted: ["March"] },
          { id: "l3", number: 3, type: "single_choice",
            prompt: "What must the patient return with the registration form?",
            options: [
              { value: "A", label: "proof of address" },
              { value: "B", label: "a passport photo" },
              { value: "C", label: "a payment" },
            ],
            accepted: ["A"] },
          { id: "l4", number: 4, type: "sentence_completion", wordLimit: 3,
            prompt: "For non-urgent matters, the usual wait is ______ days.", accepted: ["two to three", "2 to 3"] },
          { id: "l5", number: 5, type: "sentence_completion", wordLimit: 2,
            prompt: "For an urgent appointment, call at ______ in the morning.", accepted: ["eight o'clock", "eight", "8", "8 o'clock"] },
          { id: "l6", number: 6, type: "single_choice",
            prompt: "Where can the patient get medicines?",
            options: [
              { value: "A", label: "at a pharmacy inside the centre" },
              { value: "B", label: "at a chemist across the road" },
              { value: "C", label: "by post only" },
            ],
            accepted: ["B"] },
          { id: "l7", number: 7, type: "true_false_notgiven",
            prompt: "Appointments can be booked online.",
            accepted: ["true"] },
          { id: "l8", number: 8, type: "true_false_notgiven",
            prompt: "There is a pharmacy inside the health centre.",
            accepted: ["false"] },
        ],
      },
    ],
  },
];

// Prefix each question id with its test id so question ids are globally unique
// across the whole listening test bank.
export const moreListeningTests: ListeningTest[] = rawListeningTests.map((test) => ({
  ...test,
  sections: test.sections.map((section) => ({
    ...section,
    questions: section.questions.map((q) => ({ ...q, id: `${test.id}-${q.id}` })),
  })),
}));
