"use client";

import { useEffect, useId, useRef, useState } from "react";

type Size = { width: number; height: number };
type Point = { x: number; y: number };

function cloudOutline({ width, height }: Size, cluster: boolean) {
  const corner = Math.min(cluster ? 32 : 20, width / 4, height / 4);
  const depth = cluster ? 32 : 16;
  const variation = [0.8, 1.15, 0.95, 1.25, 0.9];
  const edge = (start: Point, end: Point, normal: Point, offset: number) => {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const count = Math.max(1, Math.min(48, Math.round(length / (cluster ? 100 : 66))));
    const dx = (end.x - start.x) / count, dy = (end.y - start.y) / count;
    return Array.from({ length: count }, (_, index) => {
      const x = start.x + dx * index, y = start.y + dy * index;
      const puff = depth * variation[(index + offset) % variation.length];
      return `C ${x + dx * 0.12 + normal.x * puff} ${y + dy * 0.12 + normal.y * puff}, ${x + dx * 0.88 + normal.x * puff} ${y + dy * 0.88 + normal.y * puff}, ${x + dx} ${y + dy}`;
    }).join(" ");
  };
  return `M ${corner} 0
    ${edge({ x: corner, y: 0 }, { x: width - corner, y: 0 }, { x: 0, y: -1 }, 0)}
    Q ${width + corner * 0.35} ${-corner * 0.35} ${width} ${corner}
    ${edge({ x: width, y: corner }, { x: width, y: height - corner }, { x: 1, y: 0 }, 2)}
    Q ${width + corner * 0.35} ${height + corner * 0.35} ${width - corner} ${height}
    ${edge({ x: width - corner, y: height }, { x: corner, y: height }, { x: 0, y: 1 }, 3)}
    Q ${-corner * 0.35} ${height + corner * 0.35} 0 ${height - corner}
    ${edge({ x: 0, y: height - corner }, { x: 0, y: corner }, { x: -1, y: 0 }, 1)}
    Q ${-corner * 0.35} ${-corner * 0.35} ${corner} 0 Z`;
}

function CloudWisp({ className }: { className: string }) {
  return <svg className={`cloud-wisp ${className}`} viewBox="0 0 80 42" focusable="false">
    <path d="M16 35C-1 35 0 16 15 15C15 0 38-3 43 12C53 4 66 12 65 21C82 20 83 36 67 36Z" />
    <path className="cloud-wisp-shine" d="M20 15C22 6 35 5 39 13M48 16C53 12 59 15 60 20" />
  </svg>;
}

export function CloudFrame({ size, cluster = false }: { size?: Size; cluster?: boolean }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Size>({ width: 272, height: 148 });
  useEffect(() => {
    if (size || !root.current) return;
    // Preview measurements use layout pixels so canvas zoom cannot distort the puffs.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setMeasured((current) => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [size]);
  const dimensions = size ?? measured;
  const path = cloudOutline(dimensions, cluster);
  return <div ref={root} className="cloud-frame" data-cloud-kind={cluster ? "cluster" : "note"} aria-hidden="true">
    <svg className="cloud-frame-svg" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0.3" y2="1">
          <stop className="cloud-fill-top" offset="0" /><stop className="cloud-fill-bottom" offset="1" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0.7" y2="1">
          <stop className="cloud-rim-top" offset="0" /><stop className="cloud-rim-bottom" offset="1" />
        </linearGradient>
      </defs>
      <path className="cloud-frame-halo" d={path} />
      <path className="cloud-frame-shape" d={path} fill={`url(#${id}-fill)`} stroke={`url(#${id}-rim)`} />
      <path className="cloud-frame-highlight" d={path} />
    </svg>
    <CloudWisp className="cloud-wisp-left" /><CloudWisp className="cloud-wisp-right" />
    <span className="cloud-twinkle cloud-twinkle-top">✦</span><span className="cloud-twinkle cloud-twinkle-bottom">✧</span>
    {cluster && <><CloudWisp className="cloud-wisp-bottom" /><span className="cloud-twinkle cloud-twinkle-side">✧</span><span className="cloud-dots" /></>}
  </div>;
}
