import { useEffect, useState, type ImgHTMLAttributes } from "react";
import type { Engine } from "../engines/types.ts";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  engine: Engine;
  jobId: string;
  index: number;
}

/** A job photo; its URL comes from the engine (server path or local object URL). */
export function JobImage({ engine, jobId, index, alt = "", ...rest }: Props) {
  const [src, setSrc] = useState<{ key: string; url: string }>();
  const key = `${engine.id}:${jobId}:${index}`;
  useEffect(() => {
    let active = true;
    engine.imageUrl(jobId, index).then(
      (url) => active && setSrc({ key, url }),
      () => undefined, // A missing photo leaves the placeholder background.
    );
    return () => {
      active = false;
    };
  }, [engine, jobId, index, key]);
  return <img {...rest} alt={alt} src={src?.key === key ? src.url : undefined} />;
}
