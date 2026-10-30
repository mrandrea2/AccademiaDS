import type { Attempt, DocumentRecord, Question, Review } from "./models";
/** SM-2: grades 0–5, calendar intervals in days. */
export function scheduleReview(
  previous: Review | undefined,
  quality: number,
  now = new Date(),
): Review {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5)
    throw new Error("Valutazione non valida");
  const old = previous ?? {
    cardId: "",
    repetitions: 0,
    interval: 0,
    ease: 2.5,
    due: now.toISOString(),
  };
  const ease = Math.max(
    1.3,
    old.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  );
  const repetitions = quality < 3 ? 0 : old.repetitions + 1;
  const interval =
    quality < 3
      ? 1
      : repetitions === 1
        ? 1
        : repetitions === 2
          ? 6
          : Math.round(old.interval * old.ease);
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + interval);
  return {
    ...old,
    repetitions,
    interval,
    ease,
    due: due.toISOString(),
    reviewedAt: now.toISOString(),
    quality,
  };
}
export function shuffle<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function prepareQuestions(questions: Question[], count: number) {
  return shuffle(questions)
    .slice(0, count)
    .map((q) => ({ ...q, options: shuffle(q.options) }));
}
export function accuracy(attempts: Attempt[]) {
  return attempts.length
    ? Math.round(
        (attempts.filter((a) => a.correct).length / attempts.length) * 100,
      )
    : 0;
}
export function weakTopics(attempts: Attempt[]) {
  return [...new Set(attempts.map((a) => a.topicId))]
    .map((id) => ({
      id,
      accuracy: accuracy(attempts.filter((a) => a.topicId === id)),
      count: attempts.filter((a) => a.topicId === id).length,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}
export function retrieve(
  query: string,
  documents: DocumentRecord[],
  limit = 4,
) {
  const words = [
    ...new Set(query.toLocaleLowerCase("it").match(/[\p{L}\p{N}]{3,}/gu) ?? []),
  ];
  return documents
    .flatMap((doc) =>
      doc.text.split(/\f/).flatMap((page, index) => {
        const chunks = page.match(/[\s\S]{1,1200}/g) ?? [];
        return chunks.map((text, chunk) => ({
          documentId: doc.id,
          title: doc.title,
          page: index + 1,
          version: doc.source.version,
          text,
          chunk,
          score: words.reduce(
            (sum, w) =>
              sum + (text.toLocaleLowerCase("it").includes(w) ? 1 : 0),
            0,
          ),
        }));
      }),
    )
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
