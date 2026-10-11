import { createElement, type ReactElement } from "react";

import type { SvgNode } from "@/components/studio/svg-tree";

function renderNode(node: SvgNode, key: string): ReactElement {
  return createElement(
    node.tag,
    { key, ...node.props },
    node.children.map((child, index) => renderNode(child, `${key}-${index}`))
  );
}

type SvgFigureProps = {
  tree: SvgNode;
  size: number;
};

export const SvgFigure = ({ tree, size }: SvgFigureProps) => {
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
    tree.children.map((child, index) => renderNode(child, `n-${index}`))
  );
};
