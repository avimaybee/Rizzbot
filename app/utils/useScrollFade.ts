import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useScrollFade
 * 
 * A hook that provides a ref and dynamic mask style for horizontal scrollable elements.
 * The fade effect (gradient mask) automatically adjusts based on whether the user
 * can scroll left or right.
 */
export function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    
    // We use a small threshold (2px) to avoid flickering at exact boundaries
    setShowLeft(scrollLeft > 2);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial check
    checkScroll();

    // Listen to scroll events
    el.addEventListener('scroll', checkScroll, { passive: true });
    
    // Listen to window resize (scrollWidth might change)
    window.addEventListener('resize', checkScroll);

    // Also check when content changes (useful for dynamic lists)
    const observer = new MutationObserver(checkScroll);
    observer.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  // Gradient mask calculation
  // Base logic: 
  // If showLeft is true, we need a transparent-to-black gradient at the start.
  // If showRight is true, we need a black-to-transparent gradient at the end.
  const getMaskImage = () => {
    const leftFade = showLeft ? 'rgba(0,0,0,0) 0%, rgba(0,0,0,1) 8%' : 'rgba(0,0,0,1) 0%';
    const rightFade = showRight ? 'rgba(0,0,0,1) 92%, rgba(0,0,0,0) 100%' : 'rgba(0,0,0,1) 100%';
    
    return `linear-gradient(to right, ${leftFade}, ${rightFade})`;
  };

  const style = {
    WebkitMaskImage: getMaskImage(),
    maskImage: getMaskImage(),
  };

  return { ref, style, checkScroll };
}
