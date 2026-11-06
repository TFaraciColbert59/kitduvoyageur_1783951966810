'use client';
import type { Cog, CogState } from '../../domain/balance';

const NB = ' ';
const X = (z: number) => 58 + ((z + 0.36) / 0.72) * 124;
const Y = (y: number) => 196 - ((y + 0.75) / 1.75) * 178;

/** Vue de profil du sac et centre de gravité (maquette balanceHTML). Couleurs par classes ks-bl-*. */
export function BalanceChart({ cog, verdict }: { cog: Cog; verdict: CogState }) {
  const tone = verdict.ok ? 'ok' : 'warn';
  const cm = Math.abs(cog.x * 44);
  const side =
    cm < 0.5
      ? 'centré'
      : `décalé de ${cm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NB}cm vers la ${cog.x > 0 ? 'droite' : 'gauche'}`;
  return (
    <div className="ks-bl-bal">
      <svg viewBox="0 0 240 212" role="img" aria-label={`Vue de profil du sac${NB}: centre de gravité ${verdict.ok ? 'bien placé' : 'mal placé'}`}>
        <path
          d={`M${X(-0.33)} ${Y(0.76)} C ${X(-0.52)} ${Y(0.4)}, ${X(-0.5)} ${Y(-0.2)}, ${X(-0.37)} ${Y(-0.56)}`}
          className="ks-bl-strap"
        />
        <rect x={X(-0.28)} y={Y(0.725)} width={X(0.28) - X(-0.28)} height={Y(-0.725) - Y(0.725)} rx="22" className="ks-bl-body" />
        <rect x={X(-0.27)} y={Y(0.99)} width={X(0.33) - X(-0.27)} height={Y(0.73) - Y(0.99)} rx="12" className="ks-bl-body" />
        <rect x={X(0.24)} y={Y(0.23)} width={X(0.34) - X(0.24)} height={Y(-0.57) - Y(0.23)} rx="8" className="ks-bl-pocket" />
        <line x1={X(-0.31)} y1={Y(0.68)} x2={X(-0.31)} y2={Y(-0.68)} className="ks-bl-back" />
        <ellipse cx={X(-0.12)} cy={Y(0.17)} rx="22" ry="40" className="ks-bl-ideal" />
        <line x1={X(cog.z)} y1={Y(cog.y) - 15} x2={X(cog.z)} y2={Y(cog.y) + 15} className={`ks-bl-cross ks-bl-${tone}`} />
        <line x1={X(cog.z) - 15} y1={Y(cog.y)} x2={X(cog.z) + 15} y2={Y(cog.y)} className={`ks-bl-cross ks-bl-${tone}`} />
        <circle cx={X(cog.z)} cy={Y(cog.y)} r="6.5" className={`ks-bl-dot ks-bl-${tone}`} />
        <text x={X(-0.31)} y="210" textAnchor="middle" className="ks-bl-lbl">
          dos
        </text>
      </svg>
      <div>
        <span className="ks-bl-t17">{verdict.t}</span>
        <span className="ks-bl-t13" style={{ marginTop: 4 }}>
          {verdict.s}
        </span>
        <span className="ks-bl-t13" style={{ marginTop: 8 }}>{`Gauche-droite${NB}: ${side}.`}</span>
      </div>
    </div>
  );
}
