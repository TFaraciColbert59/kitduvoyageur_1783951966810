import { describe, expect, it } from 'vitest';
import {
  acceptedLicense,
  commonsGeosearchUrl,
  parseCommonsGeosearch,
  plainText,
} from '../engine/commons';

/** Rencurel (Vercors), lieu cherché. 0,001° de latitude ≈ 111 m. */
const FROM = { lat: 45.0, lon: 5.4 };

interface PageSpec {
  title: string;
  lat?: number;
  lon?: number;
  width?: number;
  height?: number;
  mime?: string;
  artist?: string | null;
  short?: string | null;
  code?: string;
  thumb?: string;
  desc?: string;
}

/** Une page telle que `action=query&generator=geosearch&prop=imageinfo|coordinates` la rend (formatversion=2). */
function page(index: number, p: PageSpec) {
  const file = p.title.replace(/^File:/, '').replace(/ /g, '_');
  const ext: Record<string, unknown> = {};
  if (p.artist !== null)
    ext.Artist = { value: p.artist ?? '<a href="//commons.wikimedia.org/wiki/User:Jean_Dupont" title="User:Jean Dupont">Jean Dupont</a>', source: 'commons-desc-page' };
  if (p.short !== null) ext.LicenseShortName = { value: p.short ?? 'CC BY-SA 4.0', source: 'commons-desc-page', hidden: '' };
  ext.License = { value: p.code ?? 'cc-by-sa-4.0', source: 'commons-desc-page', hidden: '' };
  ext.Copyrighted = { value: 'True', source: 'commons-desc-page', hidden: '' };
  return {
    pageid: 1000 + index,
    ns: 6,
    title: p.title,
    index,
    ...(p.lat != null && p.lon != null ? { coordinates: [{ lat: p.lat, lon: p.lon, primary: true, globe: 'earth' }] } : {}),
    imageinfo: [
      {
        size: 2_345_678,
        width: p.width ?? 4000,
        height: p.height ?? 3000,
        thumburl: p.thumb ?? `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/480px-${file}`,
        thumbwidth: 480,
        thumbheight: 360,
        url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${file}`,
        descriptionurl: p.desc ?? `https://commons.wikimedia.org/wiki/File:${file}`,
        descriptionshorturl: `https://commons.wikimedia.org/w/index.php?curid=${1000 + index}`,
        extmetadata: ext,
        mime: p.mime ?? 'image/jpeg',
      },
    ],
  };
}

const response = (...pages: ReturnType<typeof page>[]) => ({ batchcomplete: true, query: { pages } });

describe('commonsGeosearchUrl', () => {
  it('cherche des fichiers (espace 6) autour du point, vignette de 480 px, licence en métadonnées', () => {
    const url = new URL(commonsGeosearchUrl(FROM));
    expect(url.origin + url.pathname).toBe('https://commons.wikimedia.org/w/api.php');
    const q = url.searchParams;
    expect(q.get('action')).toBe('query');
    expect(q.get('generator')).toBe('geosearch');
    expect(q.get('ggscoord')).toBe('45.00000|5.40000');
    expect(q.get('ggsradius')).toBe('1000');
    expect(q.get('ggsnamespace')).toBe('6');
    expect(q.get('prop')).toBe('imageinfo|coordinates');
    expect(q.get('iiprop')).toBe('url|extmetadata|size|mime');
    expect(q.get('iiurlwidth')).toBe('480');
    expect(q.get('formatversion')).toBe('2');
  });

  it('borne le rayon aux valeurs de l’API (10 à 10 000 m)', () => {
    expect(new URL(commonsGeosearchUrl(FROM, 3)).searchParams.get('ggsradius')).toBe('10');
    expect(new URL(commonsGeosearchUrl(FROM, 50_000)).searchParams.get('ggsradius')).toBe('10000');
  });
});

describe('plainText', () => {
  it('retire les balises, lit les entités et réduit les espaces', () => {
    expect(plainText('<a href="//x" title="User:A">Jean &amp; Marie  D&#039;Arc</a><br/>')).toBe("Jean & Marie D'Arc");
    expect(plainText('Ren&#233;&nbsp;Dupont &#x41;')).toBe('René Dupont A');
    expect(plainText(undefined)).toBe('');
  });
});

describe('acceptedLicense', () => {
  it('accepte domaine public, CC0, CC BY et CC BY-SA avec leur version', () => {
    expect(acceptedLicense('CC BY-SA 4.0', 'cc-by-sa-4.0')).toEqual({ name: 'CC BY-SA 4.0', attribution: true });
    expect(acceptedLicense('CC BY 2.0', 'cc-by-2.0')).toEqual({ name: 'CC BY 2.0', attribution: true });
    expect(acceptedLicense('CC BY-SA 3.0 de', 'cc-by-sa-3.0-de')).toEqual({ name: 'CC BY-SA 3.0 de', attribution: true });
    expect(acceptedLicense('CC0', 'cc0')).toEqual({ name: 'CC0', attribution: false });
    expect(acceptedLicense('Public domain', 'pd')).toEqual({ name: 'Domaine public', attribution: false });
    expect(acceptedLicense(undefined, 'pd-old-100')).toEqual({ name: 'Domaine public', attribution: false });
  });

  it('refuse le reste : NC, ND, GFDL, sans version, inconnu', () => {
    for (const short of ['CC BY-NC 4.0', 'CC BY-ND 2.0', 'CC BY-NC-SA 3.0', 'GFDL', 'CC BY-SA', 'CC BY', 'Attribution', 'Copyrighted free use', 'CC BY-SA 3.0 igo', '']) {
      expect(acceptedLicense(short, ''), short).toBeNull();
    }
    expect(acceptedLicense(undefined, undefined)).toBeNull();
  });
});

describe('parseCommonsGeosearch', () => {
  it('rend la vignette, l’auteur nettoyé, la licence et la page du fichier', () => {
    const photo = parseCommonsGeosearch(
      response(page(1, { title: 'File:Rencurel village.jpg', lat: 45.0005, lon: 5.4 })),
      FROM
    );
    expect(photo).toEqual({
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Rencurel_village.jpg/480px-Rencurel_village.jpg',
      credit: 'Jean Dupont',
      license: 'CC BY-SA 4.0',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Rencurel_village.jpg',
    });
  });

  it('prend la plus proche, par tranches de 300 m', () => {
    const far = page(1, { title: 'File:Loin.jpg', lat: 45.008, lon: 5.4 }); // ~890 m
    const near = page(2, { title: 'File:Pres.jpg', lat: 45.001, lon: 5.4, width: 800, height: 1200 }); // ~110 m, portrait
    expect(parseCommonsGeosearch(response(far, near), FROM)?.pageUrl).toContain('Pres.jpg');
  });

  it('à tranche égale, le paysage d’au moins 600 px passe devant', () => {
    const portrait = page(1, { title: 'File:Portrait.jpg', lat: 45.0005, lon: 5.4, width: 2000, height: 3000 });
    const small = page(2, { title: 'File:Petit.jpg', lat: 45.0006, lon: 5.4, width: 500, height: 300 });
    const landscape = page(3, { title: 'File:Paysage.jpg', lat: 45.0015, lon: 5.4, width: 3000, height: 2000 });
    expect(parseCommonsGeosearch(response(portrait, small, landscape), FROM)?.pageUrl).toContain('Paysage.jpg');
    // Sans paysage correct : la plus proche reste une vraie photo du lieu.
    expect(parseCommonsGeosearch(response(portrait, small), FROM)?.pageUrl).toContain('Portrait.jpg');
  });

  it('ne garde que jpg, png et webp', () => {
    const svg = page(1, { title: 'File:Plan.svg', mime: 'image/svg+xml' });
    const gif = page(2, { title: 'File:Anim.gif', mime: 'image/gif' });
    const tiff = page(3, { title: 'File:Scan.tiff', mime: 'image/tiff' });
    const pdf = page(4, { title: 'File:Doc.pdf', mime: 'application/pdf' });
    expect(parseCommonsGeosearch(response(svg, gif, tiff, pdf), FROM)).toBeNull();
    const png = page(5, { title: 'File:Vue.png', mime: 'image/png' });
    const webp = page(6, { title: 'File:Vue2.webp', mime: 'image/webp' });
    expect(parseCommonsGeosearch(response(png), FROM)?.pageUrl).toContain('Vue.png');
    expect(parseCommonsGeosearch(response(webp), FROM)?.pageUrl).toContain('Vue2.webp');
  });

  it('écarte les licences non autorisées, même si la photo est la plus proche', () => {
    const nc = page(1, { title: 'File:NC.jpg', lat: 45.0001, lon: 5.4, short: 'CC BY-NC 4.0', code: 'cc-by-nc-4.0' });
    const ok = page(2, { title: 'File:Libre.jpg', lat: 45.002, lon: 5.4, short: 'CC BY 3.0', code: 'cc-by-3.0' });
    expect(parseCommonsGeosearch(response(nc, ok), FROM)).toMatchObject({ license: 'CC BY 3.0' });
    expect(parseCommonsGeosearch(response(nc), FROM)).toBeNull();
  });

  it('une licence qui demande l’auteur sans auteur lisible est écartée ; le domaine public reste', () => {
    const noAuthor = page(1, { title: 'File:Anonyme.jpg', artist: null });
    const blankAuthor = page(2, { title: 'File:Vide.jpg', artist: '<span></span>' });
    expect(parseCommonsGeosearch(response(noAuthor, blankAuthor), FROM)).toBeNull();
    const pd = page(3, { title: 'File:Ancienne.jpg', artist: null, short: 'Public domain', code: 'pd' });
    expect(parseCommonsGeosearch(response(pd), FROM)).toMatchObject({ license: 'Domaine public', credit: 'Auteur non indiqué' });
  });

  it('refuse une vignette ou une page hors de Wikimedia', () => {
    const evilThumb = page(1, { title: 'File:A.jpg', thumb: 'https://evil.example/a.jpg' });
    const evilThumb2 = page(2, { title: 'File:B.jpg', thumb: 'https://upload.wikimedia.org.evil.example/b.jpg' });
    const http = page(3, { title: 'File:C.jpg', thumb: 'http://upload.wikimedia.org/c.jpg' });
    const evilPage = page(4, { title: 'File:D.jpg', desc: 'https://evil.example/wiki/File:D.jpg' });
    expect(parseCommonsGeosearch(response(evilThumb, evilThumb2, http, evilPage), FROM)).toBeNull();
  });

  it('réponses vides ou illisibles : null', () => {
    expect(parseCommonsGeosearch({ batchcomplete: true }, FROM)).toBeNull();
    expect(parseCommonsGeosearch({ query: { pages: [] } }, FROM)).toBeNull();
    expect(parseCommonsGeosearch({ error: { code: 'badvalue', info: 'x' } }, FROM)).toBeNull();
    expect(parseCommonsGeosearch(null, FROM)).toBeNull();
    expect(parseCommonsGeosearch('<html>', FROM)).toBeNull();
    // Page sans imageinfo (fichier supprimé).
    expect(parseCommonsGeosearch({ query: { pages: [{ pageid: 1, ns: 6, title: 'File:Z.jpg', index: 1 }] } }, FROM)).toBeNull();
  });

  it('lit aussi l’ancien format (pages indexées par identifiant)', () => {
    const p = page(1, { title: 'File:Ancien.jpg', lat: 45.0003, lon: 5.4 });
    const legacy = { query: { pages: { '1001': p } } };
    expect(parseCommonsGeosearch(legacy, FROM)?.pageUrl).toContain('Ancien.jpg');
  });

  it('sans coordonnées, l’ordre de Commons (par distance) décide', () => {
    const a = page(1, { title: 'File:Premier.jpg', width: 2000, height: 3000 });
    const b = page(2, { title: 'File:Second.jpg', width: 2000, height: 3000 });
    expect(parseCommonsGeosearch(response(a, b), FROM)?.pageUrl).toContain('Premier.jpg');
  });

  it('un auteur très long est tronqué', () => {
    const p = page(1, { title: 'File:Long.jpg', artist: 'A'.repeat(400) });
    expect(parseCommonsGeosearch(response(p), FROM)?.credit).toHaveLength(120);
  });
});
