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
  "data-order-scope"?: string;
  className?: string;
};
const sectionFamilies: Record<string, string> = {
  "activity:경력": "experiences",
  "activity:학력": "academic_records",
  "activity:교육 이수": "educations",
  "activity:교육·연수": "educations",
  "activity:자격·면허": "licenses",
  "activity:자격/면허": "licenses",
  "activity:근무 기관": "workplace",
  "activity:소개": "introduction",
};

function combineSections(nodes: ReactNode[]) {
  const result: ReactNode[] = [];
  const indexes = new Map<string, number>();
  for (const node of nodes) {
    if (!isValidElement<Props>(node) || !node.props["data-order-key"]) {
      result.push(node);
      continue;
    }
    const key = node.props["data-order-key"]!;
    const family = sectionFamilies[key] ?? key;
    const index = indexes.get(family);
    if (index === undefined) {
      indexes.set(family, result.length);
      result.push(node);
      continue;
    }
    const previous = result[index] as ReactElement<Props>;
    const preferred = key === family ? node : previous;
    // Keep each source's saved item-order scope while sharing one visible card.
    result[index] = cloneElement(
      preferred,
      {},
      <div className="space-y-2">
        <div data-order-scope={previous.props["data-order-key"]}>
          {previous.props.children}
        </div>
        <div data-order-scope={key}>{node.props.children}</div>
      </div>,
    );
  }
  return result;
}
export function ProfileOrderLayout({
  children,
  order = {},
  onChange,
  combineSimilarSections = false,
  className,
}: {
  children: ReactNode;
  order?: ProfileOrder;
  onChange?: (order: ProfileOrder) => void;
  combineSimilarSections?: boolean;
  className?: string;
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
        className={`absolute z-20 ${group === "sections" ? "-left-8 top-4" : "left-0 top-1/2 -translate-y-1/2"}`}
      >
        <button
          type="button"
          aria-label={`${label} 순서 이동`}
          title="드래그해서 순서 변경 · 위아래 방향키로도 이동할 수 있어요"
          aria-keyshortcuts="ArrowUp ArrowDown"
          className="profile-order-handle relative flex h-9 w-7 touch-none cursor-grab items-center justify-center rounded-full border border-transparent bg-transparent text-slate-300 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:cursor-grabbing active:bg-blue-100"
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
          <span aria-hidden="true" className="profile-order-rail" />
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
    const list =
      group === "sections" && combineSimilarSections
        ? combineSections(flatten(nodes))
        : flatten(nodes);
    const marked = list.filter(
      (n): n is ReactElement<Props> =>
        isValidElement<Props>(n) && !!n.props["data-order-key"],
    );
    const saved = Array.isArray(order[group]) ? order[group] : [];
    const rank = (key: string) => {
      const i = saved.findIndex(
        (savedKey) =>
          savedKey === key ||
          (group === "sections" &&
            combineSimilarSections &&
            (sectionFamilies[savedKey] ?? savedKey) ===
              (sectionFamilies[key] ?? key)),
      );
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
          : walk(
              node.props.children,
              key || node.props["data-order-scope"] || group,
            );
      const element = cloneElement(node, { key: node.key ?? i }, nested);
      if (!key) return element;
      if (
        !onChange ||
        key === "specialties" ||
        group === "specialties" ||
        movableKeys.length < 2
      )
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
        "data-order-dragging": drag?.token === group + key || undefined,
        className: `relative ${group !== "sections" ? "pl-9" : ""} ${over === group + key && drag?.token !== group + key ? "before:absolute before:inset-x-0 before:-top-3 before:h-0.5 before:bg-blue-500" : ""}`,
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
    <div className={className ?? "mt-5 space-y-3 sm:mt-6 sm:space-y-4"}>
      {walk(children, "sections")}
    </div>
  );
}
