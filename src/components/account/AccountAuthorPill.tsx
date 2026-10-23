'use client';

import React from 'react';
import Link from 'next/link';

export interface AccountAuthorPillProps {
  name: string;
  handle?: string;
  avatarUrl?: string | null;
  href?: string;
  className?: string;
}

/**
 * Pastille auteur du post modal Compte :
 * avatar 28 px + nom 600 12 px + @handle 10,5 px, verre `--bar-glass-bg`.
 */
export function AccountAuthorPill({
  name,
  handle,
  avatarUrl,
  href = '/compte',
  className = '',
}: AccountAuthorPillProps) {
  return (
    <Link
      href={href}
      className={`pmi-author ${className}`.trim()}
      aria-label={`${name}${handle ? ` @${handle}` : ''}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant, même source que le Compte
        <img className="pmi-author-av" src={avatarUrl} alt="" />
      ) : (
        <span className="pmi-author-av pmi-author-initial" aria-hidden="true">
          {(name || 'V').charAt(0).toUpperCase()}
        </span>
      )}
      <span className="pmi-author-txt">
        <b>{name}</b>
        {handle ? <small>@{handle}</small> : null}
      </span>
    </Link>
  );
}

export default AccountAuthorPill;
