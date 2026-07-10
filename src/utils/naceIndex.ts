// src/utils/naceIndex.ts
import raw from "@/data/naceTR.json";

export type NaceRecord = {
  kod: string;
  faaliyet: string;
  tehlikeSinifi: "AZ TEHLİKELİ" | "TEHLİKELİ" | "ÇOK TEHLİKELİ";
};

type Hit = { faaliyet: string; tehlikeSinifi: NaceRecord["tehlikeSinifi"] };

export const digitsOnly = (s: string) => (s || "").replace(/\D/g, "");
const upTR = (s: string) => (s || "").toLocaleUpperCase("tr-TR");

const INDEX = new Map<string, Hit>(); // anahtar: 2/4/6 haneli sayısal NACE

(function buildIndex() {
  (raw as NaceRecord[]).forEach((row) => {
    const key = digitsOnly(row.kod);
    if (!key) return;
    INDEX.set(key, { faaliyet: row.faaliyet, tehlikeSinifi: row.tehlikeSinifi });
  });
})();

export function naceLookup(naceInput: string): Hit | null {
  const n6 = digitsOnly(naceInput).slice(0, 6);
  if (!n6) return null;
  const k6 = n6;
  const k4 = n6.slice(0, 4);
  const k2 = n6.slice(0, 2);

  const hit = INDEX.get(k6) || INDEX.get(k4) || INDEX.get(k2);
  if (!hit) return null;

  return { faaliyet: upTR(hit.faaliyet), tehlikeSinifi: hit.tehlikeSinifi };
}
