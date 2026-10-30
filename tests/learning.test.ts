import { describe, it, expect } from "vitest";
import {
  scheduleReview,
  shuffle,
  accuracy,
  retrieve,
  weakTopics,
} from "../lib/learning";
import { demoSource, emptyState, questions } from "../lib/content";
import { documentSchema, stateSchema } from "../lib/validation";
describe("SM-2", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  it("schedules successful first and second recalls at 1 and 6 days", () => {
    const first = scheduleReview(undefined, 4, now);
    expect(first.interval).toBe(1);
    expect(first.due).toBe("2026-10-31T10:00:00.000Z");
    const second = scheduleReview(first, 4, now);
    expect(second.interval).toBe(6);
    expect(scheduleReview(second, 4, now).interval).toBe(15);
  });
  it("resets repetitions after forgetting and clamps ease", () => {
    let review = scheduleReview(undefined, 5, now);
    for (let i = 0; i < 20; i++) review = scheduleReview(review, 0, now);
    expect(review.ease).toBe(1.3);
    expect(review.interval).toBe(1);
    expect(review.repetitions).toBe(0);
  });
  it("rejects invalid grades", () => {
    expect(() => scheduleReview(undefined, 6)).toThrow();
    expect(() => scheduleReview(undefined, 2.5)).toThrow();
  });
});
describe("quiz integrity", () => {
  it("shuffles without mutating or changing the correct answer identity", () => {
    const q = questions[0];
    const original = q.options.map((o) => o.id);
    const changed = shuffle(q.options, () => 0);
    expect(q.options.map((o) => o.id)).toEqual(original);
    expect(changed.map((o) => o.id)).not.toEqual(original);
    expect(changed.find((o) => o.id === q.correctOptionId)?.text).toContain(
      "Raccogliere",
    );
  });
  it("keeps all items in every permutation", () => {
    for (let i = 0; i < 100; i++)
      expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
  it("computes measured accuracy only", () => {
    expect(accuracy([])).toBe(0);
    const a = {
      id: "a",
      questionId: "q",
      topicId: "t",
      selectedOptionId: "o",
      correct: true,
      seconds: 2,
      at: new Date().toISOString(),
    };
    expect(accuracy([a, { ...a, id: "b", correct: false }])).toBe(50);
    expect(weakTopics([a])[0].count).toBe(1);
  });
});
describe("private document retrieval", () => {
  const doc = {
    id: "d",
    title: "Documento personale",
    text: "Appunti sulla gestione del gruppo di lavoro.\fSeconda pagina sulla valutazione degli esiti.",
    tags: [],
    createdAt: new Date().toISOString(),
    source: demoSource,
  };
  it("preserves page and version references", () => {
    const hits = retrieve("valutazione", [doc]);
    expect(hits).toHaveLength(1);
    expect(hits[0].page).toBe(2);
    expect(hits[0].version).toBe("demo-1");
  });
  it("abstains when no source matches", () => {
    expect(retrieve("contabilità", [doc])).toEqual([]);
    expect(retrieve("gestione", [])).toEqual([]);
  });
  it("validates imports and rejects excessive content", () => {
    expect(documentSchema.safeParse(doc).success).toBe(true);
    expect(
      documentSchema.safeParse({ ...doc, text: "x".repeat(150001) }).success,
    ).toBe(false);
    expect(stateSchema.safeParse(emptyState()).success).toBe(true);
    expect(
      stateSchema.safeParse({ ...emptyState(), goal: { weeklyMinutes: -1 } })
        .success,
    ).toBe(false);
  });
});
