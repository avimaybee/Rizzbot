import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../../services/mediaService';
import { isR2MediaKey } from '../../utils/imageOptimize';

interface R2ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  srcOrKey: string;
}

const toLegacySrc = (srcOrKey: string): string => {
  if (srcOrKey.startsWith('data:') || srcOrKey.startsWith('blob:') || srcOrKey.startsWith('http')) return srcOrKey;
  return `data:image/jpeg;base64,${srcOrKey}`;
};

export const R2Image: React.FC<R2ImageProps> = ({ srcOrKey, alt = 'Screenshot', className, ...rest }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() =>
    isR2MediaKey(srcOrKey) ? '' : toLegacySrc(srcOrKey)
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    if (!isR2MediaKey(srcOrKey)) {
      setResolvedSrc(toLegacySrc(srcOrKey));
      return;
    }

    setResolvedSrc('');
    resolveMediaUrl(srcOrKey)
      .then((url) => {
        if (active) setResolvedSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [srcOrKey]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[#181617] text-[#8E8A84] text-xs ${className || ''}`}
      >
        Image unavailable
      </div>
    );
  }

  if (!resolvedSrc) {
    return <div className={`animate-pulse bg-[#1E1C1D] ${className || ''}`} />;
  }

  return <img src={resolvedSrc} alt={alt} className={className} loading="lazy" decoding="async" {...rest} />;
};
