import React from 'react';

type AnyProps = Record<string, any>;

function create(name: string) {
  const Element = (props: AnyProps) => {
    const { children, ...rest } = props;
    const clean: AnyProps = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      if (key === 'pointerEvents') {
        clean.pointerEvents = value;
        continue;
      }
      clean[key] = value;
    }
    return React.createElement(name, clean, children);
  };
  Element.displayName = `Svg${name}`;
  return Element;
}

const Svg = (props: AnyProps) => {
  const { children, width, height, viewBox, style, ...rest } = props;
  return React.createElement(
    'svg',
    {
      ...rest,
      width: width ?? '100%',
      height: height ?? '100%',
      viewBox,
      style: { display: 'block', ...(style as object) },
      xmlns: 'http://www.w3.org/2000/svg',
    },
    children,
  );
};

export default Svg;
export { Svg };

export const Rect = create('rect');
export const Circle = create('circle');
export const Ellipse = create('ellipse');
export const G = create('g');
export const Path = create('path');
export const Line = create('line');
export const Polyline = create('polyline');
export const Polygon = create('polygon');
export const Defs = create('defs');
export const Stop = create('stop');
export const LinearGradient = create('linearGradient');
export const RadialGradient = create('radialGradient');
export const ClipPath = create('clipPath');
export const Mask = create('mask');
export const Use = create('use');
export const Text = create('text');
export const TSpan = create('tspan');
export const Image = create('image');
export const Pattern = create('pattern');
export const Symbol = create('symbol');
export const Marker = create('marker');
export const Filter = create('filter');
export const FeColorMatrix = create('feColorMatrix');
export const FeGaussianBlur = create('feGaussianBlur');
export const ForeignObject = create('foreignObject');
