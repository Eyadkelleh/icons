"use client";

import { motion, type Transition, type Variants } from "motion/react";
import { type ComponentType, createElement, type ReactElement } from "react";

import {
  type Channel,
  type Keyframes,
  type MotionPlan,
  REST_POSE,
  type SvgNode,
  type Track,
} from "@/lib/icon-reading";

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

const FEEL: Record<Track["feel"], Transition> = {
  ease: { ease: "easeInOut" },
  spring: { type: "spring", stiffness: 200, damping: 10 },
};

const TRANSFORM_CHANNELS = new Set<Channel>([
  "x",
  "y",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
]);

function restPose(frames: Keyframes): Record<string, number> {
  const pose: Record<string, number> = {};
  for (const channel of Object.keys(frames) as Channel[]) {
    pose[channel] = REST_POSE[channel];
  }
  return pose;
}

function trackProps(track: Track, duration: number, loop: boolean) {
  return {
    "data-animated": "",
    variants: {
      normal: restPose(track.frames),
      animate: track.frames,
    } as Variants,
    style: {
      transformBox: "view-box" as const,
      originX: `${track.origin.x}px`,
      originY: `${track.origin.y}px`,
    },
    transition: {
      ...FEEL[track.feel],
      duration,
      delay: track.delay,
      ...(loop ? { repeat: Number.POSITIVE_INFINITY } : {}),
    },
  };
}

export type MotionPhase = "normal" | "animate";

type MotionFigureProps = {
  tree: SvgNode;
  plan: MotionPlan;
  phase: MotionPhase;
  size: number;
};

export const MotionFigure = ({
  tree,
  plan,
  phase,
  size,
}: MotionFigureProps) => {
  const renderNode = (node: SvgNode): ReactElement => {
    const found = node.key === "root" ? undefined : plan.tracks.get(node.key);
    const usesTransform = Boolean(
      found &&
        Object.keys(found.frames).some((ch) =>
          TRANSFORM_CHANNELS.has(ch as Channel)
        )
    );
    const wrap = Boolean(node.props.transform && usesTransform);
    const motionProps = found
      ? trackProps(found, plan.duration, plan.repeat === "loop")
      : undefined;
    const children = node.children.map((child) => renderNode(child));
    const element = createElement(
      MOTION_TAGS[node.tag],
      {
        key: node.key,
        ...node.props,
        ...(wrap ? {} : motionProps),
      },
      children
    );
    if (!(wrap && motionProps)) {
      return element;
    }
    return createElement(
      motion.g,
      { key: `${node.key}-pivot`, ...motionProps },
      element
    );
  };

  const { width: _w, height: _h, ...rootProps } = tree.props;
  const allTrack = plan.tracks.get("all");

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
      variants: { normal: {}, animate: {} },
      style: { overflow: "visible" },
    },
    createElement(
      motion.g,
      {
        key: "all",
        ...(allTrack
          ? trackProps(allTrack, plan.duration, plan.repeat === "loop")
          : {}),
      },
      tree.children.map((child) => renderNode(child))
    )
  );
};
