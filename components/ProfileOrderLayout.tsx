"use client";
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type ReactElement,
} from "react";
export type ProfileOrder = Record<string, string[]>;
export function moveProfileItem(keys: string[], from: string, to: string) {
  const next = [...keys];
  const a = next.indexOf(from);
  const b = next.indexOf(to);
  if (a < 0 || b < 0 || a === b) return next;
  next.splice(a, 1);
  next.splice(b, 0, from);
  return next;
}
type Props = {
  children?: ReactNode;
  "data-order-key"?: string;
  className?: string;
};
export function ProfileOrderLayout({
  children,
  order = {},
  onChange,
}: {
  children: ReactNode;
  order?: ProfileOrder;
  onChange?: (order: ProfileOrder) => void;
}) {
  const [drag, setDrag] = useState<{
    token: string;
    x: number;
    y: number;
  } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  function handle(group: string, key: string, keys: string[], label: string) {
    const token = group + key;
    const move = (to: string) => {
      onChange?.({ ...order, [group]: moveProfileItem(keys, key, to) });
    };
    return (
      <span
        key="order-handle"
        data-order-handle
        className={`absolute ${group === "sections" ? "-left-3" : "-left-6"} top-1/2 z-20 -translate-y-1/2`}
      >
        <button
          type="button"
          aria-label={`${label} 순서 이동`}
          title="잡아서 원하는 위치로 끌어주세요"
          className="flex size-6 cursor-grab active:cursor-grabbing touch-none items-center justify-center rounded-md border border-slate-100 bg-white text-sm text-slate-300 shadow-sm hover:border-blue-200 hover:text-blue-600 focus-visible:outline-blue-600"
          onKeyDown={(event) => {
            const i = keys.indexOf(key);
            if (event.key === "ArrowUp" && i > 0) {
              event.preventDefault();
              move(keys[i - 1]);
            }
            if (event.key === "ArrowDown" && i < keys.length - 1) {
              event.preventDefault();
              move(keys[i + 1]);
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            cleanup.current?.();
            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            let moved = false;
            let target = key;
            const pointerMove = (e: PointerEvent) => {
              if (Math.abs(e.clientY - startY) < 5 && !moved) return;
              moved = true;
              setDrag({ token, x: e.clientX - startX, y: e.clientY - startY });

              e.preventDefault();
              const element = document
                .elementsFromPoint(e.clientX, e.clientY)
                .find((el) => el.getAttribute("data-order-group") === group);
              const found = element?.getAttribute("data-order-target");
              if (found && found !== "specialties" && keys.includes(found)) {
                target = found;
                setOver(group + found);
              }
              if (e.clientY < 110) window.scrollBy(0, -18);
              else if (e.clientY > window.innerHeight - 90)
                window.scrollBy(0, 18);
            };
            const finish = () => {
              cleanup.current?.();
              setOver(null);
              setDrag(null);
              if (moved) {
                move(target);
              }
            };
            const cancel = () => {
              cleanup.current?.();
              setOver(null);
              setDrag(null);
            };
            const escape = (e: KeyboardEvent) => {
              if (e.key === "Escape") cancel();
            };
            document.addEventListener("keydown", escape);
            document.addEventListener("pointermove", pointerMove, {
              passive: false,
            });
            document.addEventListener("pointerup", finish, { once: true });
            document.addEventListener("pointercancel", cancel, { once: true });
            cleanup.current = () => {
              document.removeEventListener("keydown", escape);
              document.removeEventListener("pointermove", pointerMove);
              document.removeEventListener("pointerup", finish);
              document.removeEventListener("pointercancel", cancel);
              cleanup.current = null;
            };
          }}
        >
          ☰
        </button>
      </span>
    );
  }
  function flatten(nodes: ReactNode): ReactNode[] {
    return Children.toArray(nodes).flatMap((n) =>
      isValidElement<Props>(n) && n.type === Fragment
        ? flatten(n.props.children)
        : [n],
    );
  }
  function walk(nodes: ReactNode, group: string): ReactNode {
    const list = flatten(nodes);
    const marked = list.filter(
      (n): n is ReactElement<Props> =>
        isValidElement<Props>(n) && !!n.props["data-order-key"],
    );
    const saved = Array.isArray(order[group]) ? order[group] : [];
    const rank = (key: string) => {
      const i = saved.indexOf(key);
      return i < 0
        ? saved.length +
            marked.findIndex((n) => n.props["data-order-key"] === key)
        : i;
    };
    const sorted = [...marked].sort((a, b) =>
      group === "sections" && a.props["data-order-key"] === "specialties"
        ? -1
        : group === "sections" && b.props["data-order-key"] === "specialties"
          ? 1
          : rank(a.props["data-order-key"]!) - rank(b.props["data-order-key"]!),
    );
    const keys = sorted.map((n) => n.props["data-order-key"]!);
    const movableKeys =
      group === "sections" ? keys.filter((key) => key !== "specialties") : keys;
    let index = 0;
    return list.map((original, i) => {
      if (!isValidElement<Props>(original)) return original;
      const node = original.props["data-order-key"]
        ? sorted[index++]
        : original;
      const key = node.props["data-order-key"];
      const nested =
        node.props.children === undefined
          ? undefined
          : walk(node.props.children, key || group);
      const element = cloneElement(node, { key: node.key ?? i }, nested);
      if (!key) return element;
      if (!onChange || key === "specialties" || group === "specialties")
        return element;
      const label =
        typeof (node.props as { title?: string }).title === "string"
          ? (node.props as { title?: string }).title!
          : group === "sections"
            ? "섹션"
            : "항목";
      const attrs = {
        "data-order-group": group,
        "data-order-target": key,
        className: `relative ${over === group + key && drag?.token !== group + key ? "before:absolute before:inset-x-0 before:-top-3 before:h-0.5 before:bg-blue-500" : ""}`,
        style:
          drag?.token === group + key
            ? {
                transform: `translate(${drag.x}px, ${drag.y}px)`,
                zIndex: 50,
                pointerEvents: "none" as const,
                boxShadow: "0 18px 50px #0f172a26",
                background: "white",
                borderRadius: 16,
                opacity: 0.94,
              }
            : undefined,
      };
      if (node.type === "li" || node.type === "article")
        return cloneElement(
          node,
          {
            ...attrs,
            key: node.key ?? i,
            className: attrs.className + " " + (node.props.className || ""),
          },
          handle(group, key, movableKeys, label),
          nested,
        );
      return (
        <div {...attrs} key={key}>
          {handle(group, key, movableKeys, label)}
          {element}
        </div>
      );
    });
  }
  return (
    <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
      {walk(children, "sections")}
    </div>
  );
}
