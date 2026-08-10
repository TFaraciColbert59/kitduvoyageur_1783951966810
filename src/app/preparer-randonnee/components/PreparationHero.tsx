'use client';

import React from 'react';
import { Icon } from './PreparationIcons';

interface PreparationHeroProps {
  hikeName: { pre: string; em: string };
  location: string;
  distance: string;
  duration: string;
  ascent: string;
  difficulty: string;
  onBack: () => void;
  onSave?: () => void;
}

export const PreparationHero: React.FC<PreparationHeroProps> = ({
  hikeName,
  location,
  distance,
  duration,
  ascent,
  difficulty,
  onBack,
  onSave,
}) => {
  return (
    <>
      <div className="hero">
        <div className="contour"></div>
        <div className="specks"></div>
        <svg className="route-svg" viewBox="0 0 380 240" preserveAspectRatio="none">
          <path
            d="M20,220 Q80,180 130,160 T220,110 T360,40"
            fill="none"
            stroke="#17402C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="3 6"
            opacity="0.32"
          />
          <circle cx="20" cy="220" r="5" fill="#17402C" />
          <circle cx="360" cy="40" r="5" fill="#17402C" />
        </svg>
        <button className="back" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
        <button className="save" onClick={onSave} aria-label="Sauvegarder la randonnée">
          <Icon name="bookmark" />
        </button>
        <div className="hero-body">
          <div className="eyebrow">Préparation · {location}</div>
          <h1 className="name">
            {hikeName.pre} <em>{hikeName.em}</em>
          </h1>
          <div className="facts">
            <span className="fact">
              <Icon name="route" />
              <span className="num">{distance} km</span>
            </span>
            <span className="fact">
              <Icon name="clock" />
              <span className="num">{duration}</span>
            </span>
            <span className="fact">
              <Icon name="mountain" />
              <span className="num">D+{ascent}m</span>
            </span>
            <span className="fact diff">
              <Icon name="spark" />
              <span className="num">{difficulty}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
