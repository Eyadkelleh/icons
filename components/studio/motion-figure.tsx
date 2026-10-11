"use client";

import { motion, type Transition, type Variants } from "motion/react";
import { type ComponentType, createElement, type ReactElement } from "react";

import type { SvgNode } from "@/components/studio/svg-tree";
import type { AnimationPattern } from "@/lib/animation-patterns";

const MOTION_TAGS = {
  svg: motion.svg,
  g: motion.g,
  path: motion.path,
  circle: motion.circle,
  ellipse: motion.ellipse,
  rect: motion.rect,
  line: motion.line,
  polyline: motion.polyline,
  polygon: motion.polygon,
} as Record<SvgNode["tag"], ComponentType<Record<string, unknown>>>;

const BASE_TRANSITION: Transition = { duration: 0.5, ease: "easeInOut" };
const STAGGER_S = 0.06;

/** Patterns that must only draw open strokes (shackle, check), never the whole icon. */
const OPEN_STROKE_PATTERNS = new Set<AnimationPattern["id"]>([
  "semantic-path-length",
]);
const OPEN_STROKE_TAGS = new Set<SvgNode["tag"]>(["path", "line", "polyline"]);

/**
 * Keys of the nodes that receive the pattern's variants.
 * Keys are child-index paths from the root, e.g. "0-2".
 */
export function animatedKeys(
  tree: SvgNode,
  pattern: Pick<AnimationPattern, "id" | "target">
): string[] {
  const { target } = pattern;
  const top = tree.children.map((child, index) => ({
    node: child,
    key: `${index}`,
  }));
  if (target === "svg") {
    return ["root"];
  }
  if (target === "group") {
    const groups = top.filter(({ node }) => node.tag === "g");
    return (groups.length > 0 ? groups : top).map(({ key }) => key);
  }
  if (target === "layers") {
    const only = top.length === 1 && top[0].node.tag === "g" ? top[0] : null;
    const layers = only
      ? only.node.children.map((_, index) => `${only.key}-${index}`)
      : top.map(({ key }) => key);
    return layers.length > 1 ? layers.slice(1) : layers;
  }
  const leaves: { key: string; tag: SvgNode["tag"] }[] = [];
  const walk = (node: SvgNode, key: string) => {
    if (node.tag !== "g") {
      leaves.push({ key, tag: node.tag });
      return;
    }
    for (const [index, child] of node.children.entries()) {
      walk(child, `${key}-${index}`);
    }
  };
  for (const { node, key } of top) {
    walk(node, key);
  }
  if (OPEN_STROKE_PATTERNS.has(pattern.id)) {
    const strokes = leaves.filter(({ tag }) => OPEN_STROKE_TAGS.has(tag));
    if (strokes.length > 0) {
      return strokes.map(({ key }) => key);
    }
  }
  return leaves.map(({ key }) => key);
}

export type MotionPhase = "normal" | "animate";

type MotionFigureProps = {
  tree: SvgNode;
  pattern: AnimationPattern;
  phase: MotionPhase;
  size: number;
};

export const MotionFigure = ({
  tree,
  pattern,
  phase,
  size,
}: MotionFigureProps) => {
  const order = new Map(
    animatedKeys(tree, pattern).map((key, index) => [key, index])
  );

  const renderNode = (node: SvgNode, key: string): ReactElement => {
    const index = order.get(key);
    const animated = index !== undefined;
    return createElement(
      MOTION_TAGS[node.tag],
      {
        key,
        ...node.props,
        "data-animated": animated ? "" : undefined,
        variants: animated ? pattern.variants : undefined,
        transition: animated
          ? { ...BASE_TRANSITION, delay: index * STAGGER_S }
          : undefined,
      },
      node.children.map((child, childIndex) =>
        renderNode(child, `${key}-${childIndex}`)
      )
    );
  };

  const { width: _w, height: _h, ...rootProps } = tree.props;
  const rootAnimated = order.has("root");
  const rootVariants: Variants | undefined = rootAnimated
    ? pattern.variants
    : { normal: {}, animate: {} };

  return createElement(
    motion.svg,
    {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "currentColor",
      ...rootProps,
      width: size,
      height: size,
      "aria-hidden": true,
      initial: "normal",
      animate: phase,
      variants: rootVariants,
      transition: BASE_TRANSITION,
      style: { overflow: "visible" },
    },
    tree.children.map((child, index) => renderNode(child, `${index}`))
  );
};
