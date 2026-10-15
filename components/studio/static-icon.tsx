import { createElement, type ReactElement } from "react";

import type { SvgNode } from "@/lib/icon-reading";

type StaticIconProps = {
  tree: SvgNode;
  size: number;
};

export const StaticIcon = ({ tree, size }: StaticIconProps) => {
  const renderNode = (node: SvgNode): ReactElement =>
    createElement(
      node.tag,
      { key: node.key, ...node.props },
      node.children.map((child) => renderNode(child))
    );
  const { width: _w, height: _h, ...rootProps } = tree.props;
  return createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "currentColor",
      ...rootProps,
      width: size,
      height: size,
      "aria-hidden": true,
    },
    tree.children.map((child) => renderNode(child))
  );
};
