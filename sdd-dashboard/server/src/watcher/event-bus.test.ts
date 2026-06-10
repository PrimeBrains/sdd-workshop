import { describe, expect, it } from "vitest";
import type { ChangeEvent } from "../types/events.js";
import { createEventBus } from "./event-bus.js";

function makeEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    type: "change",
    path: ".kiro/specs/demo/requirements.md",
    category: "spec",
    feature: "demo",
    at: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("createEventBus", () => {
  it("publish したイベントが subscriber に届く（8.2）", () => {
    const bus = createEventBus();
    const received: ChangeEvent[] = [];
    bus.subscribe((event) => received.push(event));

    const event = makeEvent();
    bus.publish(event);

    expect(received).toEqual([event]);
  });

  it("複数 subscriber 全員へ同一イベントを同報する（8.6）", () => {
    const bus = createEventBus();
    const a: ChangeEvent[] = [];
    const b: ChangeEvent[] = [];
    bus.subscribe((event) => a.push(event));
    bus.subscribe((event) => b.push(event));

    const event = makeEvent();
    bus.publish(event);

    expect(a).toEqual([event]);
    expect(b).toEqual([event]);
  });

  it("subscribe の戻り値（unsubscribe）呼び出し後はイベントが届かない（8.5）", () => {
    const bus = createEventBus();
    const received: ChangeEvent[] = [];
    const unsubscribe = bus.subscribe((event) => received.push(event));

    bus.publish(makeEvent({ path: "a.md" }));
    unsubscribe();
    bus.publish(makeEvent({ path: "b.md" }));

    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("a.md");
  });

  it("unsubscribe を二重に呼んでも安全で、他の subscriber に影響しない", () => {
    const bus = createEventBus();
    const a: ChangeEvent[] = [];
    const b: ChangeEvent[] = [];
    const unsubscribeA = bus.subscribe((event) => a.push(event));
    bus.subscribe((event) => b.push(event));

    unsubscribeA();
    unsubscribeA();
    bus.publish(makeEvent());

    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });

  it("ある listener が例外を投げても他の listener への配信は継続する（8.6）", () => {
    const bus = createEventBus();
    const received: ChangeEvent[] = [];
    bus.subscribe(() => {
      throw new Error("listener failure");
    });
    bus.subscribe((event) => received.push(event));

    expect(() => bus.publish(makeEvent())).not.toThrow();
    expect(received).toHaveLength(1);
  });

  it("同一の listener 関数を二度 subscribe すると二回届き、片方だけ解除できる", () => {
    const bus = createEventBus();
    const received: ChangeEvent[] = [];
    const listener = (event: ChangeEvent) => received.push(event);
    const unsubscribeFirst = bus.subscribe(listener);
    bus.subscribe(listener);

    bus.publish(makeEvent());
    expect(received).toHaveLength(2);

    unsubscribeFirst();
    bus.publish(makeEvent());
    expect(received).toHaveLength(3);
  });
});
