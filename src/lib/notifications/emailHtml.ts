type EmailNotification = { title: string; message: string; link?: string | null };

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
}

function notificationHref(link: string | null | undefined, siteUrl: string): string | null {
  if (
    !link ||
    !link.startsWith('/') ||
    link.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]|%2f|%5c|%0[0-9a-f]|%1[0-9a-f]/i.test(link)
  )
    return null;
  try {
    const base = new URL(siteUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
    const target = new URL(link, base.origin);
    return target.origin === base.origin ? target.href : null;
  } catch {
    return null;
  }
}

export function renderNotificationEmail(notification: EmailNotification, siteUrl: string): string {
  const href = notificationHref(notification.link, siteUrl);
  return `
                <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 12px; background-color: #ffffff;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 20px; font-weight: 800; color: #17402C; letter-spacing: -0.5px;">Le Kit du Voyageur</span>
                  </div>
                  <h3 style="color: #17402C; font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">${escapeHtml(notification.title)}</h3>
                  <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${escapeHtml(notification.message)}</p>
                  ${
                    href
                      ? `
                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${escapeHtml(href)}" style="display: inline-block; background-color: #17402C; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-size: 13px; font-weight: 700; transition: background-color 0.2s;">
                        Voir l'activité
                      </a>
                    </div>
                  `
                      : ''
                  }
                  <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 24px 0;" />
                  <p style="font-size: 11px; color: #888888; text-align: center; line-height: 1.4; margin: 0;">
                    Vous recevez cet email suite à votre activité communautaire.<br />
                    Vous pouvez modifier vos préférences de notification à tout moment sur votre compte.
                  </p>
                </div>
              `;
}
