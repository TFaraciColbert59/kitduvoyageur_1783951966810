'use client';

import Link from 'next/link';
import { m } from 'framer-motion';
import type { RefObject } from 'react';
import Icon from '@/components/ui/Icon';
import type { CockpitReadinessReport, CockpitWidgetKey } from './cockpitReadiness';
import styles from './cockpit.module.css';

interface HubCockpitHeaderProps {
  id: string;
  title: string;
  location: string | null;
  trip: boolean;
  collective: boolean;
  fixture: boolean;
  hasSwitcher: boolean;
  days: number[];
  day: number;
  today: number;
  dayRailRef: RefObject<HTMLDivElement | null>;
  readiness: CockpitReadinessReport;
  onSelectDay: (day: number) => void;
  onOpenWidget: (widget: CockpitWidgetKey, opener?: HTMLElement | null) => void;
  onOpenShare?: () => void;
}

export function HubCockpitHeader({
  id,
  title,
  location,
  trip,
  collective,
  fixture,
  hasSwitcher,
  days,
  day,
  today,
  dayRailRef,
  readiness,
  onSelectDay,
  onOpenWidget,
  onOpenShare,
}: HubCockpitHeaderProps) {
  const ringRadius = 17;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - Math.max(0, Math.min(100, readiness.score)) / 100);

  const openAdventureSwitcher = () => {
    window.dispatchEvent(new Event('hub:open-switcher'));
  };

  return (
    <header className={styles.commandBar}>
      <div className={styles.commandTop}>
        <button
          type="button"
          className={styles.adventurePill}
          onClick={hasSwitcher ? openAdventureSwitcher : undefined}
          disabled={!hasSwitcher}
          aria-haspopup={hasSwitcher ? 'dialog' : undefined}
          aria-label={`Aventure active : ${title}. Changer d'aventure`}
        >
          <span className={styles.adventureIcon} aria-hidden="true">
            <Icon name={collective ? 'users' : 'compass'} size={18} />
          </span>
          <span className={styles.adventureMeta}>
            <h1 id={id} className={styles.adventureTitle}>{title}</h1>
            <span className={styles.adventureSub}>
              <span className={styles.phaseChip}>{readiness.phaseLabel}</span>
              {location && <span className={styles.locationText}>{location}</span>}
            </span>
          </span>
          {hasSwitcher && (
            <span className={styles.switcherChevron} aria-hidden="true">
              <Icon name="chevrons-up-down" size={16} />
            </span>
          )}
        </button>

        <div className={styles.commandActions}>
          {trip && (
            <button
              type="button"
              className={styles.readinessButton}
              data-tone={readiness.tone}
              aria-label={`Préparation ${readiness.score} %, ${readiness.statusLabel}`}
              title={`${readiness.statusLabel} · ${readiness.score} %`}
              onClick={(e) => onOpenWidget(readiness.signals[0]?.targetWidget ?? 'kit', e.currentTarget)}
            >
              <svg className={styles.readinessSvg} viewBox="0 0 42 42" aria-hidden="true">
                <circle className={styles.readinessTrack} cx="21" cy="21" r={ringRadius} />
                <circle
                  className={styles.readinessFill}
                  cx="21"
                  cy="21"
                  r={ringRadius}
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className={styles.readinessScore}>{readiness.score}</span>
            </button>
          )}

          {!fixture && trip && (
            <Link
              href="/explorer"
              className={styles.iconActionBtn}
              aria-label="Ouvrir dans Explorer 3D"
              title="Explorer 3D"
            >
              <Icon name="compass" size={18} />
            </Link>
          )}

          {!fixture && onOpenShare && (
            <button
              type="button"
              className={styles.iconActionBtn}
              aria-label="Partager l'aventure"
              title="Partager"
              onClick={onOpenShare}
            >
              <Icon name="share-2" size={18} />
            </button>
          )}
        </div>
      </div>

      {trip && (days.length > 0 || readiness.signals.length > 0) && (
        <div className={styles.commandStrip}>
          {days.length > 0 && (
            <m.div
              layoutScroll
              ref={dayRailRef}
              role="group"
              aria-label="Jour du voyage"
              data-no-swipe="true"
              className={styles.dayRail}
            >
              {days.map((option) => (
                <button
                  key={option}
                  className={styles.dayPill}
                  type="button"
                  aria-label={`Jour ${option}`}
                  aria-current={option === today ? 'date' : undefined}
                  aria-pressed={option === day}
                  onClick={() => onSelectDay(option)}
                >
                  {option === day && (
                    <m.span
                      layoutId={`${id}-day`}
                      className={styles.daySelection}
                      aria-hidden="true"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    />
                  )}
                  <span>J{option}</span>
                </button>
              ))}
            </m.div>
          )}

          {readiness.signals.length > 0 && (
            <div className={styles.signalRail} aria-label="Signaux prioritaires">
              {readiness.signals.map((sig) => (
                <button
                  key={sig.id}
                  type="button"
                  className={styles.signalPill}
                  data-tone={sig.tone}
                  onClick={(e) => onOpenWidget(sig.targetWidget, e.currentTarget)}
                >
                  <Icon name={sig.icon} size={13} />
                  <span>{sig.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
