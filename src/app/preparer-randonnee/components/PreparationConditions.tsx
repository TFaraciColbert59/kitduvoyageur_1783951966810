'use client';

import React from 'react';
import { Icon } from './PreparationIcons';

interface PreparationConditionsProps {
  distance: string;
  ascent: string;
  duration: string;
  difficulty: string;
  temp: number | string;
  rainProb: number | string;
  windSpeed: number | string;
}

export const PreparationConditions: React.FC<PreparationConditionsProps> = ({
  distance,
  ascent,
  duration,
  difficulty,
  temp,
  rainProb,
  windSpeed,
}) => {
  return (
    <div className="conditions-strip">
      <div className="cell">
        <div className="l">
          <Icon name="route" /> DIST
        </div>
        <div className="v">
          {distance}
          <em> km</em>
        </div>
        <div className="s">D+{ascent}</div>
      </div>
      <div className="cell">
        <div className="l">
          <Icon name="clock" /> DURÉE
        </div>
        <div className="v">
          {duration.replace('h', '')}
          <em>h</em>
          {duration.split('h')[1] || ''}
        </div>
        <div className="s">{difficulty}</div>
      </div>
      <div className="cell">
        <div className="l">
          <Icon name="temp" /> TEMP
        </div>
        <div className="v">
          {temp}
          <em>°</em>
        </div>
        <div className="s">crête</div>
      </div>
      <div className="cell">
        <div className="l">
          <Icon name="cloud-rain" /> PLUIE
        </div>
        <div className="v">
          {rainProb}
          <em>%</em>
        </div>
        <div className="s">{windSpeed} km/h</div>
      </div>
    </div>
  );
};
