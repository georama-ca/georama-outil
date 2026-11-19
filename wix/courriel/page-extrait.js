// À ajouter là où la page lit déjà les messages de l'outil (#html1) : brouillon, pas installé.
import { envoyerMaquette } from "backend/courriel.web";
export function brancherCourriel($outil) {
  $outil.onMessage(async (e) => {
    const m = e.data;
    if (!m) return;
    if (m.type === "georama-courriel-dispo") $outil.postMessage({ type: "georama-courriel-pret" });
    if (m.type === "georama-courriel") {
      let ok = false;
      try { ok = !!(await envoyerMaquette({ courriel: m.courriel, rappel: m.rappel === true, zone: m.zone, segment: m.segment })).ok; } catch (er) {}
      $outil.postMessage({ type: "georama-courriel-resultat", ok });
    }
  });
}
