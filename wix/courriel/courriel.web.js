// backend/courriel.web.js : « M'envoyer ma maquette par courriel » (brouillon du 18 nov. 2026, pas installé)
import { Permissions, webMethod } from "wix-web-module";
import wixData from "wix-data";
import { emailTransmissions } from "@wix/email-transmissions";
import { auth } from "@wix/essentials";

const COLLECTION = "CourrielsMaquette";
const EXPEDITEUR = "info@georama.ca";
const ADRESSE_POSTALE = ""; // À REMPLIR avant la mise en service (obligatoire dans la relance)
const MAX_PAR_JOUR = 60;      // garde-fou contre les abus
const JOURS_RELANCE = 3;
const DESABO = "{{LIEN_DESABONNEMENT}}";
const SUDO = { suppressAuth: true };
const envoyer = auth.elevate(emailTransmissions.sendEmailTransmission);

const propre = (t) => String(t || "").replace(/[<>&"]/g, "");
const lienDe = (zone) => "https://www.georama.ca/zone?" + zone;
function zoneValide(z) {
  z = String(z || "");
  return z.length < 4000 && /(^|&)lat=-?\d/.test(z) && /(^|&)lon=-?\d/.test(z) && !/[<>"'\s]/.test(z);
}

// Même texte pour l'envoi demandé et pour la relance (décision d'Anne-Marie, 18 nov. 2026)
function gabarit(lien, relance) {
  const bouton = `<a href="${lien}" style="display:inline-block;background:#57702b;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">Reprendre ma maquette</a>`;
  const pied = relance
    ? `<p style="font-size:12px;color:#777777;margin:24px 0 0">Georama · ${propre(ADRESSE_POSTALE)}<br><a href="${DESABO}" style="color:#777777">Se désabonner</a></p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#2b2b2b;max-width:520px;margin:0 auto;padding:24px">
<p>Bonjour,</p>
<p>Votre maquette est toujours là, prête à être fabriquée :</p>
<p style="margin:22px 0">${bouton}</p>
<p>Une question avant de commander ? Répondez à ce courriel, une vraie personne vous lit.</p>
<p>L'équipe Georama, Saint-Félicien</p>${pied}</div>`;
}

async function envoi(courriel, zone, relance) {
  const t = {
    emailSubject: "Votre maquette vous attend",
    emailHtmlContent: gabarit(lienDe(zone), relance),
    senderName: "Georama",
    senderEmailAddress: EXPEDITEUR,
    replyTo: { emailAddress: EXPEDITEUR },
    toRecipients: [{ emailAddress: courriel }],
    type: relance ? "MARKETING" : "TRANSACTIONAL"
  };
  if (relance) t.marketingOptions = { unsubscribeUrlPlaceholder: DESABO };
  return envoyer(t);
}

export const envoyerMaquette = webMethod(Permissions.Anyone, async (d) => {
  try {
    const courriel = String((d && d.courriel) || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(courriel) || courriel.length > 120) return { ok: false };
    if (!zoneValide(d.zone)) return { ok: false };
    const hier = new Date(Date.now() - 864e5);
    const aujourdhui = await wixData.query(COLLECTION).gt("_createdDate", hier).count(SUDO);
    if (aujourdhui >= MAX_PAR_JOUR) return { ok: false };
    const deja = await wixData.query(COLLECTION).eq("courriel", courriel).gt("_createdDate", new Date(Date.now() - 6e5)).count(SUDO);
    if (deja >= 2) return { ok: false }; // au plus 2 envois par adresse en 10 minutes
    await envoi(courriel, d.zone, false);
    await wixData.insert(COLLECTION, {
      courriel, zone: String(d.zone), segment: propre(d.segment).slice(0, 20), rappel: d.rappel === true,
      relanceLe: d.rappel === true ? new Date(Date.now() + JOURS_RELANCE * 864e5) : null, relanceFaite: false
    }, SUDO);
    // À FAIRE à l'installation : si d.rappel, noter le consentement du contact (abonnement courriel SUBSCRIBED).
    return { ok: true };
  } catch (e) {
    console.error("envoyerMaquette", e);
    return { ok: false };
  }
});

// Tâche planifiée (jobs.config), une fois par jour : relance des cases cochées, 3 jours plus tard.
export async function relancer() {
  if (!ADRESSE_POSTALE) return;
  const r = await wixData.query(COLLECTION).eq("rappel", true).ne("relanceFaite", true).le("relanceLe", new Date()).limit(50).find(SUDO);
  for (const it of r.items) {
    try {
      // À FAIRE à l'installation : sauter si une commande payée existe pour cette adresse depuis l'envoi.
      await envoi(it.courriel, it.zone, true);
    } catch (e) { console.error("relancer", it._id, e); }
    it.relanceFaite = true;
    await wixData.update(COLLECTION, it, SUDO);
  }
}
