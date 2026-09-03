import { LOGO_CUD, LOGO_DUNKERQUE } from '../logos';

export interface LogoCharge {
  dataUrl: string;
  largeur: number;
  hauteur: number;
}

export interface LogosPdf {
  dunkerque: LogoCharge | null;
  cud: LogoCharge | null;
}

function blobVersDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

function dimensionsImage(dataUrl: string): Promise<{ largeur: number; hauteur: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ largeur: img.naturalWidth || img.width, hauteur: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Charge une image raster (PNG/JPEG) distante et la convertit en data URL utilisable par jsPDF. */
async function chargerLogoRaster(url: string): Promise<LogoCharge | null> {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    const blob = await reponse.blob();
    const dataUrl = await blobVersDataUrl(blob);
    const dimensions = await dimensionsImage(dataUrl);
    return dimensions ? { dataUrl, ...dimensions } : null;
  } catch {
    return null;
  }
}

/**
 * jsPDF ne sait embarquer que des images raster (PNG/JPEG), pas de SVG : ce logo est donc rasterisé
 * via un <canvas> hors-écran avant d'être passé à addImage.
 */
async function chargerLogoSvgRasterise(url: string, hauteurCible = 240): Promise<LogoCharge | null> {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    const texteSvg = await reponse.text();
    const dataUrlSvg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(texteSvg)))}`;
    const dimensionsSvg = await dimensionsImage(dataUrlSvg);
    if (!dimensionsSvg) return null;

    const ratio = dimensionsSvg.largeur / dimensionsSvg.hauteur || 1;
    const canvas = document.createElement('canvas');
    canvas.height = hauteurCible;
    canvas.width = Math.round(hauteurCible * ratio) || hauteurCible;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = () => reject(new Error('échec du rendu du SVG'));
      img.src = dataUrlSvg;
    });

    return { dataUrl: canvas.toDataURL('image/png'), largeur: canvas.width, hauteur: canvas.height };
  } catch {
    return null;
  }
}

let promesseLogos: Promise<LogosPdf> | null = null;

/**
 * Charge (et met en cache pour la session) les deux logos officiels sous forme de data URL, pour les
 * insérer dans les PDF générés. En cas d'échec (réseau, CORS…), le logo concerné est simplement omis
 * du PDF plutôt que de faire échouer tout l'export.
 */
export function chargerLogosPourPdf(): Promise<LogosPdf> {
  if (!promesseLogos) {
    promesseLogos = Promise.all([chargerLogoRaster(LOGO_DUNKERQUE), chargerLogoSvgRasterise(LOGO_CUD)]).then(
      ([dunkerque, cud]) => ({ dunkerque, cud })
    );
  }
  return promesseLogos;
}
