const TOTAL_SUBJECTS = 4;
const QUESTIONS_PER_SUBJECT = 50;
const EXAM_DURATION_MINUTES = 180;
const STORAGE_KEY = "jamb-cbt-last-session";

const ELECTIVE_SUBJECTS = [
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "Economics",
  "Government",
];

const SUBJECT_COLORS = {
  "Use of English": "#fff1f6",
  Mathematics: "#e8f0fb",
  Biology: "#e4f7e5",
  Chemistry: "#fce8ff",
  Physics: "#ede8ff",
  Economics: "#fff0dc",
  Government: "#e7eefc",
};

const SUBJECT_GENERATORS = {
  "Use of English": [
    generateEnglishGrammarQuestion,
    generateEnglishLexisQuestion,
    generateEnglishComprehensionQuestion,
  ],
  Mathematics: [
    generateMathArithmeticQuestion,
    generateMathAlgebraQuestion,
    generateMathGeometryQuestion,
    generateMathStatisticsQuestion,
  ],
  Biology: [
    generateBiologyEcologyQuestion,
    generateBiologyGeneticsQuestion,
    generateBiologyHumanSystemQuestion,
    generateBiologyCellQuestion,
  ],
  Chemistry: [
    generateChemistryAtomicQuestion,
    generateChemistryAcidBaseQuestion,
    generateChemistryGasQuestion,
    generateChemistryBondingQuestion,
  ],
  Physics: [
    generatePhysicsMotionQuestion,
    generatePhysicsForceQuestion,
    generatePhysicsElectricityQuestion,
    generatePhysicsWaveQuestion,
  ],
  Economics: [
    generateEconomicsDemandQuestion,
    generateEconomicsInflationQuestion,
    generateEconomicsOpportunityCostQuestion,
    generateEconomicsMarketQuestion,
  ],
  Government: [
    generateGovernmentDemocracyQuestion,
    generateGovernmentCitizenshipQuestion,
    generateGovernmentArmsQuestion,
    generateGovernmentElectoralQuestion,
  ],
};

const state = {
  candidateName: "",
  subjects: [],
  questionsBySubject: {},
  currentSubjectIndex: 0,
  currentQuestionIndex: 0,
  remainingSeconds: EXAM_DURATION_MINUTES * 60,
  timerId: null,
  startedAt: null,
  endedAt: null,
};

const screens = {
  setup: document.getElementById("setup-screen"),
  instructions: document.getElementById("instruction-screen"),
  exam: document.getElementById("exam-screen"),
  result: document.getElementById("result-screen"),
};

const setupForm = document.getElementById("setup-form");
const candidateNameInput = document.getElementById("candidate-name");
const subjectOptions = document.getElementById("subject-options");
const backToSetupButton = document.getElementById("back-to-setup");
const startExamButton = document.getElementById("start-exam");
const examTitle = document.getElementById("exam-title");
const examMeta = document.getElementById("exam-meta");
const timerDisplay = document.getElementById("timer-display");
const questionTopic = document.getElementById("question-topic");
const questionProgress = document.getElementById("question-progress");
const subjectStageBanner = document.getElementById("subject-stage-banner");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const prevButton = document.getElementById("prev-btn");
const nextButton = document.getElementById("next-btn");
const candidateSummary = document.getElementById("candidate-summary");
const subjectSummary = document.getElementById("subject-summary");
const subjectStage = document.getElementById("subject-stage");
const answeredCount = document.getElementById("answered-count");
const paletteTitle = document.getElementById("palette-title");
const paletteGrid = document.getElementById("palette-grid");
const submitExamButton = document.getElementById("submit-exam");
const resultTitle = document.getElementById("result-title");
const totalScore = document.getElementById("total-score");
const answeredTotal = document.getElementById("answered-total");
const bestSubject = document.getElementById("best-subject");
const weakestSubject = document.getElementById("weakest-subject");
const subjectResults = document.getElementById("subject-results");
const restartExamButton = document.getElementById("restart-exam");

renderSubjectOptions();
bindEvents();
loadLastCandidateName();
prefillFromPortal();

function bindEvents() {
  setupForm.addEventListener("submit", handleSetupSubmit);
  backToSetupButton.addEventListener("click", () => showScreen("setup"));
  startExamButton.addEventListener("click", startExam);
  prevButton.addEventListener("click", () => moveQuestion(-1));
  nextButton.addEventListener("click", advanceWithinExam);
  submitExamButton.addEventListener("click", submitExam);
  restartExamButton.addEventListener("click", resetToSetup);
  document.addEventListener("keydown", handleExamKeyboardShortcuts);
}

function prefillFromPortal() {
  const params = new URLSearchParams(window.location.search);
  const name = (params.get("name") || "").trim();
  if (name && candidateNameInput) {
    candidateNameInput.value = name;
  }
}

function renderSubjectOptions() {
  const subjects = ["Use of English", ...ELECTIVE_SUBJECTS];
  subjectOptions.innerHTML = subjects
    .map((subject) => {
      const checked = subject === "Use of English" ? "checked" : "";
      const disabled = subject === "Use of English" ? "disabled" : "";
      return `
        <label class="subject-option">
          <input type="checkbox" value="${subject}" ${checked} ${disabled} />
          <span>${subject}</span>
        </label>
      `;
    })
    .join("");
}

function handleSetupSubmit(event) {
  event.preventDefault();

  const candidateName = candidateNameInput.value.trim();
  const selectedSubjects = getSelectedSubjects();

  if (!candidateName) {
    alert("Please enter your name before continuing.");
    return;
  }

  if (selectedSubjects.length !== TOTAL_SUBJECTS) {
    alert("Select exactly 4 subjects including Use of English.");
    return;
  }

  state.candidateName = candidateName;
  state.subjects = selectedSubjects;
  persistCandidateName(candidateName);
  populateInstructionSummary();
  showScreen("instructions");
}

function getSelectedSubjects() {
  const checkboxes = [...subjectOptions.querySelectorAll('input[type="checkbox"]')];
  const selected = checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);

  if (!selected.includes("Use of English")) {
    selected.unshift("Use of English");
  }

  return selected;
}

function populateInstructionSummary() {
  candidateSummary.textContent = `${state.candidateName} | ${state.subjects.join(", ")}`;
}

function startExam() {
  state.questionsBySubject = buildExamQuestions(state.subjects);
  state.currentSubjectIndex = 0;
  state.currentQuestionIndex = 0;
  state.remainingSeconds = EXAM_DURATION_MINUTES * 60;
  state.startedAt = new Date();
  state.endedAt = null;

  clearInterval(state.timerId);
  state.timerId = window.setInterval(() => {
    state.remainingSeconds -= 1;
    renderTimer();

    if (state.remainingSeconds <= 0) {
      submitExam();
    }
  }, 1000);

  renderTimer();
  renderSubjectSummary();
  renderQuestion();
  showScreen("exam");
}

function buildExamQuestions(subjects) {
  const questionMap = {};

  subjects.forEach((subject) => {
    const generators = SUBJECT_GENERATORS[subject];
    const questions = [];
    for (let index = 0; index < QUESTIONS_PER_SUBJECT; index += 1) {
      const generator = generators[index % generators.length];
      const question = generator(index);
      questions.push({
        ...question,
        id: `${subject}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
        subject,
        indexWithinSubject: index + 1,
        selectedAnswer: null,
      });
    }
    questionMap[subject] = questions;
  });

  return questionMap;
}

function renderSubjectSummary() {
  subjectSummary.innerHTML = state.subjects
    .map((subject, index) => {
      const isActive = index === state.currentSubjectIndex ? "active" : "";
      const isComplete = getSubjectAnsweredCount(subject) === QUESTIONS_PER_SUBJECT ? "complete" : "";
      const baseStyle = index === state.currentSubjectIndex
        ? ""
        : `style="background:${SUBJECT_COLORS[subject] || "#f5efe3"}"`;

      return `
        <button type="button" class="${isActive} ${isComplete}" data-subject-index="${index}" ${baseStyle}>
          ${subject}
        </button>
      `;
    })
    .join("");

  [...subjectSummary.querySelectorAll("button")].forEach((button) => {
    button.addEventListener("click", () => {
      const nextSubjectIndex = Number(button.dataset.subjectIndex);
      state.currentSubjectIndex = nextSubjectIndex;
      jumpToFirstUnansweredQuestion(nextSubjectIndex);
      renderQuestion();
    });
  });
}

function renderQuestion() {
  const subject = getCurrentSubject();
  const subjectQuestions = getCurrentSubjectQuestions();
  const question = subjectQuestions[state.currentQuestionIndex];
  if (!question) {
    return;
  }

  examTitle.textContent = `${subject} | Question ${state.currentQuestionIndex + 1}`;
  examMeta.textContent = `${getOverallAnsweredCount()} answered across all subjects`;
  questionTopic.textContent = question.topic;
  questionProgress.textContent = `${getSubjectAnsweredCount(subject)} answered in ${subject}`;
  subjectStage.textContent = `Subject ${state.currentSubjectIndex + 1} of ${state.subjects.length}`;
  paletteTitle.textContent = `${subject} palette`;
  subjectStageBanner.innerHTML = [
    `<span>${subject}</span>`,
    `<span>Question ${state.currentQuestionIndex + 1} of ${QUESTIONS_PER_SUBJECT}</span>`,
    `<span>${getCompletedSubjectCount()} subjects completed</span>`,
  ].join("");
  questionText.textContent = question.prompt;

  optionsList.innerHTML = question.options
    .map((option, optionIndex) => {
      const key = ["A", "B", "C", "D"][optionIndex];
      const selectedClass = question.selectedAnswer === optionIndex ? "selected" : "";
      return `
        <button class="option-btn ${selectedClass}" type="button" data-option-index="${optionIndex}">
          <span class="option-key">${key}</span>
          <span>${option}</span>
        </button>
      `;
    })
    .join("");

  [...optionsList.querySelectorAll(".option-btn")].forEach((button) => {
    button.addEventListener("click", () => {
      selectAnswer(Number(button.dataset.optionIndex));
    });
  });

  prevButton.disabled = state.currentQuestionIndex === 0;
  nextButton.textContent = getNextButtonLabel();

  renderPalette();
  renderSubjectSummary();
}

function renderPalette() {
  const subject = getCurrentSubject();
  const subjectQuestions = getCurrentSubjectQuestions();
  answeredCount.textContent = `${getSubjectAnsweredCount(subject)} / ${QUESTIONS_PER_SUBJECT} answered`;
  paletteGrid.innerHTML = subjectQuestions
    .map((question, index) => {
      const answeredClass = question.selectedAnswer !== null ? "answered" : "";
      const currentClass = index === state.currentQuestionIndex ? "current" : "";
      return `
        <button class="palette-btn ${answeredClass} ${currentClass}" type="button" data-question-index="${index}">
          ${question.indexWithinSubject}
        </button>
      `;
    })
    .join("");

  [...paletteGrid.querySelectorAll(".palette-btn")].forEach((button) => {
    button.addEventListener("click", () => {
      state.currentQuestionIndex = Number(button.dataset.questionIndex);
      renderQuestion();
    });
  });
}

function renderTimer() {
  timerDisplay.textContent = formatDuration(Math.max(0, state.remainingSeconds));
}

function selectAnswer(optionIndex) {
  getCurrentSubjectQuestions()[state.currentQuestionIndex].selectedAnswer = optionIndex;
  renderQuestion();
}

function moveQuestion(step) {
  const nextIndex = state.currentQuestionIndex + step;
  if (nextIndex < 0 || nextIndex >= QUESTIONS_PER_SUBJECT) {
    return;
  }

  state.currentQuestionIndex = nextIndex;
  renderQuestion();
}

function handleExamKeyboardShortcuts(event) {
  if (!screens.exam.classList.contains("active")) {
    return;
  }

  const key = event.key.toUpperCase();
  const optionMap = { A: 0, B: 1, C: 2, D: 3 };

  if (key in optionMap) {
    event.preventDefault();
    selectAnswer(optionMap[key]);
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveQuestion(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    advanceWithinExam();
    return;
  }

  if (["1", "2", "3", "4"].includes(event.key)) {
    const subjectIndex = Number(event.key) - 1;
    if (subjectIndex < state.subjects.length) {
      event.preventDefault();
      state.currentSubjectIndex = subjectIndex;
      jumpToFirstUnansweredQuestion(subjectIndex);
      renderQuestion();
    }
  }
}

function submitExam() {
  clearInterval(state.timerId);
  state.endedAt = new Date();
  const report = buildReport();
  saveSession(report);
  notifyPortal(report);
  renderResults(report);
  showScreen("result");
}

function notifyPortal(report) {
  const payload = {
    type: "pcims-jamb-complete",
    report: {
      candidateName: report.candidateName,
      totalPercent: report.totalPercent,
      totalCorrect: report.totalCorrect,
      totalQuestions: report.totalQuestions,
      answered: report.answered,
      subjects: report.subjects,
      subjectReports: report.subjectReports,
      startedAt: report.startedAt,
      endedAt: report.endedAt,
      bestSubject: report.bestSubject,
      weakestSubject: report.weakestSubject,
    },
  };

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, window.location.origin);
    }
  } catch (error) {
    console.error("Failed to notify portal frame", error);
  }

  // Same-origin portal API (Next.js proxies /api to Django).
  fetch("/api/cbt/jamb/progress/", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: `JAMB Practice — ${report.subjects.join(", ")}`,
      score_percent: report.totalPercent,
      subjects_json: report.subjectReports,
      source: "jamb-cbt-website",
      meta: {
        total_correct: report.totalCorrect,
        total_questions: report.totalQuestions,
        answered: report.answered,
        started_at: report.startedAt,
        ended_at: report.endedAt,
        best_subject: report.bestSubject?.subject,
        weakest_subject: report.weakestSubject?.subject,
      },
    }),
  }).catch((error) => {
    console.error("Failed to save JAMB progress", error);
  });
}

function buildReport() {
  const allQuestions = getAllQuestions();
  const totalCorrect = allQuestions.filter((question) => question.selectedAnswer === question.correctIndex).length;
  const answered = getOverallAnsweredCount();
  const totalPercent = Math.round((totalCorrect / allQuestions.length) * 100);

  const subjectReports = state.subjects.map((subject) => {
    const subjectQuestions = state.questionsBySubject[subject] || [];
    const correct = subjectQuestions.filter((question) => question.selectedAnswer === question.correctIndex).length;
    const answeredCountForSubject = subjectQuestions.filter((question) => question.selectedAnswer !== null).length;
    const percent = Math.round((correct / subjectQuestions.length) * 100);
    const topics = summarizeTopics(subjectQuestions);

    return {
      subject,
      correct,
      answered: answeredCountForSubject,
      total: subjectQuestions.length,
      percent,
      strongTopics: topics.filter((topic) => topic.percent >= 70).slice(0, 3),
      weakTopics: topics.filter((topic) => topic.percent < 60).slice(0, 3),
    };
  });

  const sortedSubjects = [...subjectReports].sort((left, right) => right.percent - left.percent);

  return {
    candidateName: state.candidateName,
    subjects: state.subjects,
    totalCorrect,
    totalQuestions: allQuestions.length,
    totalPercent,
    answered,
    startedAt: state.startedAt?.toISOString(),
    endedAt: state.endedAt?.toISOString(),
    subjectReports,
    bestSubject: sortedSubjects[0],
    weakestSubject: sortedSubjects[sortedSubjects.length - 1],
  };
}

function summarizeTopics(questions) {
  const topicMap = new Map();

  questions.forEach((question) => {
    const current = topicMap.get(question.topic) || { topic: question.topic, correct: 0, total: 0 };
    current.total += 1;
    if (question.selectedAnswer === question.correctIndex) {
      current.correct += 1;
    }
    topicMap.set(question.topic, current);
  });

  return [...topicMap.values()]
    .map((topic) => ({
      ...topic,
      percent: Math.round((topic.correct / topic.total) * 100),
    }))
    .sort((left, right) => left.percent - right.percent);
}

function renderResults(report) {
  resultTitle.textContent = `${report.candidateName}, here is your CBT performance summary`;
  totalScore.textContent = `${report.totalPercent}%`;
  answeredTotal.textContent = `${report.answered} / ${report.totalQuestions}`;
  bestSubject.textContent = `${report.bestSubject.subject} (${report.bestSubject.percent}%)`;
  weakestSubject.textContent = `${report.weakestSubject.subject} (${report.weakestSubject.percent}%)`;

  subjectResults.innerHTML = report.subjectReports
    .map((subjectReport) => {
      const strongTopicsMarkup = subjectReport.strongTopics.length
        ? subjectReport.strongTopics.map((topic) => `<span>${topic.topic} ${topic.percent}%</span>`).join("")
        : "<span>Build more attempts to unlock stronger topic patterns</span>";
      const weakTopicsMarkup = subjectReport.weakTopics.length
        ? subjectReport.weakTopics.map((topic) => `<span>${topic.topic} ${topic.percent}%</span>`).join("")
        : "<span>No weak topic detected in this subject</span>";

      return `
        <article class="subject-result-card">
          <div class="result-top">
            <div>
              <h3>${subjectReport.subject}</h3>
              <p class="muted">${subjectReport.correct} correct out of ${subjectReport.total}</p>
            </div>
            <div class="performance-pill">
              <small>Score</small>
              <strong>${subjectReport.percent}%</strong>
            </div>
          </div>
          <p><strong>Focus areas</strong></p>
          <div class="topic-list">${weakTopicsMarkup}</div>
          <p><strong>Strengths</strong></p>
          <div class="topic-list">${strongTopicsMarkup}</div>
        </article>
      `;
    })
    .join("");
}

function resetToSetup() {
  clearInterval(state.timerId);
  state.questionsBySubject = {};
  state.currentSubjectIndex = 0;
  state.currentQuestionIndex = 0;
  showScreen("setup");
}

function getCurrentSubject() {
  return state.subjects[state.currentSubjectIndex];
}

function getCurrentSubjectQuestions() {
  return state.questionsBySubject[getCurrentSubject()] || [];
}

function getAllQuestions() {
  return state.subjects.flatMap((subject) => state.questionsBySubject[subject] || []);
}

function getOverallAnsweredCount() {
  return getAllQuestions().filter((question) => question.selectedAnswer !== null).length;
}

function getSubjectAnsweredCount(subject) {
  return (state.questionsBySubject[subject] || []).filter((question) => question.selectedAnswer !== null).length;
}

function getCompletedSubjectCount() {
  return state.subjects.filter((subject) => getSubjectAnsweredCount(subject) === QUESTIONS_PER_SUBJECT).length;
}

function getNextButtonLabel() {
  const isLastQuestionInSubject = state.currentQuestionIndex === QUESTIONS_PER_SUBJECT - 1;
  const isLastSubject = state.currentSubjectIndex === state.subjects.length - 1;

  if (!isLastQuestionInSubject) {
    return "Next";
  }

  if (isLastSubject) {
    return "Submit exam";
  }

  return `Next subject: ${state.subjects[state.currentSubjectIndex + 1]}`;
}

function jumpToFirstUnansweredQuestion(subjectIndex) {
  const subject = state.subjects[subjectIndex];
  const subjectQuestions = state.questionsBySubject[subject] || [];
  const firstUnansweredIndex = subjectQuestions.findIndex((question) => question.selectedAnswer === null);
  state.currentQuestionIndex = firstUnansweredIndex === -1 ? 0 : firstUnansweredIndex;
}

function advanceWithinExam() {
  const isLastQuestionInSubject = state.currentQuestionIndex === QUESTIONS_PER_SUBJECT - 1;

  if (!isLastQuestionInSubject) {
    moveQuestion(1);
    return;
  }

  const nextSubjectIndex = state.currentSubjectIndex + 1;
  if (nextSubjectIndex < state.subjects.length) {
    state.currentSubjectIndex = nextSubjectIndex;
    jumpToFirstUnansweredQuestion(nextSubjectIndex);
    renderQuestion();
    return;
  }

  submitExam();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
}

function saveSession(report) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
}

function loadLastCandidateName() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return;
  }

  try {
    const report = JSON.parse(saved);
    if (report.candidateName) {
      candidateNameInput.value = report.candidateName;
    }
  } catch (error) {
    console.error("Failed to parse last session", error);
  }
}

function persistCandidateName(candidateName) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return;
  }

  try {
    const report = JSON.parse(saved);
    report.candidateName = candidateName;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch (error) {
    console.error("Failed to update candidate name", error);
  }
}

function formatDuration(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildOptions(correctAnswer, distractors, formatter = (value) => String(value)) {
  const optionValues = shuffleArray([correctAnswer, ...distractors]).slice(0, 4);
  return {
    options: optionValues.map(formatter),
    correctIndex: optionValues.findIndex((value) => value === correctAnswer),
  };
}

function generateEnglishGrammarQuestion() {
  const verbs = [
    { subject: "The team", base: "play", correct: "plays", wrong: "play" },
    { subject: "Each of the boys", base: "have", correct: "has", wrong: "have" },
    { subject: "My sister", base: "go", correct: "goes", wrong: "go" },
    { subject: "The committee", base: "meet", correct: "meets", wrong: "meet" },
  ];
  const choice = randomChoice(verbs);
  const sentenceEndings = ["every Saturday.", "before assembly.", "during revision time.", "at the school field."];
  const answer = choice.correct;
  const distractors = [choice.wrong, `${choice.base}ed`, `${choice.base}ing`];
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Grammar",
    prompt: `Choose the option that best completes the sentence: "${choice.subject} ${choice.base} ${randomChoice(sentenceEndings)}"`,
    options,
    correctIndex,
  };
}

function generateEnglishLexisQuestion() {
  const words = [
    { word: "diligent", answer: "hardworking", distractors: ["careless", "sleepy", "fearful"] },
    { word: "scarce", answer: "rare", distractors: ["plentiful", "ready", "bitter"] },
    { word: "commend", answer: "praise", distractors: ["blame", "question", "avoid"] },
    { word: "hostile", answer: "unfriendly", distractors: ["helpful", "cheerful", "timid"] },
  ];
  const choice = randomChoice(words);
  const { options, correctIndex } = buildOptions(choice.answer, choice.distractors);

  return {
    topic: "Lexis and structure",
    prompt: `Choose the option nearest in meaning to "${choice.word}".`,
    options,
    correctIndex,
  };
}

function generateEnglishComprehensionQuestion() {
  const passages = [
    {
      topic: "Comprehension",
      stem: "During the holiday, Tolu joined a reading club and discovered that regular practice improved her speed and confidence.",
      question: "What mainly improved Tolu's confidence?",
      answer: "regular practice",
      distractors: ["the holiday", "her friends", "the library building"],
    },
    {
      topic: "Comprehension",
      stem: "The principal announced that the debate would begin earlier so students could return home before the heavy rain.",
      question: "Why was the debate moved earlier?",
      answer: "to allow students leave before the rain",
      distractors: ["to extend the debate", "to welcome visitors", "to test the microphone"],
    },
  ];
  const choice = randomChoice(passages);
  const { options, correctIndex } = buildOptions(choice.answer, choice.distractors);

  return {
    topic: choice.topic,
    prompt: `${choice.stem} ${choice.question}`,
    options,
    correctIndex,
  };
}

function generateMathArithmeticQuestion() {
  const a = randomInt(12, 45);
  const b = randomInt(6, 20);
  const c = randomInt(2, 9);
  const answer = a + b * c;
  const distractors = [a * b + c, (a + b) * c, answer - randomInt(2, 8)];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value}`);

  return {
    topic: "Arithmetic",
    prompt: `Evaluate ${a} + ${b} x ${c}.`,
    options,
    correctIndex,
  };
}

function generateMathAlgebraQuestion() {
  const x = randomInt(3, 12);
  const coefficient = randomInt(2, 7);
  const constant = randomInt(4, 18);
  const result = coefficient * x + constant;
  const answer = x;
  const distractors = [x + 1, x - 1, x + 2].filter((value) => value > 0);
  while (distractors.length < 3) {
    distractors.push(answer + distractors.length + 3);
  }
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value}`);

  return {
    topic: "Algebra",
    prompt: `Solve for x: ${coefficient}x + ${constant} = ${result}.`,
    options,
    correctIndex,
  };
}

function generateMathGeometryQuestion() {
  const length = randomInt(4, 15);
  const width = randomInt(3, 12);
  const answer = 2 * (length + width);
  const distractors = [length * width, 2 * length * width, length + width];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value} cm`);

  return {
    topic: "Geometry",
    prompt: `Find the perimeter of a rectangle with length ${length} cm and width ${width} cm.`,
    options,
    correctIndex,
  };
}

function generateMathStatisticsQuestion() {
  const values = Array.from({ length: 5 }, () => randomInt(4, 20));
  const answer = values.reduce((sum, value) => sum + value, 0) / values.length;
  const distractors = [answer + 1, answer - 1, answer + 2];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => Number(value).toFixed(1));

  return {
    topic: "Statistics",
    prompt: `Find the mean of the numbers: ${values.join(", ")}.`,
    options,
    correctIndex,
  };
}

function generateBiologyEcologyQuestion() {
  const items = [
    ["forest", "high rainfall"],
    ["desert", "very low rainfall"],
    ["pond", "standing water"],
    ["grassland", "dominance of grasses"],
  ];
  const [habitat, feature] = randomChoice(items);
  const distractors = shuffleArray(items.filter(([name]) => name !== habitat).map(([, trait]) => trait)).slice(0, 3);
  const { options, correctIndex } = buildOptions(feature, distractors);

  return {
    topic: "Ecology",
    prompt: `Which feature is most closely associated with a ${habitat} habitat?`,
    options,
    correctIndex,
  };
}

function generateBiologyGeneticsQuestion() {
  const facts = [
    ["gene", "unit of heredity", ["organ of digestion", "group of tissues", "type of habitat"]],
    ["allele", "alternative form of a gene", ["dominant organism", "cell membrane", "blood group test"]],
    ["chromosome", "structure that carries genetic material", ["site of respiration", "part of the kidney", "digested food"]],
  ];
  const [term, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Genetics",
    prompt: `In biology, ${term} is best described as`,
    options,
    correctIndex,
  };
}

function generateBiologyHumanSystemQuestion() {
  const systems = [
    ["kidney", "excretion", ["circulation", "photosynthesis", "pollination"]],
    ["lungs", "gaseous exchange", ["food storage", "vision", "locomotion"]],
    ["heart", "blood pumping", ["egg production", "mineral absorption", "hearing"]],
  ];
  const [organ, answer, distractors] = randomChoice(systems);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Human systems",
    prompt: `The primary function of the ${organ} is`,
    options,
    correctIndex,
  };
}

function generateBiologyCellQuestion() {
  const facts = [
    ["mitochondrion", "site of energy release", ["controls inheritance", "forms cell wall", "stores pigments"]],
    ["nucleus", "controls cell activities", ["produces bile", "stores starch", "digests proteins"]],
    ["cell membrane", "regulates movement in and out", ["produces enzymes", "stores water only", "makes chlorophyll"]],
  ];
  const [part, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Cell biology",
    prompt: `In a typical cell, the ${part}`,
    options,
    correctIndex,
  };
}

function generateChemistryAtomicQuestion() {
  const elements = [
    ["Sodium", 11, "Na"],
    ["Magnesium", 12, "Mg"],
    ["Aluminium", 13, "Al"],
    ["Oxygen", 8, "O"],
  ];
  const [element, atomicNumber, symbol] = randomChoice(elements);
  const distractors = shuffleArray(
    elements.filter(([name]) => name !== element).map(([, number]) => number)
  ).slice(0, 3);
  const { options, correctIndex } = buildOptions(atomicNumber, distractors, (value) => `${value}`);

  return {
    topic: "Atomic structure",
    prompt: `What is the atomic number of ${element} (${symbol})?`,
    options,
    correctIndex,
  };
}

function generateChemistryAcidBaseQuestion() {
  const facts = [
    ["litmus paper turns red in", "acidic solution", ["neutral salt", "basic solution", "distilled water"]],
    ["a pH greater than 7 indicates", "alkalinity", ["strong acidity", "neutrality only", "radioactivity"]],
    ["the reaction of an acid with a base is called", "neutralization", ["distillation", "electrolysis", "filtration"]],
  ];
  const [stem, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Acids and bases",
    prompt: `In chemistry, ${stem}`,
    options,
    correctIndex,
  };
}

function generateChemistryGasQuestion() {
  const volume = randomInt(2, 9);
  const temperature = randomInt(270, 320);
  const newTemperature = temperature + randomInt(20, 60);
  const answer = Number(((volume * newTemperature) / temperature).toFixed(1));
  const distractors = [answer + 0.5, answer - 0.6, answer + 1.2].map((value) => Number(value.toFixed(1)));
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value} L`);

  return {
    topic: "Gas laws",
    prompt: `A gas occupies ${volume} L at ${temperature} K. Assuming pressure is constant, what volume will it occupy at ${newTemperature} K?`,
    options,
    correctIndex,
  };
}

function generateChemistryBondingQuestion() {
  const facts = [
    ["ionic bond", "transfer of electrons", ["sharing of neutrons", "melting of metals", "mixing of gases"]],
    ["covalent bond", "sharing of electrons", ["gain of protons", "reaction with water", "crystallization only"]],
    ["metallic bond", "sea of delocalized electrons", ["equal sharing of ions", "bond between acids", "movement of molecules"]],
  ];
  const [term, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Chemical bonding",
    prompt: `${term} involves`,
    options,
    correctIndex,
  };
}

function generatePhysicsMotionQuestion() {
  const speed = randomInt(10, 30);
  const time = randomInt(4, 12);
  const answer = speed * time;
  const distractors = [speed + time, speed * (time - 1), answer + speed];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value} m`);

  return {
    topic: "Motion",
    prompt: `A car travels at ${speed} m/s for ${time} s. Find the distance covered.`,
    options,
    correctIndex,
  };
}

function generatePhysicsForceQuestion() {
  const mass = randomInt(2, 12);
  const acceleration = randomInt(2, 8);
  const answer = mass * acceleration;
  const distractors = [mass + acceleration, answer - acceleration, answer + mass];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value} N`);

  return {
    topic: "Force",
    prompt: `Find the force on a body of mass ${mass} kg accelerating at ${acceleration} m/s².`,
    options,
    correctIndex,
  };
}

function generatePhysicsElectricityQuestion() {
  const current = randomInt(2, 8);
  const resistance = randomInt(3, 10);
  const answer = current * resistance;
  const distractors = [current + resistance, answer - 2, answer + 3];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value} V`);

  return {
    topic: "Electricity",
    prompt: `Using Ohm's law, calculate the voltage across a resistor of ${resistance} ohms when the current is ${current} A.`,
    options,
    correctIndex,
  };
}

function generatePhysicsWaveQuestion() {
  const frequency = randomInt(2, 15);
  const wavelength = randomInt(2, 9);
  const answer = frequency * wavelength;
  const distractors = [frequency + wavelength, answer + wavelength, answer - frequency];
  const { options, correctIndex } = buildOptions(answer, distractors, (value) => `${value} m/s`);

  return {
    topic: "Waves",
    prompt: `A wave has frequency ${frequency} Hz and wavelength ${wavelength} m. Find its speed.`,
    options,
    correctIndex,
  };
}

function generateEconomicsDemandQuestion() {
  const facts = [
    ["the price of a normal good falls", "quantity demanded usually rises", ["supply becomes fixed immediately", "consumer wants disappear", "production stops automatically"]],
    ["consumer income rises for a normal good", "demand may increase", ["cost of production must fall", "market price becomes zero", "quantity supplied vanishes"]],
    ["the price of a good rises", "quantity demanded may fall", ["all firms shut down", "inflation ends instantly", "supply law is cancelled"]],
  ];
  const [stem, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Demand and supply",
    prompt: `In economics, when ${stem},`,
    options,
    correctIndex,
  };
}

function generateEconomicsInflationQuestion() {
  const facts = [
    ["persistent rise in the general price level", ["fall in literacy rate", "increase in rainfall", "rise in exports only"]],
    ["reduction in the purchasing power of money", ["automatic tax removal", "growth in population only", "improved transportation"]],
  ];
  const [answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Inflation",
    prompt: `Inflation is best described as`,
    options,
    correctIndex,
  };
}

function generateEconomicsOpportunityCostQuestion() {
  const activities = [
    ["buying textbooks instead of a new phone", "the value of the phone forgone"],
    ["attending lessons instead of going to a party", "the benefit lost from missing the party"],
    ["saving money instead of spending it immediately", "the satisfaction sacrificed from current spending"],
  ];
  const [scenario, answer] = randomChoice(activities);
  const distractors = [
    "the market price of petrol",
    "the salary of a teacher",
    "the total quantity supplied",
  ];
  const { options, correctIndex } = buildOptions(answer, shuffleArray(distractors).slice(0, 3));

  return {
    topic: "Opportunity cost",
    prompt: `In the case of ${scenario}, opportunity cost is`,
    options,
    correctIndex,
  };
}

function generateEconomicsMarketQuestion() {
  const facts = [
    ["perfect competition", "many buyers and sellers", ["one seller only", "government ownership only", "no information for consumers"]],
    ["monopoly", "single dominant seller", ["many identical sellers", "buyers control prices alone", "products are always imported"]],
    ["market equilibrium", "where demand equals supply", ["where imports stop", "when inflation is highest", "when only luxury goods are sold"]],
  ];
  const [term, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Market structures",
    prompt: `${term} refers to`,
    options,
    correctIndex,
  };
}

function generateGovernmentDemocracyQuestion() {
  const facts = [
    ["democracy", "government based on the will of the people", ["rule by military decree", "government by judges alone", "power inherited by force"]],
    ["rule of law", "everyone is subject to the law", ["only leaders obey the law", "law is suspended during elections", "citizens do not have rights"]],
    ["separation of powers", "division of government functions among arms", ["fusion of all powers in one office", "election without parties", "abolition of the judiciary"]],
  ];
  const [term, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Political principles",
    prompt: `In government, ${term} means`,
    options,
    correctIndex,
  };
}

function generateGovernmentCitizenshipQuestion() {
  const facts = [
    ["citizenship by birth", "being born in a country or to its citizens", ["buying only imported goods", "contesting an election", "working in the civil service"]],
    ["fundamental human rights", "basic freedoms protected by law", ["orders from political parties", "military ranks", "tax receipts"]],
    ["civic responsibility", "duties citizens owe the state", ["government loans only", "foreign policy speeches", "traditional dances"]],
  ];
  const [term, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Citizenship",
    prompt: `${term} refers to`,
    options,
    correctIndex,
  };
}

function generateGovernmentArmsQuestion() {
  const facts = [
    ["legislature", "makes laws", ["interprets laws", "enforces laws only", "conducts population census"]],
    ["executive", "implements laws and policies", ["declares exam results", "elects judges", "writes the constitution alone"]],
    ["judiciary", "interprets the law", ["prints currency only", "conducts campaigns", "controls weather patterns"]],
  ];
  const [arm, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Arms of government",
    prompt: `The main function of the ${arm} is to`,
    options,
    correctIndex,
  };
}

function generateGovernmentElectoralQuestion() {
  const facts = [
    ["secret ballot", "protects voter choice from intimidation", ["allows only public voting", "removes political parties", "prevents registration"]],
    ["electoral commission", "organizes and supervises elections", ["interprets court judgments", "passes appropriation bills", "appoints traditional rulers"]],
    ["manifesto", "statement of a party's plans and promises", ["official list of judges", "record of tax payments", "military training manual"]],
  ];
  const [term, answer, distractors] = randomChoice(facts);
  const { options, correctIndex } = buildOptions(answer, distractors);

  return {
    topic: "Electoral process",
    prompt: `In an election, ${term}`,
    options,
    correctIndex,
  };
}
