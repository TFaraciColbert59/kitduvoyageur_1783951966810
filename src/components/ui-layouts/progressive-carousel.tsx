'use client';

// UI Layouts (MIT) — adapté LKDV : framer-motion, reduced-motion conservé.
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import React, {
  createContext,
  type FC,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface ProgressSliderContextType {
  active: string;
  progress: number;
  handleButtonClick: (value: string) => void;
  vertical: boolean;
  pause: () => void;
  resume: () => void;
  paused: boolean;
}

interface ProgressSliderProps {
  children: ReactNode;
  duration?: number;
  fastDuration?: number;
  vertical?: boolean;
  activeSlider: string;
  className?: string;
}

const ProgressSliderContext = createContext<ProgressSliderContextType | undefined>(undefined);

export const useProgressSliderContext = (): ProgressSliderContextType => {
  const context = useContext(ProgressSliderContext);
  if (!context) {
    throw new Error('useProgressSliderContext must be used within a ProgressSlider');
  }
  return context;
};

/**
 * ProgressSlider — carrousel « progressif » (UI Layouts, adapté). Pilote
 * SliderContent/SliderWrapper (slides) + SliderBtn (pastilles de progression).
 * Auto-avance ; pause manuelle dispo via pause()/resume() (ex. focus dedans).
 */
export const ProgressSlider: FC<ProgressSliderProps> = ({
  children,
  duration = 7000,
  fastDuration = 400,
  vertical = false,
  activeSlider,
  className,
}) => {
  const [active, setActive] = useState<string>(activeSlider);
  const [progress, setProgress] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [isFastForward, setIsFastForward] = useState<boolean>(false);
  const frame = useRef<number>(0);
  const firstFrameTime = useRef<number>(0);
  const targetValue = useRef<string | null>(null);
  const [sliderValues, setSliderValues] = useState<string[]>([]);

  useEffect(() => {
    const getChildren = React.Children.toArray(children).find(
      (child) => (child as React.ReactElement<any>).type === SliderContent
    ) as React.ReactElement<any> | undefined;

    if (getChildren) {
      const values = React.Children.toArray(getChildren.props.children).map(
        (child) => (child as React.ReactElement<any>).props.value as string
      );
      setSliderValues(values);
    }
  }, [children]);

  useEffect(() => {
    if (typeof window !== 'undefined') firstFrameTime.current = performance.now();
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const animate = (now: number) => {
    const currentDuration = isFastForward ? fastDuration : duration;
    const elapsedTime = now - firstFrameTime.current;
    const timeFraction = elapsedTime / currentDuration;

    if (timeFraction <= 1) {
      setProgress(isFastForward ? progress + (100 - progress) * timeFraction : timeFraction * 100);
      frame.current = requestAnimationFrame(animate);
    } else {
      if (isFastForward) {
        setIsFastForward(false);
        if (targetValue.current !== null) {
          setActive(targetValue.current);
          targetValue.current = null;
        }
      } else {
        const currentIndex = sliderValues.indexOf(active);
        const nextIndex = (currentIndex + 1) % sliderValues.length;
        setActive(sliderValues[nextIndex]);
      }
      setProgress(0);
      firstFrameTime.current = performance.now();
      if (!paused) frame.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (sliderValues.length > 0 && !paused) {
      cancelAnimationFrame(frame.current);
      firstFrameTime.current = performance.now();
      frame.current = requestAnimationFrame(animate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValues, active, paused, isFastForward]);

  const handleButtonClick = (value: string) => {
    if (value !== active) {
      const elapsedTime = performance.now() - firstFrameTime.current;
      const currentProgress = Math.min(99, (elapsedTime / duration) * 100);
      setProgress(currentProgress);
      targetValue.current = value;
      setIsFastForward(true);
      firstFrameTime.current = performance.now();
    }
  };

  return (
    <ProgressSliderContext.Provider
      value={{
        active,
        progress,
        handleButtonClick,
        vertical,
        pause: () => setPaused(true),
        resume: () => setPaused(false),
        paused,
      }}
    >
      <div className={cn('relative', className)}>{children}</div>
    </ProgressSliderContext.Provider>
  );
};

export const SliderContent: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return <div className={cn('', className)}>{children}</div>;
};

export const SliderWrapper: FC<{ children: ReactNode; value: string; className?: string }> = ({
  children,
  value,
  className,
}) => {
  const { active } = useProgressSliderContext();
  return (
    <AnimatePresence mode="popLayout">
      {active === value && (
        <motion.div
          key={value}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={cn('', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SliderBtnGroup: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return <div className={cn('', className)}>{children}</div>;
};

export const SliderBtn: FC<{
  children?: ReactNode;
  value: string;
  className?: string;
  progressBarClass?: string;
}> = ({ children, value, className, progressBarClass }) => {
  const { active, progress, handleButtonClick, vertical } = useProgressSliderContext();
  return (
    <button
      type="button"
      aria-label={`Afficher ${value}`}
      className={cn(`relative ${active === value ? 'opacity-100' : 'opacity-45'}`, className)}
      onClick={() => handleButtonClick(value)}
    >
      {children}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={active === value ? Math.round(progress) : 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={cn('absolute inset-0 origin-left', progressBarClass)}
          style={{
            transform: active === value ? `scaleX(${progress / 100})` : 'scaleX(0)',
          }}
        />
      </span>
    </button>
  );
};

export default ProgressSlider;
