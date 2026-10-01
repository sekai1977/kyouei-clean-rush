"use client";
import { useEffect, useRef } from "react";
import { mazeMarkup } from "./maze-markup";
export default function Game() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import("./maze-engine").then(({ mountMaze }) => {
      if (!cancelled && root.current) cleanup = mountMaze(root.current);
    }).catch(() => {
      const loading = root.current?.querySelector("#mr-loading");
      if (loading && !cancelled) loading.textContent = "読み込めませんでした。ページを再読み込みしてください。";
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return <div ref={root} id="kyouei-clean-rush" data-phase="ready" aria-label="共栄美装 3D迷路収集ゲーム" dangerouslySetInnerHTML={{ __html: mazeMarkup }} />;
}
