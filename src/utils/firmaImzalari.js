const ROLES = ["isveren", "uzman", "hekim", "temsilci", "destek", "bilgi"];

export const emptyFirmaImzalari = () =>
  Object.fromEntries(ROLES.map((role) => [role, { imza: null, paraf: null }]));

export function normalizeFirmaImzalari(incoming) {
  const root =
    incoming?.payload?.imzalar ||
    incoming?.payload ||
    incoming?.data?.imzalar ||
    incoming?.data ||
    incoming?.imzalar ||
    incoming ||
    {};

  return {
    ...emptyFirmaImzalari(),
    ...root,
    isveren: root?.isveren || root?.isverenVekili || root?.isveren_vekili || { imza: null, paraf: null },
    uzman: root?.uzman || root?.isgUzmani || root?.isg_uzmani || { imza: null, paraf: null },
    hekim: root?.hekim || root?.isyeriHekimi || root?.isyeri_hekimi || { imza: null, paraf: null },
  };
}

export function pdfImzalari(firmaImzalari, adlar = {}) {
  return {
    ...normalizeFirmaImzalari(firmaImzalari),
    isgUzmaniAdi: adlar.isgUzmaniAdi || "",
    isyeriHekimiAdi: adlar.isyeriHekimiAdi || "",
    isverenAdi: adlar.isverenAdi || "",
  };
}
