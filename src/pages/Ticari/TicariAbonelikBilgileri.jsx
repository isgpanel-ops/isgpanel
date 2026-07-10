// TicariAbonelikBilgileri.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// âœ… DOÄRUSU (LOCAL)
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const trCurrency = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n || 0));

const KVKK_TEXT = (
  <>
    <p className="font-semibold">KVKK AydÄ±nlatma Metni</p>
    <p className="text-xs text-slate-500 mt-1">Son gÃ¼ncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Veri Sorumlusu</p>
    <p className="mt-1">
      6698 sayÄ±lÄ± KiÅŸisel Verilerin KorunmasÄ± Kanunu (â€œKVKKâ€) uyarÄ±nca, kiÅŸisel verileriniz; veri
      sorumlusu sÄ±fatÄ±yla Mehmet ArÄ±kan (Ä°SG Panel) tarafÄ±ndan iÅŸlenebilecektir.
    </p>

    <p className="mt-3 font-semibold">2. Ä°ÅŸlenen KiÅŸisel Veriler</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Kimlik ve iletiÅŸim bilgileri (ad, soyad, e-posta, telefon)</li>
      <li>Firma ve gÃ¶rev bilgileri</li>
      <li>Ä°SG eÄŸitim, belge ve kayÄ±t bilgileri</li>
      <li>KullanÄ±cÄ± iÅŸlem ve iÅŸlem gÃ¼venliÄŸi kayÄ±tlarÄ± (log, IP, oturum, cihaz/Ã§erez bilgileri)</li>
      <li>Finans ve Ã¶deme bilgileri (fatura bilgileri, abonelik/paket bilgileri, Ã¶deme iÅŸlem kayÄ±tlarÄ±)</li>
    </ul>

    <p className="mt-3 font-semibold">3. Ä°ÅŸlenme AmaÃ§larÄ±</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Ä°SG Panel (www.isgpanel.tr) yazÄ±lÄ±m hizmetinin sunulmasÄ±</li>
      <li>KullanÄ±cÄ± hesabÄ± oluÅŸturma ve yÃ¶netimi</li>
      <li>Ä°SG sÃ¼reÃ§lerinin dijital takibi, kayÄ±tlarÄ±n tutulmasÄ± ve belge Ã¼retimi</li>
      <li>Destek taleplerinin yÃ¶netilmesi ve kullanÄ±cÄ± deneyiminin iyileÅŸtirilmesi</li>
      <li>Mevzuattan doÄŸan yÃ¼kÃ¼mlÃ¼lÃ¼klerin yerine getirilmesi</li>
      <li>Abonelik, Ã¶deme ve finans sÃ¼reÃ§lerinin yÃ¼rÃ¼tÃ¼lmesi</li>
      <li>Bilgi gÃ¼venliÄŸi sÃ¼reÃ§lerinin yÃ¼rÃ¼tÃ¼lmesi ve suistimallerin Ã¶nlenmesi</li>
    </ul>

    <p className="mt-3 font-semibold">4. Hukuki Sebepler</p>
    <p className="mt-1">
      KiÅŸisel verileriniz KVKK m.5/2 kapsamÄ±nda; sÃ¶zleÅŸmenin kurulmasÄ± ve ifasÄ± (m.5/2-c), hukuki
      yÃ¼kÃ¼mlÃ¼lÃ¼klerin yerine getirilmesi (m.5/2-Ã§), bir hakkÄ±n tesisi/kullanÄ±lmasÄ±/korunmasÄ± (m.5/2-e)
      ve veri sorumlusunun meÅŸru menfaati (m.5/2-f) hukuki sebeplerine dayanÄ±larak iÅŸlenmektedir.
    </p>
    <p className="mt-2 text-sm">
      Not: Kanunâ€™da Ã¶ngÃ¶rÃ¼len haller dÄ±ÅŸÄ±nda aÃ§Ä±k rÄ±za gerektiren pazarlama/iletiÅŸim faaliyetleri
      yÃ¼rÃ¼tÃ¼lmesi halinde ayrÄ±ca aÃ§Ä±k rÄ±zanÄ±z talep edilecektir.
    </p>

    <p className="mt-3 font-semibold">5. AktarÄ±m</p>
    <p className="mt-1">
      KiÅŸisel verileriniz; barÄ±ndÄ±rma ve altyapÄ± hizmeti alÄ±nan teknoloji saÄŸlayÄ±cÄ±larÄ±na,
      Ã¶deme/finans kuruluÅŸlarÄ±na (Ã¶rn. iyzico gibi Ã¶deme hizmeti saÄŸlayÄ±cÄ±larÄ±) ve yetkili kamu kurum
      ve kuruluÅŸlarÄ±na KVKKâ€™nÄ±n 8 ve 9. maddelerine uygun olarak aktarÄ±labilecektir.
    </p>
    <p className="mt-2">
      Yurt dÄ±ÅŸÄ±na aktarÄ±m sÃ¶z konusu olmasÄ± halinde, KVKK m.9 kapsamÄ±ndaki usul ve esaslara uygun
      hareket edilir.
    </p>

    <p className="mt-3 font-semibold">6. Saklama SÃ¼resi</p>
    <p className="mt-1">
      KiÅŸisel verileriniz, hizmet iliÅŸkisi sÃ¼resince ve ilgili mevzuatta Ã¶ngÃ¶rÃ¼len sÃ¼reler boyunca
      saklanÄ±r. Saklama sÃ¼resi sonunda veriler; KVKK ve ilgili mevzuata uygun olarak silinir, yok
      edilir veya anonim hale getirilir.
    </p>

    <p className="mt-3 font-semibold">7. HaklarÄ±nÄ±z (KVKK m.11)</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>KiÅŸisel verilerinizin iÅŸlenip iÅŸlenmediÄŸini Ã¶ÄŸrenme</li>
      <li>KiÅŸisel verileriniz iÅŸlenmiÅŸse buna iliÅŸkin bilgi talep etme</li>
      <li>Ä°ÅŸlenme amacÄ±nÄ± ve amacÄ±na uygun kullanÄ±lÄ±p kullanÄ±lmadÄ±ÄŸÄ±nÄ± Ã¶ÄŸrenme</li>
      <li>Yurt iÃ§inde veya yurt dÄ±ÅŸÄ±nda aktarÄ±ldÄ±ÄŸÄ± Ã¼Ã§Ã¼ncÃ¼ kiÅŸileri bilme</li>
      <li>Eksik veya yanlÄ±ÅŸ iÅŸlenmiÅŸse dÃ¼zeltilmesini isteme</li>
      <li>KVKKâ€™da Ã¶ngÃ¶rÃ¼len ÅŸartlar Ã§erÃ§evesinde silinmesini veya yok edilmesini isteme</li>
      <li>DÃ¼zeltme/silme/yok etme iÅŸlemlerinin aktarÄ±lan Ã¼Ã§Ã¼ncÃ¼ kiÅŸilere bildirilmesini isteme</li>
      <li>
        Ä°ÅŸlenen verilerin mÃ¼nhasÄ±ran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize bir
        sonucun ortaya Ã§Ä±kmasÄ±na itiraz etme
      </li>
      <li>Kanuna aykÄ±rÄ± iÅŸlenmesi sebebiyle zarara uÄŸramanÄ±z hÃ¢linde zararÄ±n giderilmesini talep etme</li>
    </ul>

    <p className="mt-3 font-semibold">8. BaÅŸvuru</p>
    <p className="mt-1">
      KVKK kapsamÄ±ndaki taleplerinizi <b>isgpanel@gmail.com</b> adresine e-posta gÃ¶ndererek
      iletebilirsiniz.
    </p>
    <p className="mt-2">
      BaÅŸvurunuzda; ad-soyad, baÅŸvuru konusu, iletiÅŸim bilgileriniz ve talebinize iliÅŸkin aÃ§Ä±klamalarÄ±n
      yer almasÄ± Ã¶nerilir.
    </p>

    <p className="mt-4 font-semibold">Veri Sorumlusu</p>
    <p className="mt-1">
      Mehmet ArÄ±kan (Ä°SG Panel)
      <br />
      Web: www.isgpanel.tr
      <br />
      E-posta: isgpanel@gmail.com
      <br />
      Adres: BaÄŸlarbaÅŸÄ± Mah. 431 Cad. No:63 Daire 15 KeÃ§iÃ¶ren / Ankara
    </p>
  </>
);

const TERMS_TEXT = (
  <>
    <p className="font-semibold">Ãœyelik SÃ¶zleÅŸmesi / KullanÄ±m KoÅŸullarÄ±</p>
    <p className="text-xs text-slate-500 mt-1">Son gÃ¼ncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Taraflar</p>
    <p className="mt-1">
      Ä°ÅŸbu Ãœyelik SÃ¶zleÅŸmesi (â€œSÃ¶zleÅŸmeâ€); Mehmet ArÄ±kan (Ä°SG Panel) (â€œHizmet SaÄŸlayÄ±cÄ±â€) ile Ä°SG Panel
      platformuna Ã¼ye olan kullanÄ±cÄ± (â€œKullanÄ±cÄ±â€) arasÄ±nda elektronik ortamda kurulmuÅŸ ve yÃ¼rÃ¼rlÃ¼ÄŸe
      girmiÅŸtir.
    </p>

    <p className="mt-3 font-semibold">2. TanÄ±mlar</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>
        <b>Platform:</b> Ä°SG Panel web sitesi ve/veya uygulamasÄ±.
      </li>
      <li>
        <b>Hizmet:</b> Ä°SG sÃ¼reÃ§lerinin dijital takibi, dokÃ¼man/belge yÃ¶netimi, raporlama, gÃ¶rev/hatÄ±rlatma
        ve benzeri SaaS modÃ¼llerinin sunulmasÄ±.
      </li>
      <li>
        <b>Hesap:</b> KullanÄ±cÄ±â€™nÄ±n Platformâ€™a eriÅŸim saÄŸladÄ±ÄŸÄ± Ã¼yelik hesabÄ±.
      </li>
      <li>
        <b>Ä°Ã§erik/Veri:</b> KullanÄ±cÄ±â€™nÄ±n Platformâ€™a yÃ¼klediÄŸi, oluÅŸturduÄŸu veya girdiÄŸi her tÃ¼rlÃ¼ bilgi,
        dokÃ¼man ve kayÄ±t.
      </li>
      <li>
        <b>Plan/Paket:</b> Platformâ€™un Ã¼cretli/Ã¼cretsiz kullanÄ±m kapsamÄ±nÄ± ve limitlerini belirleyen abonelik
        planÄ± (kullanÄ±cÄ± sayÄ±sÄ±, modÃ¼l eriÅŸimi, depolama vb.).
      </li>
      <li>
        <b>Abonelik DÃ¶nemi:</b> SeÃ§ilen pakete gÃ¶re aylÄ±k/yÄ±llÄ±k kullanÄ±m sÃ¼resi.
      </li>
    </ul>

    <p className="mt-3 font-semibold">3. Konu ve Kapsam</p>
    <p className="mt-1">
      SÃ¶zleÅŸmenin konusu; KullanÄ±cÄ±â€™nÄ±n Platformâ€™a Ã¼ye olarak Hizmetâ€™ten yararlanmasÄ±na ve Hizmet
      SaÄŸlayÄ±cÄ±â€™nÄ±n Hizmetâ€™i sunmasÄ±na iliÅŸkin ÅŸartlarÄ±n belirlenmesidir. Platform kapsamÄ±, modÃ¼ller,
      kullanÄ±m limitleri ve Ã¶zellikler seÃ§ilen Plan/Paketâ€™e gÃ¶re deÄŸiÅŸiklik gÃ¶sterebilir.
    </p>

    <p className="mt-3 font-semibold">4. Ãœyelik ve Hesap GÃ¼venliÄŸi</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Ãœyelik sÄ±rasÄ±nda saÄŸlanan bilgilerin doÄŸru, gÃ¼ncel ve eksiksiz olmasÄ± KullanÄ±cÄ±â€™nÄ±n sorumluluÄŸundadÄ±r.</li>
      <li>Hesap ÅŸifresi ve eriÅŸim bilgilerinin gizliliÄŸi KullanÄ±cÄ±â€™ya aittir; Ã¼Ã§Ã¼ncÃ¼ kiÅŸilerle paylaÅŸÄ±lmamalÄ±dÄ±r.</li>
      <li>Hesap Ã¼zerinden yapÄ±lan iÅŸlemler KullanÄ±cÄ± tarafÄ±ndan yapÄ±lmÄ±ÅŸ kabul edilir.</li>
      <li>Yetkisiz eriÅŸim ÅŸÃ¼phesi halinde KullanÄ±cÄ±, Hizmet SaÄŸlayÄ±cÄ±â€™yÄ± gecikmeksizin bilgilendirmelidir.</li>
      <li>Hizmet SaÄŸlayÄ±cÄ± gÃ¼venlik gerekÃ§esiyle oturum sonlandÄ±rma, doÄŸrulama, ÅŸifre yenileme gibi Ã¶nlemler uygulayabilir.</li>
    </ul>

    <p className="mt-3 font-semibold">5. Hizmetin SunulmasÄ±</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Hizmet â€œolduÄŸu gibiâ€ ve â€œmevcut haliyleâ€ sunulur; kesintisiz ve hatasÄ±z Ã§alÄ±ÅŸma taahhÃ¼t edilmez.</li>
      <li>Zorunlu bakÄ±m/iyileÅŸtirme Ã§alÄ±ÅŸmalarÄ± nedeniyle geÃ§ici kesintiler yaÅŸanabilir.</li>
      <li>Hizmet SaÄŸlayÄ±cÄ±, hizmet kalitesini artÄ±rmak iÃ§in arayÃ¼z/iÅŸleyiÅŸte makul deÄŸiÅŸiklikler yapabilir.</li>
    </ul>

    <p className="mt-3 font-semibold">6. Destek ve Ä°letiÅŸim</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Destek talepleri, Platformâ€™da belirtilen destek kanallarÄ± Ã¼zerinden alÄ±nÄ±r (e-posta/form vb.).</li>
      <li>Hizmet SaÄŸlayÄ±cÄ±, taleplere makul sÃ¼re iÃ§inde dÃ¶nÃ¼ÅŸ saÄŸlamayÄ± hedefler; yoÄŸunluk ve talep niteliÄŸine gÃ¶re sÃ¼re deÄŸiÅŸebilir.</li>
      <li>BakÄ±m/planlÄ± kesintiler mÃ¼mkÃ¼n oldukÃ§a Ã¶nceden duyurur.</li>
    </ul>

    <p className="mt-3 font-semibold">7. KullanÄ±m KurallarÄ± ve YasaklÄ± Eylemler</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Hukuka, kamu dÃ¼zenine ve Ã¼Ã§Ã¼ncÃ¼ kiÅŸi haklarÄ±na aykÄ±rÄ± iÃ§erik yÃ¼klenmesi/iletilmesi yasaktÄ±r.</li>
      <li>
        Platformâ€™a yetkisiz eriÅŸim, zafiyet denemesi, veri kazÄ±ma (scraping), tersine mÃ¼hendislik, saldÄ±rÄ± (DDoS vb.) yasaktÄ±r.
      </li>
      <li>VirÃ¼s, zararlÄ± yazÄ±lÄ±m, spam veya Platformâ€™u kesintiye uÄŸratacak eylemler gerÃ§ekleÅŸtirilemez.</li>
      <li>Platformâ€™un marka, yazÄ±lÄ±m, tasarÄ±m ve iÃ§erik unsurlarÄ± Ã¼zerindeki fikri mÃ¼lkiyet haklarÄ± saklÄ±dÄ±r.</li>
    </ul>

    <p className="mt-3 font-semibold">8. Fikri MÃ¼lkiyet ve Lisans</p>
    <p className="mt-1">
      Platformâ€™a iliÅŸkin yazÄ±lÄ±m, tasarÄ±m, arayÃ¼z, marka, logo ve tÃ¼m fikri mÃ¼lkiyet unsurlarÄ± Hizmet SaÄŸlayÄ±cÄ±â€™ya aittir
      veya lisanslÄ±dÄ±r. KullanÄ±cÄ±â€™ya, yalnÄ±zca seÃ§ilen Plan/Paket kapsamÄ±nda ve SÃ¶zleÅŸme sÃ¼resince Platformâ€™u kullanmak Ã¼zere
      devredilemez, mÃ¼nhasÄ±r olmayan bir kullanÄ±m lisansÄ± tanÄ±nÄ±r.
    </p>

    <p className="mt-3 font-semibold">9. KullanÄ±cÄ± Ä°Ã§eriÄŸi (Veri) â€“ Sahiplik, Yedekleme, Silme</p>
    <p className="mt-1">
      KullanÄ±cÄ±, Platformâ€™a yÃ¼klediÄŸi/girdiÄŸi Ä°Ã§erik/Veri Ã¼zerinde gerekli haklara sahip olduÄŸunu; Ä°Ã§erikâ€™in hukuka uygun
      olduÄŸunu ve Ã¼Ã§Ã¼ncÃ¼ kiÅŸilerin haklarÄ±nÄ± ihlal etmediÄŸini kabul eder. KullanÄ±cÄ± Ä°Ã§eriÄŸiâ€™nin mÃ¼lkiyeti KullanÄ±cÄ±â€™da kalÄ±r.
      Hizmet SaÄŸlayÄ±cÄ±, Ä°Ã§erikâ€™i yalnÄ±zca Hizmetâ€™in sunulmasÄ±, gÃ¼venliÄŸin saÄŸlanmasÄ± ve yasal yÃ¼kÃ¼mlÃ¼lÃ¼klerin yerine getirilmesi
      amaÃ§larÄ±yla iÅŸler.
    </p>
    <ul className="list-disc ml-5 mt-2 space-y-1">
      <li>KullanÄ±cÄ±, kendi Ä°Ã§erikâ€™ini ayrÄ±ca yedeklemekle yÃ¼kÃ¼mlÃ¼dÃ¼r.</li>
      <li>Hizmet SaÄŸlayÄ±cÄ± teknik gereklilikler doÄŸrultusunda yedekleme/geri yÃ¼kleme mekanizmalarÄ± kullanabilir; mutlak veri kaybÄ±nÄ± Ã¶nleme garantisi vermez.</li>
      <li>Hesap kapatma/abonelik bitimi sonrasÄ± veri saklama ve silme sÃ¼reÃ§leri KVKK ve ilgili mevzuata gÃ¶re yÃ¼rÃ¼tÃ¼lÃ¼r.</li>
    </ul>
    <p className="mt-2 text-sm">
      Not: Platform Ã¼zerinden oluÅŸturulan Ã§Ä±ktÄ±/ÅŸablonlar bilgilendirme amaÃ§lÄ± olup, nihai mevzuat uyumu bakÄ±mÄ±ndan kontrol sorumluluÄŸu KullanÄ±cÄ±â€™ya aittir.
    </p>

    <p className="mt-3 font-semibold">10. Ãœcretlendirme, Ã–deme, Fatura</p>
    <p className="mt-1">
      Ãœcretli paketlerde fiyatlar; dÃ¶nem (aylÄ±k/yÄ±llÄ±k), kapsam, kullanÄ±cÄ± limiti ve KDV dahil/haric bilgileri web sitesinde
      ve/veya Ã¶deme ekranÄ±nda gÃ¶sterilir. Ã–deme adÄ±mlarÄ±nda gÃ¶sterilen tutar ve koÅŸullar esas alÄ±nÄ±r.
    </p>
    <ul className="list-disc ml-5 mt-2 space-y-1">
      <li>Ã–demeler, Hizmet SaÄŸlayÄ±cÄ±â€™nÄ±n Ã§alÄ±ÅŸtÄ±ÄŸÄ± Ã¶deme hizmet saÄŸlayÄ±cÄ±larÄ± aracÄ±lÄ±ÄŸÄ±yla alÄ±nabilir.</li>
      <li>Fatura/e-arÅŸiv/e-fatura sÃ¼reÃ§leri mevzuata uygun yÃ¼rÃ¼tÃ¼lÃ¼r; gerekli hallerde KullanÄ±cÄ±â€™dan fatura bilgileri talep edilir.</li>
      <li>KullanÄ±cÄ±, bankasÄ±/Ã¶deme kuruluÅŸu tarafÄ±ndan uygulanabilecek komisyon/masraf ve benzeri kesintilerden kendisinin sorumlu olabileceÄŸini kabul eder.</li>
    </ul>

    <p className="mt-3 font-semibold">11. Abonelik Yenileme, Plan DeÄŸiÅŸikliÄŸi, Ä°ptal</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Abonelik, seÃ§ilen dÃ¶nemin bitimine kadar geÃ§erlidir.</li>
      <li>Abonelik yenileme koÅŸullarÄ± (otomatik yenileme olup olmadÄ±ÄŸÄ±, yenileme bedeli ve yenileme tarihi) satÄ±n alma anÄ±nda ve/veya panelde gÃ¶sterilir.</li>
      <li>KullanÄ±cÄ±, panel Ã¼zerinden plan/paket deÄŸiÅŸikliÄŸi yapabilir; Ã¼cret farkÄ± ve uygulanma tarihi ekranda gÃ¶sterilen kurallara gÃ¶re uygulanÄ±r.</li>
      <li>KullanÄ±cÄ±, aboneliÄŸini yenilememe/iptal etme seÃ§eneÄŸini (varsa) panel Ã¼zerinden kullanabilir. Ä°ptal halinde, mevcut dÃ¶nem sonuna kadar eriÅŸim devam edebilir (satÄ±n alma anÄ±ndaki koÅŸullara gÃ¶re).</li>
    </ul>

    <p className="mt-3 font-semibold">12. Cayma HakkÄ± ve Ä°ade</p>
    <p className="mt-1">
      KullanÄ±cÄ±â€™nÄ±n 6502 sayÄ±lÄ± Kanun kapsamÄ±nda â€œtÃ¼keticiâ€ olmasÄ± halinde; cayma hakkÄ± ve iade sÃ¼reÃ§leri â€œMesafeli SatÄ±ÅŸ SÃ¶zleÅŸmesiâ€
      ve ilgili mevzuat hÃ¼kÃ¼mlerine tabidir. Dijital hizmetlerde ifaya baÅŸlanmasÄ± gibi hallerde cayma hakkÄ± istisnalarÄ± uygulanabilir.
    </p>

    <p className="mt-3 font-semibold">13. AskÄ±ya Alma / Fesih</p>
    <p className="mt-1">
      KullanÄ±cÄ± dilediÄŸinde hesabÄ±nÄ± kapatarak Ã¼yeliÄŸini sonlandÄ±rabilir. Hizmet SaÄŸlayÄ±cÄ±; sÃ¶zleÅŸmeye aykÄ±rÄ±lÄ±k, kÃ¶tÃ¼ye kullanÄ±m,
      hukuka aykÄ±rÄ±lÄ±k veya gÃ¼venlik riski hallerinde hesabÄ± geÃ§ici olarak askÄ±ya alabilir veya feshedebilir. Mevzuattan doÄŸan saklama
      yÃ¼kÃ¼mlÃ¼lÃ¼kleri saklÄ±dÄ±r.
    </p>

    <p className="mt-3 font-semibold">14. MÃ¼cbir Sebep</p>
    <p className="mt-1">
      TaraflarÄ±n kontrolÃ¼ dÄ±ÅŸÄ±nda geliÅŸen; doÄŸal afet, savaÅŸ, siber saldÄ±rÄ±, altyapÄ±/elektrik kesintisi, mevzuat deÄŸiÅŸikliÄŸi gibi mÃ¼cbir
      sebepler nedeniyle edimlerin ifasÄ± engellenir veya gecikirse, taraflar sorumlu tutulamaz.
    </p>

    <p className="mt-3 font-semibold">15. SorumluluÄŸun SÄ±nÄ±rlandÄ±rÄ±lmasÄ±</p>
    <p className="mt-1">
      Hizmet SaÄŸlayÄ±cÄ±; internet/altyapÄ± kesintileri, Ã¼Ã§Ã¼ncÃ¼ taraf hizmetlerinden kaynaklanan aksamalar ve teknik zorunluluklar nedeniyle
      doÄŸabilecek eriÅŸim sorunlarÄ±ndan mevzuatÄ±n izin verdiÄŸi Ã¶lÃ§Ã¼de sorumlu deÄŸildir. DolaylÄ± zararlar, kÃ¢r kaybÄ±, iÅŸ kaybÄ±, veri kaybÄ± gibi
      sonuÃ§lardan sorumluluk kabul edilmez.
    </p>

    <p className="mt-3 font-semibold">16. DeÄŸiÅŸiklikler</p>
    <p className="mt-1">
      Hizmet SaÄŸlayÄ±cÄ±, mevzuat ve hizmet gereksinimleri doÄŸrultusunda SÃ¶zleÅŸmeâ€™de deÄŸiÅŸiklik yapabilir. GÃ¼ncel metin Platformâ€™da yayÄ±mlandÄ±ÄŸÄ±
      tarihten itibaren geÃ§erli olur.
    </p>

    <p className="mt-3 font-semibold">17. UyuÅŸmazlÄ±k</p>
    <p className="mt-1">
      KullanÄ±cÄ±â€™nÄ±n tÃ¼ketici olduÄŸu uyuÅŸmazlÄ±klarda ilgili mevzuat gereÄŸi TÃ¼ketici Hakem Heyetleri / TÃ¼ketici Mahkemeleri yetkilidir.
      TÃ¼ketici olmayan KullanÄ±cÄ±lar bakÄ±mÄ±ndan Ankara Mahkemeleri ve Ä°cra Daireleri yetkilidir.
    </p>

    <p className="mt-4 font-semibold">Hizmet SaÄŸlayÄ±cÄ±</p>
    <p className="mt-1">
      Mehmet ArÄ±kan (Ä°SG Panel)
      <br />
      Adres: BaÄŸlarbaÅŸÄ± Mah. 431 Cad. No:63 Daire 15 KeÃ§iÃ¶ren / Ankara
      <br />
      E-posta: isgpanel@gmail.com
      <br />
      Web: www.isgpanel.tr
    </p>
  </>
);

const SALES_TEXT = (
  <>
    <p className="font-semibold">Mesafeli SatÄ±ÅŸ SÃ¶zleÅŸmesi (Dijital Abonelik)</p>
    <p className="text-xs text-slate-500 mt-1">Son gÃ¼ncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Taraflar</p>
    <p className="mt-1">
      Ä°ÅŸbu Mesafeli SatÄ±ÅŸ SÃ¶zleÅŸmesi (â€œSÃ¶zleÅŸmeâ€); aÅŸaÄŸÄ±da bilgileri bulunan Mehmet ArÄ±kan (Ä°SG Panel) (â€œSatÄ±cÄ±â€) ile www.isgpanel.tr Ã¼zerinden
      dijital abonelik hizmeti satÄ±n alan kullanÄ±cÄ± (â€œAlÄ±cÄ±/TÃ¼keticiâ€) arasÄ±nda elektronik ortamda kurulmuÅŸtur.
    </p>

    <p className="mt-3 font-semibold">2. SÃ¶zleÅŸmenin Konusu</p>
    <p className="mt-1">
      Bu SÃ¶zleÅŸmeâ€™nin konusu; AlÄ±cÄ±â€™nÄ±n, SatÄ±cÄ± tarafÄ±ndan sunulan Ä°SG Panel yazÄ±lÄ±m hizmetine (â€œHizmetâ€) iliÅŸkin dijital abonelik satÄ±n almasÄ± ve
      kullanmasÄ±na dair taraflarÄ±n hak ve yÃ¼kÃ¼mlÃ¼lÃ¼klerinin belirlenmesidir.
    </p>

    <p className="mt-3 font-semibold">3. Hizmetin NiteliÄŸi</p>
    <p className="mt-1">
      Hizmet, fiziksel teslimat iÃ§ermeyen, internet Ã¼zerinden eriÅŸim saÄŸlanan yazÄ±lÄ±m hizmeti (SaaS) niteliÄŸindedir. Hizmet kapsamÄ±, modÃ¼ller,
      kullanÄ±cÄ± limitleri ve Ã¶zellikler satÄ±n alÄ±nan plan/pakete gÃ¶re deÄŸiÅŸebilir.
    </p>

    <p className="mt-3 font-semibold">4. SipariÅŸ, Ã–deme ve Ã–deme KuruluÅŸu</p>
    <p className="mt-1">
      Abonelik planÄ±, dÃ¶nem (aylÄ±k/yÄ±llÄ±k), bedel ve KDV dahil/haric tutar Ã¶deme ekranÄ±nda aÃ§Ä±kÃ§a gÃ¶sterilir. Ã–deme, SatÄ±cÄ±â€™nÄ±n anlaÅŸmalÄ± Ã¶deme
      altyapÄ±sÄ± saÄŸlayÄ±cÄ±sÄ± (Ã¶r. iyzico) Ã¼zerinden tahsil edilebilir. Ã–deme tamamlandÄ±ÄŸÄ±nda abonelik AlÄ±cÄ± hesabÄ±na tanÄ±mlanÄ±r.
    </p>

    <p className="mt-3 font-semibold">5. Hizmete EriÅŸim ve Ä°fa ZamanÄ±</p>
    <p className="mt-1">
      Hizmet, kullanÄ±cÄ± hesabÄ± Ã¼zerinden Ã§evrim iÃ§i olarak sunulur. Ã–deme onayÄ± ve aboneliÄŸin aktive edilmesiyle birlikte hizmetin ifasÄ±na baÅŸlanmÄ±ÅŸ sayÄ±lÄ±r.
    </p>

    <p className="mt-3 font-semibold">6. Teslimat ve Ä°ade KoÅŸullarÄ±</p>
    <p className="mt-1">
      Ä°SG Panel, fiziksel teslimat iÃ§ermeyen dijital bir yazÄ±lÄ±m hizmetidir. Hizmet, Ã¶deme iÅŸleminin tamamlanmasÄ±nÄ±n ardÄ±ndan AlÄ±cÄ± hesabÄ±na anÄ±nda tanÄ±mlanÄ±r
      ve elektronik ortamda eriÅŸime aÃ§Ä±lÄ±r. Fiziksel teslimat yapÄ±lmaz. Dijital hizmetlerde cayma hakkÄ±, hizmetin ifasÄ±na baÅŸlanmasÄ±yla birlikte mevzuat kapsamÄ±nda
      sona erebilir.
    </p>

    <p className="mt-3 font-semibold">7. Cayma HakkÄ±</p>
    <p className="mt-1">
      Mesafeli sÃ¶zleÅŸmelerde tÃ¼keticinin cayma hakkÄ± mevzuata tabidir. Ancak dijital hizmetlerde; ifaya AlÄ±cÄ±â€™nÄ±n aÃ§Ä±k onayÄ±yla baÅŸlanmasÄ± ve AlÄ±cÄ±â€™nÄ±n cayma hakkÄ±nÄ±
      kaybedeceÄŸine iliÅŸkin bilgilendirilmesi halinde, cayma hakkÄ± istisnasÄ± doÄŸabilir.
    </p>

    <p className="mt-3 font-semibold">8. AÃ§Ä±k Onay ve Cayma Ä°stisnasÄ± BeyanÄ±</p>
    <p className="mt-1">
      AlÄ±cÄ±, Ã¶deme sonrasÄ± aboneliÄŸin aktive edilmesi ve hizmete eriÅŸimin baÅŸlatÄ±lmasÄ±nÄ±n dijital hizmette ifaya baÅŸlama anlamÄ±na gelebileceÄŸini ve mevzuat kapsamÄ±ndaki
      koÅŸullar oluÅŸtuÄŸunda cayma hakkÄ±nÄ± kaybedebileceÄŸini kabul eder.
    </p>

    <p className="mt-3 font-semibold">9. Ä°ptal, Ä°ade ve MÃ¼kerrer Ã–deme</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Ä°ptal/iade talepleri, hizmetin kullanÄ±m durumu ve mevzuat hÃ¼kÃ¼mleri kapsamÄ±nda deÄŸerlendirilir.</li>
      <li>Teknik hata, mÃ¼kerrer Ã¶deme veya hizmetin sunulamamasÄ± gibi durumlarda iade yapÄ±labilir.</li>
      <li>Ã–deme iadesi, Ã¶deme yÃ¶ntemine/Ã¶deme kuruluÅŸu sÃ¼reÃ§lerine baÄŸlÄ± olarak belirli bir sÃ¼re iÃ§inde gerÃ§ekleÅŸebilir.</li>
    </ul>

    <p className="mt-3 font-semibold">10. TaraflarÄ±n YÃ¼kÃ¼mlÃ¼lÃ¼kleri</p>
    <p className="mt-1">
      SatÄ±cÄ±, hizmeti sÃ¶zleÅŸmeye uygun sunmakla; AlÄ±cÄ± ise doÄŸru Ã¼yelik bilgileri saÄŸlamak, hesabÄ±nÄ± korumak ve hizmeti hukuka uygun kullanmakla yÃ¼kÃ¼mlÃ¼dÃ¼r.
    </p>

    <p className="mt-3 font-semibold">11. SorumluluÄŸun SÄ±nÄ±rlandÄ±rÄ±lmasÄ±</p>
    <p className="mt-1">
      SatÄ±cÄ±; internet kesintileri, altyapÄ± sorunlarÄ±, Ã¼Ã§Ã¼ncÃ¼ taraf hizmet arÄ±zalarÄ± ve mÃ¼cbir sebeplerden kaynaklanan eriÅŸim sorunlarÄ±ndan mevzuatÄ±n izin verdiÄŸi Ã¶lÃ§Ã¼de
      sorumlu deÄŸildir. DolaylÄ± zararlar ve veri kayÄ±plarÄ±ndan sorumluluk kabul edilmez.
    </p>

    <p className="mt-3 font-semibold">12. Fikri MÃ¼lkiyet</p>
    <p className="mt-1">
      Ä°SG Panel yazÄ±lÄ±mÄ±, tasarÄ±mÄ±, markasÄ± ve tÃ¼m iÃ§erik unsurlarÄ±nÄ±n fikri mÃ¼lkiyet haklarÄ± SatÄ±cÄ±â€™ya aittir. AlÄ±cÄ±, hizmeti yalnÄ±zca kullanÄ±m amacÄ±yla kullanabilir.
    </p>

    <p className="mt-3 font-semibold">13. KiÅŸisel Veriler</p>
    <p className="mt-1">
      AlÄ±cÄ±â€™nÄ±n kiÅŸisel verileri Gizlilik PolitikasÄ± ve KVKK aydÄ±nlatma metinleri kapsamÄ±nda iÅŸlenir ve korunur.
    </p>

    <p className="mt-3 font-semibold">14. SÃ¶zleÅŸme DeÄŸiÅŸiklikleri</p>
    <p className="mt-1">
      SatÄ±cÄ±, mevzuat veya hizmet gereksinimleri doÄŸrultusunda sÃ¶zleÅŸme hÃ¼kÃ¼mlerinde deÄŸiÅŸiklik yapabilir. GÃ¼ncel metin web sitesinde yayÄ±mlandÄ±ÄŸÄ± tarihten itibaren geÃ§erli olur.
    </p>

    <p className="mt-3 font-semibold">15. UyuÅŸmazlÄ±k</p>
    <p className="mt-1">
      AlÄ±cÄ±â€™nÄ±n tÃ¼ketici olduÄŸu uyuÅŸmazlÄ±klarda ilgili mevzuat gereÄŸi TÃ¼ketici Hakem Heyetleri / TÃ¼ketici Mahkemeleri yetkilidir. TÃ¼ketici olmayan iÅŸlemlerde Ankara Mahkemeleri ve Ä°cra Daireleri yetkilidir.
    </p>

    <p className="mt-4 font-semibold">SatÄ±cÄ±</p>
    <p className="mt-1">
      Mehmet ArÄ±kan (Ä°SG Panel)
      <br />
      Adres: BaÄŸlarbaÅŸÄ± Mah. 431 Cad. No:63 Daire 15 KeÃ§iÃ¶ren / Ankara
      <br />
      E-posta: isgpanel@gmail.com
      <br />
      Web: www.isgpanel.tr
    </p>
  </>
);

// Basit kart markasÄ± tespiti (demo)
function detectBrand(num) {
  const n = (num || "").replace(/\s|-/g, "");
  if (/^4\d{6,}/.test(n)) return "VISA";
  if (/^5[1-5]\d{5,}/.test(n)) return "MASTERCARD";
  if (/^3[47]\d{5,}/.test(n)) return "AMEX";
  if (/^6(?:011|5)\d{4,}/.test(n)) return "DISC";
  return "CARD";
}

/**
 * âœ… ISO "YYYY-MM-DD" -> Date (LOCAL) gÃ¼venli parse
 * new Date("YYYY-MM-DD") timezone sapmasÄ±na yol aÃ§abildiÄŸi iÃ§in kullanmÄ±yoruz.
 */
function isoToLocalDate(iso, { hour = 0, minute = 0, second = 0, ms = 0 } = {}) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hour, minute, second, ms);
}

// tarih farkÄ± (kalan gÃ¼n) â€” âœ… timezone-safe
function diffDays(fromISO, toISO) {
  try {
    const a = isoToLocalDate(fromISO, { hour: 0, minute: 0, second: 0, ms: 0 });
    const b = isoToLocalDate(toISO, { hour: 0, minute: 0, second: 0, ms: 0 });
    if (!a || !b) return 0;

    const msDiff = b.getTime() - a.getTime();
    return Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

// âœ… TasarÄ±mÄ± bozmadan saniyelik kalan sÃ¼re (sadece HH:MM:SS)
const DAY_MS = 24 * 60 * 60 * 1000;

function getCountdown(endAt) {
  const end = endAt instanceof Date ? endAt : new Date(endAt);
  const now = new Date();

  let ms = end.getTime() - now.getTime();
  if (Number.isNaN(ms)) return { days: 0, hms: "00:00:00" };
  if (ms < 0) ms = 0;

  const days = Math.ceil(ms / DAY_MS);

  const remainAfterFullDays = ms % DAY_MS;
  const totalSeconds = Math.floor(remainAfterFullDays / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad2 = (n) => String(n).padStart(2, "0");
  return { days, hms: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}` };
}

// âœ… ISO datetime + gÃ¼n ekle (saat/dk/sn korunur)
function addDaysToIsoDateTime(isoDateTime, days) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
}

// âœ… addDaysISO â€” timezone-safe (iÅŸ kuralÄ±: AylÄ±k=30, YÄ±llÄ±k=365 korunur)
function addDaysISO(iso, days) {
  const base = iso ? isoToLocalDate(iso, { hour: 12 }) : isoToLocalDate(todayISO(), { hour: 12 });
  if (!base) return todayISO();

  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

const toTRUpper = (s) => String(s || "").toLocaleUpperCase("tr-TR");
const toDateOnly = (v) => (v ? String(v).slice(0, 10) : "");

// âœ… Word benzeri: ilk harf bÃ¼yÃ¼k, "." sonrasÄ± bÃ¼yÃ¼k
function sentenceCaseTR(text) {
  const s = String(text || "");
  if (!s.trim()) return s;

  // BaÅŸtaki ilk harfi bÃ¼yÃ¼t
  let out = s.replace(/^\s*([a-zÃ§ÄŸÄ±Ã¶ÅŸÃ¼])/i, (m, ch) => m.replace(ch, ch.toLocaleUpperCase("tr-TR")));

  // Nokta/soru/Ã¼nlem sonrasÄ± gelen ilk harfi bÃ¼yÃ¼t
  out = out.replace(/([.?!]\s*)([a-zÃ§ÄŸÄ±Ã¶ÅŸÃ¼])/gi, (m, sep, ch) => {
    return sep + ch.toLocaleUpperCase("tr-TR");
  });

  return out;
}

/**
 * Paket yÃ¼kseltme farkÄ± (kalan gÃ¼n Ã¼zerinden)
 * - AylÄ±k: 30 gÃ¼n
 * - YÄ±llÄ±k: 365 gÃ¼n
 */
function calculateUpgradeDiff({
  currentPlan,
  targetPlan,
  period,
  activePeriod,
  daysLeft,
  vatRate,
}) {
  const currentBaseDays = activePeriod === "YÄ±llÄ±k" ? 365 : 30;
  const targetBaseDays = period === "YÄ±llÄ±k" ? 365 : 30;

  const currentPrice =
    activePeriod === "YÄ±llÄ±k"
      ? currentPlan.yearlyExVat
      : currentPlan.monthlyExVat;

  const targetPrice =
    period === "YÄ±llÄ±k"
      ? targetPlan.yearlyExVat
      : targetPlan.monthlyExVat;

  if (currentPrice == null || targetPrice == null) return null;

  const dailyCurrent = Number(currentPrice) / currentBaseDays;
  const dailyTarget = Number(targetPrice) / targetBaseDays;

  const dailyDiff = dailyTarget - dailyCurrent;

  const diffExVat = Math.max(0, dailyDiff * Number(daysLeft || 0));
  const diffVat = diffExVat * vatRate;

  return {
    diffAmountExVat: Math.round(diffExVat),
    diffVat: Math.round(diffVat),
    diffTotal: Math.round(diffExVat + diffVat),
  };
}


/** =========================
 *  Auth + API
 *  ========================= */
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";
function mapApiPlansToUi(apiPlans = []) {
  const byCode = Object.fromEntries(
    (Array.isArray(apiPlans) ? apiPlans : []).map((p) => [String(p.code || ""), p])
  );

 const getMonthly = (code, fallback = 0) => {
  const p = byCode?.[code] || byCode?.[code.replaceAll("-", "_")];
  return Number(p?.monthlyPrice || fallback || 0);
};

  return [
  {
    id: "ticari-5",
    name: "Ticari (Max 5 KullanÄ±cÄ±)",
    note: "KÃ¼Ã§Ã¼k ve orta ekipler iÃ§in",
    users: "En fazla 5 kullanÄ±cÄ±",
    monthlyExVat: getMonthly("ticari_5", 2000),
yearlyExVat: getMonthly("ticari_5", 2000) * 10,
    features: ["SÄ±nÄ±rsÄ±z firma", "TÃ¼m modÃ¼llere eriÅŸim", "HÄ±zlÄ± kurulum & onboarding"],
  },
  {
    id: "ticari-10",
    name: "Ticari (Max 10 KullanÄ±cÄ±)",
    note: "BÃ¼yÃ¼yen ekipler iÃ§in",
    users: "En fazla 10 kullanÄ±cÄ±",
    monthlyExVat: getMonthly("ticari_10", 3500),
yearlyExVat: getMonthly("ticari_10", 3500) * 10,
    features: ["SÄ±nÄ±rsÄ±z firma", "TÃ¼m modÃ¼llere eriÅŸim", "HÄ±zlÄ± kurulum & onboarding"],
  },
  {
    id: "ticari-15",
    name: "Ticari (Max 15 KullanÄ±cÄ±)",
    note: "GeniÅŸ ekipler iÃ§in",
    users: "En fazla 15 kullanÄ±cÄ±",
    monthlyExVat: getMonthly("ticari_15", 5000),
yearlyExVat: getMonthly("ticari_15", 5000) * 10,
    features: ["SÄ±nÄ±rsÄ±z firma", "TÃ¼m modÃ¼llere eriÅŸim", "HÄ±zlÄ± kurulum & onboarding"],
  },
  {
    id: "prof-ozel",
    name: "Kurumsal (15+ KullanÄ±cÄ±)",
    note: "BÃ¼yÃ¼k yapÄ±lar iÃ§in Ã¶zel teklif",
    users: "15+ kullanÄ±cÄ±",
    monthlyExVat: null,
    yearlyExVat: null,
    features: ["SÄ±nÄ±rsÄ±z firma", "TÃ¼m modÃ¼llere eriÅŸim", "HÄ±zlÄ± kurulum & onboarding"],
  },
];
}
async function apiFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Hata");
  return data;
}

/** =========================
 *  Card input helpers (kÄ±sÄ±t + format)
 *  ========================= */
const digitsOnly = (v, maxLen) => {
  const s = String(v || "").replace(/\D/g, "");
  return typeof maxLen === "number" ? s.slice(0, maxLen) : s;
};

const formatCardNumber = (digits) => {
  const d = digitsOnly(digits, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

const formatExpiry = (digits) => {
  const d = digitsOnly(digits, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

/** =========================
 *  LOCAL Ã¶deme yÃ¶ntemi
 *  ========================= */
const PM_KEY = "ticari_payment_method";
function loadPaymentMethod() {
  try {
    const v = JSON.parse(localStorage.getItem(PM_KEY) || "null");
    if (!v) return null;
    return {
      brand: v.brand || v.paymentBrand || "CARD",
      last4: v.last4 || v.paymentLast4 || "",
      holder: v.holder || v.paymentHolder || "",
    };
  } catch {
    return null;
  }
}
function savePaymentMethod({ brand, last4, holder }) {
  try {
    localStorage.setItem(PM_KEY, JSON.stringify({ brand, last4, holder }));
  } catch {}
}

export default function TicariAbonelikBilgileri() {
  const VAT_RATE = 0.2;

  const getFirmFromStorage = () => {
    const keys = ["ticariKurumsalBilgiler", "kurumsalBilgiler", "firmaBilgileri", "firma"];
    for (const k of keys) {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        if (v && (v.firmaAdi || v.unvan || v.title)) return v;
      } catch {}
    }
    return null;
  };

  // âœ… Saniyelik geri sayÄ±m iÃ§in tick (tasarÄ±m bozulmadan re-render)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Kurumsal Kimlik (mevcut yapÄ±)
  const ticariKurumsal = useMemo(() => getFirmFromStorage(), []);

  // KullanÄ±cÄ± (adÄ±/email) (mevcut yapÄ±)
  const userInfo = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u || null;
    } catch {
      return null;
    }
  }, []);



  // âœ… Buton stilleri
  const BTN_GREEN =
    "bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-2.5 rounded-xl text-sm font-bold";
  const BTN_OUTLINE =
    "border border-gray-200 hover:bg-gray-50 px-5 py-2.5 rounded-xl text-sm font-semibold";
  const BTN_SECONDARY =
    "bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-2.5 rounded-xl text-sm font-semibold";
  const BTN_IYZICO =
    "bg-[#2f6fed] hover:bg-[#1e57c8] text-white px-5 py-2.5 rounded-xl text-sm font-bold";

  const STORAGE_KEY = "ticariAbonelikDates";

  const [state, setState] = useState({
    currentPlanId: "ticari-5",
    usersCount: 1,

    period: "AylÄ±k",
    activePeriod: "AylÄ±k",
    showVatIncluded: true,


    // âœ… backend timestamp (sayaÃ§ iÃ§in)
    startAtISO: "",
    endAtISO: "",

    // âœ… UI date-only
    startDate: todayISO(),
    endDate: addDaysISO(todayISO(), 30),

    // âœ… prof-ozel iÃ§in teklif tutarÄ± (KDV DAHÄ°L)
    amountTRY: 0,

    // âœ… kurumsal ek kullanÄ±cÄ± seÃ§imi
    addUsersCount: 1,
    addUsersFlow: {
      active: false,
      ready: false,
      addUsersCount: 0,
    },

    paymentBrand: "VISA",
    paymentLast4: "1234",
    paymentHolder: "",

    coupon: "",
    invoices: [],

    upgrade: {
      targetPlanId: null,
      daysLeft: 0,
      diffAmountExVat: 0,
      diffVat: 0,
      diffTotal: 0,
      show: false,
    },

    upgradeFlow: {
      active: false,
      mode: null,
      targetPlanId: null,
    },

    renewFlow: { active: false },

// âœ… teklif reddedilirse geri dÃ¶nmek iÃ§in
preOfferPlanId: "",
preOfferUsersCount: 0,
preOfferPeriod: "AylÄ±k",
  });

  // âœ… MODAL / FORM HOOK'LARI
  const [showCardModal, setShowCardModal] = useState(false);
  const iyzicoContainerRef = useRef(null);

  // âœ… iyzico stateâ€™leri
  const [showIyzicoModal, setShowIyzicoModal] = useState(false);
  const [iyzicoHtml, setIyzicoHtml] = useState("");
  const [iyzicoError, setIyzicoError] = useState("");
  const [iyzicoLoading, setIyzicoLoading] = useState(false);
  const [canPay, setCanPay] = useState(false);

  // âœ… iyzico HTML bas + scriptleri Ã§alÄ±ÅŸtÄ±r
  useEffect(() => {
    if (!showIyzicoModal) return;
    if (!iyzicoHtml) return;
    if (iyzicoError) return;

    const el = iyzicoContainerRef.current;
    if (!el) return;

    el.innerHTML = iyzicoHtml;

    const scripts = Array.from(el.querySelectorAll("script"));
    scripts.forEach((oldScript) => {
      const s = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        s.setAttribute(attr.name, attr.value);
      });
      s.text = oldScript.text || "";
      oldScript.parentNode?.replaceChild(s, oldScript);
    });

    return () => {
      el.innerHTML = "";
    };
  }, [showIyzicoModal, iyzicoHtml, iyzicoError]);

  const [cardForm, setCardForm] = useState({
    holder: "",
    number: "",
    exp: "",
    cvc: "",
  });

  // âœ… Ã–zel teklif modalÄ±
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerSending, setOfferSending] = useState(false);
  const [offerError, setOfferError] = useState("");

  // âœ… Kurumsal teklif
  const [offerData, setOfferData] = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerFetchError, setOfferFetchError] = useState("");
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentPaymentsLoading, setRecentPaymentsLoading] = useState(false);
  const [recentPaymentsError, setRecentPaymentsError] = useState("");

  const [orgUuid, setOrgUuid] = useState("");
  const [offerAccepted, setOfferAccepted] = useState(false);

  const [offerChecks, setOfferChecks] = useState({ kvkk: false, terms: false, sales: false });
  const [renewChecks, setRenewChecks] = useState({ kvkk: false, terms: false, sales: false });
  const [addUsersChecks, setAddUsersChecks] = useState({ kvkk: false, terms: false, sales: false });

  const [showContractModal, setShowContractModal] = useState(null); // "kvkk" | "terms" | "sales" | null

  const [isPilot, setIsPilot] = useState(false);
  const [offerForm, setOfferForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    usersCount: "",
    message: "",
  });

  /** âœ… FIX (SAYAÃ‡):
   * - endAtISO varsa onu kullan.
   * - endAtISO yoksa ama startAtISO varsa startAtISO + 30/365 gÃ¼n Ã¼ret (saat/dk/sn korunur).
   */
  const [hydrated, setHydrated] = useState(false);
const prevRef = useRef({ period: null, startDate: null });

const [plans, setPlans] = useState(() =>
  mapApiPlansToUi([
    { code: "ticari_5", monthlyPrice: 2000 },
    { code: "ticari_10", monthlyPrice: 3500 },
    { code: "ticari_15", monthlyPrice: 5000 },
  ])
);

  const fetchSubscriptionData = async () => {
  let sub = null;

  let resolvedPeriod = state.period;
  let resolvedStartDate = state.startDate;

  try {
    const res = await apiFetch("/api/subscription/me");
    sub = res.subscription || null;

    const normalizePlanId = (v) => {
      const x = String(v || "").trim();
      if (!x) return null;
      if (x === "kurumsal_ozel" || x === "kurumsal-ozel") return "prof-ozel";
      const y = x.split("_").join("-");
      if (["ticari-5", "ticari-10", "ticari-15", "prof-ozel"].includes(y)) return y;
      return null;
    };

    const pmLS = loadPaymentMethod();

    if (sub) {
      resolvedPeriod = sub.period || resolvedPeriod;

      const startISO = sub.startDate ? String(sub.startDate) : "";
      let endISO = sub.endDate ? String(sub.endDate) : "";

      if (!endISO && startISO) {
        const add = resolvedPeriod === "YÄ±llÄ±k" ? 365 : 30;
        endISO = addDaysToIsoDateTime(startISO, add);
      }

      const startDateOnly = toDateOnly(startISO) || resolvedStartDate;
      resolvedStartDate = startDateOnly;

      const u = Number(sub.usersCount || 1);

      const inferred =
  u <= 5 ? "ticari-5" :
  u <= 10 ? "ticari-10" :
  u <= 15 ? "ticari-15" :
  "prof-ozel";
      const apiPlan = normalizePlanId(sub.currentPlanId || sub.planCode);
      const effectivePlanId = apiPlan || inferred || "ticari-5";

      const pilotFlag = Boolean(
        sub?.isPilot || sub?.pilot || sub?.pilotActive || sub?.pilotToken || sub?.pilotEndDate || sub?.pilotEndAt
      );
      setIsPilot(pilotFlag);

      setState((s) => {
        const nextEndAtISO = endISO || s.endAtISO;

        const nextEndDateOnly =
          toDateOnly(nextEndAtISO) ||
          s.endDate ||
          (resolvedPeriod === "YÄ±llÄ±k" ? addDaysISO(startDateOnly, 365) : addDaysISO(startDateOnly, 30));

        return {
          ...s,
          currentPlanId: effectivePlanId,
          usersCount: u,
          period: sub.period || s.period,
          activePeriod: sub.period || s.activePeriod,
          showVatIncluded: typeof sub.showVatIncluded === "boolean" ? sub.showVatIncluded : s.showVatIncluded,
          autoRenew: typeof sub.autoRenew === "boolean" ? sub.autoRenew : s.autoRenew,
          startAtISO: startISO || s.startAtISO,
          endAtISO: nextEndAtISO,
          startDate: startDateOnly,
          endDate: nextEndDateOnly,
          paymentBrand: sub.paymentBrand || pmLS?.brand || s.paymentBrand,
          paymentLast4: sub.paymentLast4 || pmLS?.last4 || s.paymentLast4,
          paymentHolder: sub.paymentHolder || pmLS?.holder || s.paymentHolder,
          invoices: Array.isArray(sub.invoices) ? sub.invoices : s.invoices,
          amountTRY: Number(sub.amountTRY || sub.amountTRYIncVat || sub.amount || s.amountTRY || 0),
          upgrade: { ...s.upgrade, show: false, targetPlanId: null },
        };
      });
    }
  } catch (e) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setState((s) => ({
        ...s,
        currentPlanId: s.currentPlanId || "ticari-5",
        usersCount: s.usersCount || 1,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      }));
    }
    console.warn("Ticari abonelik API okunamadÄ±:", e.message);
    } finally {
    const hasRealEnd =
      Boolean(sub?.endDate) ||
      Boolean(state.endAtISO);

    const fixedDates = {
      startDate: resolvedStartDate,
      endDate: hasRealEnd ? (toDateOnly(sub?.endDate) || toDateOnly(state.endAtISO) || "") : "",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixedDates));
    prevRef.current = { period: resolvedPeriod, startDate: resolvedStartDate };
    setHydrated(true);
  }
};

useEffect(() => {
  fetchSubscriptionData();

  const handleFocus = () => fetchSubscriptionData();
  const handleVisible = () => {
    if (document.visibilityState === "visible") fetchSubscriptionData();
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisible);

  return () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisible);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

 const fetchOfferData = async () => {
  try {
    setOfferLoading(true);
    setOfferFetchError("");

    const me = await apiFetch("/api/auth/me");

    const org =
      me?.organization?.uuid ||
      me?.organization?._id ||
      me?.organizationUuid ||
      me?.orgUuid ||
      me?.user?.organization?.uuid ||
      me?.user?.organization?._id ||
      me?.user?.organizationUuid ||
      me?.user?.orgUuid ||
      me?.user?.organizationId ||
      me?.user?.organization ||
      "";

    const pilotFlag = Boolean(
      me?.isPilot ||
      me?.user?.isPilot ||
      me?.organization?.pilot ||
      me?.organization?.isPilot ||
      me?.organization?.pilotActive ||
      me?.organization?.pilotEndDate ||
      me?.organization?.pilotEndAt
    );

    setIsPilot(pilotFlag);
    setOrgUuid(org);

    const url = org
      ? `/api/offers/my?orgUuid=${encodeURIComponent(org)}`
      : "/api/offers/my";

    const res = await apiFetch(url);
    setOfferData(res?.offer ?? null);
  } catch (e) {
    setOfferFetchError(e.message || "Teklif okunamadÄ±");
  } finally {
    setOfferLoading(false);
  }
};

useEffect(() => {
  fetchOfferData();

  const handleFocus = () => fetchOfferData();
  const handleVisible = () => {
    if (document.visibilityState === "visible") fetchOfferData();
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisible);

  return () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisible);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const res = await apiFetch("/api/plans");
      if (!alive) return;

      setPlans(mapApiPlansToUi(res));
    } catch (e) {
      console.warn("Planlar okunamadÄ±:", e.message);
    }
  })();

  return () => {
    alive = false;
  };
}, []);


// âœ… Son Ã–demeler (son 6, sadece baÅŸarÄ±lÄ±) â€” orgUuid hazÄ±r olunca Ã§ek
useEffect(() => {
  let alive = true;

  // orgUuid yoksa boÅŸuna istek atma (Ã§oÄŸu backend org filtresi ister)
  if (!orgUuid) return;

  (async () => {
    const pickItems = (res) => {
      const items =
        res?.payments ||
        res?.recentPayments ||
        res?.items ||
        res?.data ||
        res?.rows ||
        res?.results ||
        [];
      return Array.isArray(items) ? items : [];
    };

    const tryFetch = async (url) => {
      try {
        const res = await apiFetch(url);
        return pickItems(res);
      } catch {
        return null;
      }
    };

    // âœ… sadece baÅŸarÄ±lÄ± filtre (backend farklÄ± alanlarla dÃ¶nebilir)
    const isSuccess = (p) => {
  // âœ… Backend /transactions/recent zaten sadece PAID dÃ¶ndÃ¼rÃ¼yor.
  // Status alanÄ± yoksa "baÅŸarÄ±lÄ±" kabul et.
  const raw = p?.status ?? p?.paymentStatus ?? p?.state ?? p?.result;

  if (raw == null || String(raw).trim() === "") return true;

  const st = String(raw).toLowerCase();
  return (
    st === "success" ||
    st === "paid" ||
    st === "succeeded" ||
    st === "ok" ||
    st === "completed"
  );
};

    // âœ… tarihe gÃ¶re sÄ±ralama (en yeni Ã¼stte)
    const getDateMs = (p) => {
      const raw =
        p?.createdAt ||
        p?.created_at ||
        p?.paidAt ||
        p?.paid_at ||
        p?.date ||
        p?.updatedAt ||
        p?.updated_at ||
        "";
      const t = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    try {
      setRecentPaymentsLoading(true);
      setRecentPaymentsError("");

      const oq = `orgUuid=${encodeURIComponent(orgUuid)}&status=success&limit=6`;

      // âœ… Ã¶nce â€œen doÄŸruâ€ endpoint; sonra fallback
      const oq2 = `orgUuid=${encodeURIComponent(orgUuid)}&limit=6`; // status'u client-side zaten filtreliyorsun

const candidates = [
  `/api/billing/transactions/recent?${oq2}`,   // âœ… asÄ±l beklenen
  `/api/billing/transactions?${oq2}`,
  `/api/billing/payments/recent?${oq2}`,
  `/api/billing/recent-payments?${oq2}`,
];

      let list = null;
      for (const u of candidates) {
        list = await tryFetch(u);
        if (list) break;
      }

      if (!alive) return;

      if (!list) {
        setRecentPayments([]);
        setRecentPaymentsError("");
        return;
      }

      // âœ… Client-side: sadece baÅŸarÄ±lÄ± + en yeni 6
      const normalized = list
        .filter(isSuccess)
        .sort((a, b) => getDateMs(b) - getDateMs(a))
        .slice(0, 6);

      setRecentPayments(normalized);
    } catch (e) {
      if (!alive) return;
      setRecentPayments([]);
      setRecentPaymentsError(e?.message || "");
    } finally {
      if (!alive) return;
      setRecentPaymentsLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [orgUuid]);


  // âœ… SADECE kullanÄ±cÄ± period deÄŸiÅŸtirdiyse endDate gÃ¼ncelle
  useEffect(() => {
    if (!hydrated) return;

    const prev = prevRef.current;
    const periodChanged = prev.period !== state.period;

    if (periodChanged) {
      setState((s) => {
        if (s.endAtISO) {
          return { ...s, endDate: toDateOnly(s.endAtISO) || s.endDate };
        }

        return {
          ...s,
          endAtISO: "",
          endDate: s.period === "YÄ±llÄ±k" ? addDaysISO(s.startDate, 365) : addDaysISO(s.startDate, 30),
        };
      });
    }

    prevRef.current = { period: state.period, startDate: state.startDate };
  }, [state.period, hydrated]); // eslint-disable-line

  const currentPlan = useMemo(() => {
    if (!state.currentPlanId) return null;
    const normalized = state.currentPlanId.replaceAll("_", "-");
    return plans.find((p) => p.id === normalized) || null;
  }, [plans, state.currentPlanId]);


const selectedBillingPlan = useMemo(() => {
  if (state.upgrade?.show && state.upgrade?.targetPlanId) {
    return plans.find((p) => p.id === state.upgrade.targetPlanId) || currentPlan;
  }

  if (state.upgradeFlow?.active && state.upgradeFlow?.targetPlanId) {
    return plans.find((p) => p.id === state.upgradeFlow.targetPlanId) || currentPlan;
  }

  return currentPlan;
}, [
  plans,
  currentPlan,
  state.upgrade?.show,
  state.upgrade?.targetPlanId,
  state.upgradeFlow?.active,
  state.upgradeFlow?.targetPlanId,
]);

  // âœ… geri sayÄ±m (canlÄ±) â€” saat/dk/sn korunur
const countdown = useMemo(() => {
  let endVal = state.endAtISO;

  // âœ… Pilot kullanÄ±cÄ±: backend bitiÅŸi aynen kullan
  if (isPilot && endVal) {
    return getCountdown(endVal);
  }

  // âœ… Ã¶deme alÄ±nmamÄ±ÅŸsa fallback sayaÃ§ Ã¼retme
  if (!endVal) {
    return { days: 0, hms: "00:00:00" };
  }

  return getCountdown(endVal);
}, [isPilot, state.endAtISO, tick]);

  const daysLeft = countdown.days;

// âœ… Soru 2: Yenileme sadece son 3 gÃ¼n kala
const RENEW_WINDOW_DAYS = 3;

// Abonelikte aktif dÃ¶nem (backend'den geliyor): state.activePeriod
const isSamePeriod =
  (state.period === "AylÄ±k" && state.activePeriod === "AylÄ±k") ||
  (state.period === "YÄ±llÄ±k" && state.activePeriod === "YÄ±llÄ±k");
   // âœ… DÃ¶nem deÄŸiÅŸimi (UI render scope'unda lazÄ±m)
const isPeriodSwitch = state.period !== state.activePeriod;
// Yenileme butonu yalnÄ±z son 3 gÃ¼n kala aktif
const canRenewNow = Number(daysLeft || 0) <= RENEW_WINDOW_DAYS;


// âœ… Period kilidi (AylÄ±k/YÄ±llÄ±k seÃ§imini kilitle)
const periodLocked = isSamePeriod && !state.upgradeFlow?.active && !canRenewNow;

  const exVatPrice = useMemo(() => {
    if (!currentPlan) return 0;

    const isUpgrade = Boolean(state.upgradeFlow?.active);
    const isPeriodSwitchLocal = state.period !== state.activePeriod;
    const isRenewFlow = Boolean(state.renewFlow?.active);

    // âœ… Pilotta mevcut paket uygunsa normal paket mantÄ±ÄŸÄ± Ã§alÄ±ÅŸsÄ±n
    // SÃ¶zleÅŸme onaylanÄ±p Devam Et sonrasÄ± aylÄ±k/yÄ±llÄ±k fiyatlar gÃ¶rÃ¼nsÃ¼n.
    if (isSamePeriod && !isUpgrade && !isPeriodSwitchLocal) {
      // son 3 gÃ¼n deÄŸilse Ã¶deme butonu kapalÄ± kalÄ±r ama fiyat gÃ¶rÃ¼nÃ¼r
      if (!isRenewFlow) return 0;
      return state.period === "YÄ±llÄ±k" ? currentPlan.yearlyExVat : currentPlan.monthlyExVat;
    }


    return state.period === "YÄ±llÄ±k" ? currentPlan.yearlyExVat : currentPlan.monthlyExVat;
  }, [
    currentPlan,
    state.period,
    state.activePeriod,
    state.upgradeFlow,
    state.renewFlow,
    daysLeft,
    isSamePeriod,
  ]);
  const vatAmount = useMemo(() => Math.round(exVatPrice * VAT_RATE), [exVatPrice]);
  const incVatPrice = useMemo(() => exVatPrice + vatAmount, [exVatPrice, vatAmount]);

  const firmName = ticariKurumsal?.firmaAdi || "â€”";
  const firmPhone = ticariKurumsal?.telefon || "";
  const firmMail = ticariKurumsal?.email || "";

  const ownerName = toTRUpper(userInfo?.name || userInfo?.adSoyad || "") || "â€”";
  const ownerEmail = userInfo?.email || "";

 const openOfferModal = () => {
  setOfferError("");

  const safeCompanyName =
    (
      ticariKurumsal?.firmaAdi ||
      ticariKurumsal?.unvan ||
      ticariKurumsal?.title ||
      ticariKurumsal?.companyName ||
      ""
    ).trim();

  const personalInfo = (() => {
  try {
    return (
      JSON.parse(localStorage.getItem("kisiselBilgiler") || "null") ||
      JSON.parse(localStorage.getItem("personalInfo") || "null") ||
      {}
    );
  } catch {
    return {};
  }
})();

const rawFullName =
  (
    userInfo?.name ||
    userInfo?.adSoyad ||
    userInfo?.fullName ||
    userInfo?.fullname ||
    userInfo?.firstName ||
    userInfo?.lastName
      ? `${userInfo?.firstName || ""} ${userInfo?.lastName || ""}`.trim()
      : "" ||
    personalInfo?.adSoyad ||
    personalInfo?.name ||
    personalInfo?.fullName ||
    ""
  ).trim();

  const looksLikeCompany =
    /osgb|ltd|limited|anonim|a\.ÅŸ|aÅŸ|ÅŸirket|holding|sanayi|ticaret/i.test(rawFullName);

  const safeFullName = looksLikeCompany ? "" : rawFullName;

  setOfferForm({
    companyName: safeCompanyName,
    fullName: safeFullName,
    email: ownerEmail || userInfo?.email || "",
    usersCount: "",
    message: "",
  });

  setShowOfferModal(true);
};

  const closeOfferModal = () => {
    setShowOfferModal(false);
    setOfferError("");
    setOfferSending(false);
  };

  const submitOfferRequest = async () => {
    try {
      setOfferError("");

      const users = Number(digitsOnly(offerForm.usersCount, 6) || 0);
      if (!users || users < 10) {
        setOfferError("KullanÄ±cÄ± sayÄ±sÄ± 10 ve Ã¼zeri olmalÄ±.");
        return;
      }

      setOfferSending(true);

      await apiFetch("/api/support/teklif-al", {
        method: "POST",
        body: JSON.stringify({
          companyName: offerForm.companyName,
          name: offerForm.fullName,
          email: offerForm.email,
          users: users,
          message: offerForm.message,
          source: "panel",
        }),
      });

      alert("Talebiniz alÄ±nmÄ±ÅŸtÄ±r. En kÄ±sa sÃ¼rede tarafÄ±nÄ±za geri dÃ¶nÃ¼ÅŸ saÄŸlanacaktÄ±r. âœ…");
      closeOfferModal();
    } catch (e) {
      setOfferError(e.message || "Teklif talebi gÃ¶nderilemedi");
    } finally {
      setOfferSending(false);
    }
  };

  const isOfferVatIncluded = (offer) => {
    if (!offer) return false;

    if (typeof offer.kdv_included === "boolean") return offer.kdv_included;
    if (typeof offer.vat_included === "boolean") return offer.vat_included;

    const note = String(offer.note || "").toLocaleLowerCase("tr-TR");
    if (note.includes("kdv") && note.includes("dahil")) return true;
    if (note.includes("kdv") && (note.includes("dahildir") || note.includes("dÃ¢hildir"))) return true;

    return false;
  };



  // âœ… KullanÄ±cÄ± mevcut sabit paketin iÃ§indeyse teklif kartÄ± gÃ¶rÃ¼nmesin
  const fitsCurrentFixedPlan = useMemo(() => {
    const users = Number(state.usersCount || 0);
    const current = String(state.currentPlanId || "");

    if (current === "ticari-5") return users >= 1 && users <= 5;
if (current === "ticari-10") return users >= 6 && users <= 10;
if (current === "ticari-15") return users >= 11 && users <= 15;

    return false;
  }, [state.usersCount, state.currentPlanId]);

  // âœ… Sabit pakette ve kullanÄ±cÄ± sayÄ±sÄ± 10'u geÃ§miyorsa teklif bilgisi gÃ¶sterme
  const shouldHideOfferInfo = useMemo(() => {
    const current = String(state.currentPlanId || "");
    const isFixedPlan = ["ticari-5", "ticari-10", "ticari-15"].includes(current);
    return isFixedPlan && fitsCurrentFixedPlan && Number(state.usersCount || 0) <= 10;
  }, [state.currentPlanId, state.usersCount, fitsCurrentFixedPlan]);

  // âœ… Teklif istenebilir mi?
  const offerPriceTRY = useMemo(() => {
  return Number(
    offerData?.price_try ||
      offerData?.priceTRY ||
      offerData?.amountTRY ||
      offerData?.amount ||
      0
  );
}, [offerData]);

const offerUsersCount = useMemo(() => {
  return Number(offerData?.users_count || offerData?.usersCount || 0);
}, [offerData]);

const offerStatus = useMemo(() => {
  return String(offerData?.status || "").toLowerCase().trim();
}, [offerData]);

const hasValidPanelOffer = useMemo(() => {
  if (!offerData) return false;

  // âœ… sadece kullanÄ±cÄ±ya gÃ¶sterilecek bekleyen teklifler
  const allowedStatuses = ["sent", "opened", "registered"];

  return (
    allowedStatuses.includes(offerStatus) &&
    offerPriceTRY > 0 &&
    offerUsersCount >= 10
  );
}, [offerData, offerStatus, offerPriceTRY, offerUsersCount]);
const offerStatusLower = useMemo(() => {
  return String(offerData?.status || "").toLowerCase().trim();
}, [offerData?.status]);

const offerAcceptedButUnpaid = useMemo(() => {
  return offerStatusLower === "registered" || offerAccepted;
}, [offerStatusLower, offerAccepted]);

const offerPaidOrActive = useMemo(() => {
  return ["paid", "active"].includes(offerStatusLower);
}, [offerStatusLower]);

const offerAlreadyAccepted = useMemo(() => {
  return offerAcceptedButUnpaid || offerPaidOrActive;
}, [offerAcceptedButUnpaid, offerPaidOrActive]);

const showOfferInfoCard = useMemo(() => {
  if (offerPaidOrActive) return false;

  if (hasValidPanelOffer) return true;

  if (shouldHideOfferInfo) return false;

  if (isPilot && Number(state.usersCount || 0) >= 10) {
    return hasValidPanelOffer;
  }

  return Boolean(
    offerLoading ||
      offerFetchError ||
      (offerAcceptedButUnpaid && offerData && offerPriceTRY > 0)
  );
}, [
  offerPaidOrActive,
  hasValidPanelOffer,
  shouldHideOfferInfo,
  isPilot,
  state.usersCount,
  offerLoading,
  offerFetchError,
  offerAcceptedButUnpaid,
  offerData,
  offerPriceTRY,
]);

const showPreAcceptOfferCard = useMemo(() => {
  // âœ… sadece henÃ¼z kabul edilmemiÅŸ tekliflerde gÃ¶ster
  return showOfferInfoCard && !offerAcceptedButUnpaid && !offerPaidOrActive;
}, [showOfferInfoCard, offerAcceptedButUnpaid, offerPaidOrActive]);

const canRequestOffer = useMemo(() => {
  // âœ… gerÃ§ek teklif varsa yeniden teklif al butonu Ã§Ä±kmasÄ±n
  if (hasValidPanelOffer) return false;

  if (isPilot && state.currentPlanId === "prof-ozel") {
    return !showOfferInfoCard;
  }

  return !shouldHideOfferInfo;
}, [
  hasValidPanelOffer,
  isPilot,
  state.currentPlanId,
  showOfferInfoCard,
  shouldHideOfferInfo,
]);

 const acceptOfferAndContinue = async () => {
  if (!offerData) return;

  const offerUsers = Number(offerData.users_count || 0) || state.usersCount || 1;
  const offerPrice = Number(
    offerData.price_try ||
      offerData.priceTRY ||
      offerData.amountTRY ||
      offerData.amount ||
      0
  );

  if (offerPrice <= 0) {
    alert("Teklif tutarÄ± bulunamadÄ±.");
    return;
  }

  try {
    const offerId = offerData?.id || offerData?.offer_id;
    if (!offerId) {
      alert("Teklif ID bulunamadÄ±.");
      return;
    }

    await apiFetch("/api/offers/accept", {
      method: "POST",
      body: JSON.stringify({
        offerId,
        orgUuid,
      }),
    });

    setOfferData((o) => (o ? { ...o, status: "registered" } : o));
  } catch (e) {
    alert(e.message || "Teklif kabul edilemedi");
    return;
  }

  setOfferAccepted(true);
  setCanPay(false);
  setRenewChecks({ kvkk: false, terms: false, sales: false });

  setState((s) => ({
    ...s,

    // âœ… reddette geri dÃ¶nebilmek iÃ§in mevcut paketi sakla
    preOfferPlanId: s.currentPlanId,
    preOfferUsersCount: s.usersCount,
    preOfferPeriod: s.activePeriod || s.period,

    currentPlanId: "prof-ozel",
    usersCount: offerUsers,
    amountTRY: offerPrice,
    renewFlow: { active: false },
    upgradeFlow: { active: false, mode: null, targetPlanId: null },
    addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
  }));
};

// âœ… Teklif reddet
const rejectOfferAndStayCurrent = async () => {
  if (!offerData) return;

  try {
    const offerId = offerData?.id || offerData?.offer_id;

    await apiFetch("/api/offers/reject", {
      method: "POST",
      body: JSON.stringify({
        offerId,
        orgUuid,
      }),
    });

    setOfferData((o) => (o ? { ...o, status: "canceled" } : o));

    setOfferAccepted(false);
    setCanPay(false);
    setRenewChecks({ kvkk: false, terms: false, sales: false });

    setState((s) => ({
      ...s,
      currentPlanId: s.preOfferPlanId || s.currentPlanId,
      usersCount: Number(s.preOfferUsersCount || s.usersCount || 1),
      period: s.preOfferPeriod || s.period,
      activePeriod: s.preOfferPeriod || s.activePeriod,
      amountTRY: 0,
      renewFlow: { active: false },
      upgradeFlow: { active: false, mode: null, targetPlanId: null },
      addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
    }));

    await fetchSubscriptionData();
    await fetchOfferData();
  } catch (e) {
    alert(e.message || "Teklif reddedilemedi");
  }
};

  const upgradeChecksOk = offerChecks.kvkk && offerChecks.terms && offerChecks.sales;

  const continueUpgradeFlow = () => {
    if (!(offerChecks.kvkk && offerChecks.terms && offerChecks.sales)) {
      alert("Devam etmek iÃ§in sÃ¶zleÅŸmeleri onaylayÄ±nÄ±z.");
      return;
    }

    const targetId = state.upgrade?.targetPlanId;
    if (!targetId) {
      alert("SeÃ§ilen paket bulunamadÄ±.");
      return;
    }

    const mode =
  state.currentPlanId && state.activePeriod
    ? "UPGRADE"
    : "NEW";

const carryOverDays =
  state.activePeriod
    ? Number(daysLeft || 0)
    : 0;


    setState((s) => ({
      ...s,
      upgradeFlow: {
        active: true,
        mode,
        targetPlanId: targetId,
      },
    }));
  };

    const continueRenewFlow = () => {
    if (!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)) {
      alert("Devam etmek iÃ§in sÃ¶zleÅŸmeleri onaylayÄ±nÄ±z.");
      return;
    }

    setState((s) => ({
      ...s,
      renewFlow: { active: true },
    }));

    // âœ… Pilot dahil tÃ¼m akÄ±ÅŸlarda sÃ¶zleÅŸme sonrasÄ± fiyat ekranÄ± aÃ§Ä±lsÄ±n
    setCanPay(true);
  };

  const startAddUsersFlow = () => {
    const c = Math.max(1, Number(state.addUsersCount || 1));

    setState((s) => ({
      ...s,
      addUsersFlow: { active: true, ready: false, addUsersCount: c },
    }));

    setAddUsersChecks({ kvkk: false, terms: false, sales: false });
  };

  const continueAddUsersFlow = () => {
  if (!(addUsersChecks.kvkk && addUsersChecks.terms && addUsersChecks.sales)) {
    alert("Devam etmek iÃ§in sÃ¶zleÅŸmeleri onaylayÄ±nÄ±z.");
    return;
  }

  setState((s) => ({
    ...s,
    addUsersFlow: {
      ...s.addUsersFlow,
      active: true,
      ready: true,
      addUsersCount: Math.max(1, Number(s.addUsersFlow?.addUsersCount || s.addUsersCount || 1)),
    },
  }));

  setCanPay(true);
};

  // Paket yÃ¼kseltme
  const changePlan = (planId) => {
    if (planId === "kurumsal_10_plus") {
      openOfferModal();
      return;
    }
    if (planId === state.currentPlanId) return;

    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

const diff = calculateUpgradeDiff({
  currentPlan,
  targetPlan,
  period: state.period,
  activePeriod: state.activePeriod,
  daysLeft,
  vatRate: VAT_RATE,
});

    if (!diff) {
      alert("Bu paket iÃ§in yÃ¼kseltme hesaplanamadÄ±.");
      return;
    }

    setOfferChecks({ kvkk: false, terms: false, sales: false });

    setState((s) => ({
      ...s,
      upgrade: {
        targetPlanId: planId,
        daysLeft,
        diffAmountExVat: diff.diffAmountExVat,
        diffVat: diff.diffVat,
        diffTotal: diff.diffTotal,
        show: true,
      },
      upgradeFlow: { active: false, mode: null, targetPlanId: null },
      renewFlow: { active: false },
    }));
    setCanPay(false);
  };

  useEffect(() => {
    if (!state.upgrade?.show || !state.upgrade?.targetPlanId) return;

    const targetPlan = plans.find((p) => p.id === state.upgrade.targetPlanId);
    if (!targetPlan) return;

const diff = calculateUpgradeDiff({
  currentPlan,
  targetPlan,
  period: state.period,
  activePeriod: state.activePeriod,
  daysLeft,
  vatRate: VAT_RATE,
});


    if (!diff) return;

    setState((s) => ({
      ...s,
      upgrade: {
        ...s.upgrade,
        diffAmountExVat: diff.diffAmountExVat,
        diffVat: diff.diffVat,
        diffTotal: diff.diffTotal,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.period]);

  // âœ… GerÃ§ek iyzico init + modal aÃ§ (popup)
  const iyzicoOde = async ({ type = "NEW", amount, addUsersCount, carryOverDays = 0, isRenewal = false } = {}) => {
    try {
      setIyzicoError("");
      setIyzicoLoading(true);

      if (!orgUuid) {
        throw new Error("Organizasyon bulunamadÄ±. LÃ¼tfen sayfayÄ± yenileyip tekrar deneyin.");
      }

    const payload = {
  currentPlanId: state.currentPlanId,
  usersCount: state.usersCount,
  period: state.period,
  type,
  orgUuid: orgUuid || undefined,
  carryOverDays: Number(arguments?.[0]?.carryOverDays || 0),
  isRenewal: Boolean(arguments?.[0]?.isRenewal),

  // âœ… YÄ±llÄ±k geÃ§iÅŸ + paket deÄŸiÅŸimi (upgradeFlow NEW) iÃ§in hedef paket mutlaka gitmeli
  ...(state.upgradeFlow?.active && state.upgradeFlow?.targetPlanId
    ? { targetPlanId: state.upgradeFlow.targetPlanId }
    : {}),
};

if (type === "OFFER") {
  // âœ… Ã–zel teklif mahsuplaÅŸmasÄ±:
  // Teklif tam dÃ¶nem fiyatÄ±dÄ±r.
  // Mevcut paketin kalan kullanÄ±lmamÄ±ÅŸ deÄŸeri teklif tutarÄ±ndan dÃ¼ÅŸÃ¼lÃ¼r.

  const offerFullAmount = Number(amount || selectedOfferPrice || state.amountTRY || 0);

  const safeDaysLeft = Math.max(0, Number(daysLeft || 0));

  const currentBaseDays =
    state.activePeriod === "YÄ±llÄ±k" ? 365 : 30;

  const currentExVat =
    state.activePeriod === "YÄ±llÄ±k"
      ? Number(currentPlan?.yearlyExVat || 0)
      : Number(currentPlan?.monthlyExVat || 0);

  const currentIncVat =
    Math.round(currentExVat + currentExVat * VAT_RATE);

  const currentCredit =
    currentBaseDays > 0
      ? Math.round(currentIncVat * (safeDaysLeft / currentBaseDays))
      : 0;

  const proratedOfferAmount = Math.max(
    0,
    Math.round(offerFullAmount - currentCredit)
  );

  payload.amount = proratedOfferAmount;
  payload.offerFullAmount = offerFullAmount;
  payload.offerCurrentCredit = currentCredit;
  payload.offerProrated = true;
  payload.carryOverDays = safeDaysLeft;

  const offerId = offerData?.id || offerData?.offer_id;
  const offerToken = offerData?.token;

  if (offerId) payload.offerId = offerId;
  if (offerToken) payload.offerToken = offerToken;
}

      const addC = Number(addUsersCount || 0);
      if (addC > 0) {
        payload.addUsersCount = addC;
        payload.addUsersMode = "WITH_PLAN";
      }

      if (type === "ADD_USERS") {
  payload.amount = Number(amount || 0);
  payload.addUsersCount = Number(addUsersCount || state.addUsersCount || 1);

  // âœ… mevcut abonelik sÃ¼resi bozulmadan devam etsin
  payload.keepExistingEndAt = true;
  payload.currentEndAtISO = state.endAtISO || "";
  payload.currentStartAtISO = state.startAtISO || "";
  payload.activePeriod = state.activePeriod;
}


if (type === "UPGRADE" && state.upgrade?.targetPlanId) {
  payload.targetPlanId = state.upgrade.targetPlanId;
}

// âœ… GENEL FIX: NEW (Ã¶zellikle YÄ±llÄ±k geÃ§iÅŸ / paket deÄŸiÅŸimi) iÃ§in de amount gÃ¶nder.
// Backend zaten amount'u "max paket Ã¼creti" ile kÄ±sÄ±tlÄ±yor (billing.js).
if (payload.amount == null) {
  const a = Number(amount || 0);
  if (Number.isFinite(a) && a > 0) {
    payload.amount = Math.round(a); // KDV DAHÄ°L (summaryTotal)
  }
}

const finalAmount =
  state.currentPlanId === "prof-ozel" && Number(state.amountTRY || 0) > 0
    ? state.period === "YÄ±llÄ±k"
      ? Math.round(Number(state.amountTRY) * 10)
      : Math.round(Number(state.amountTRY))
    : Math.round(payload.amount || payload.amountTRY || incVatPrice || 0);

const params = new URLSearchParams({
  plan: payload.targetPlanId || payload.planCode || payload.planId || state.currentPlanId,
  period: state.period,
  org: orgUuid || "",
  agreements: "1",
  type: payload.type || "NEW",
  users: String(state.usersCount || 1),
  amount: String(Math.round(payload.amount || payload.amountTRY || incVatPrice || 0)),
  carryOverDays: String(Number(payload.carryOverDays || 0)),
  isRenewal: payload.isRenewal ? "1" : "0",
});
window.location.href = `/odeme?${params.toString()}`;
return;
    } catch (e) {
      setIyzicoError(e.message || "iyzico baÅŸlatÄ±lamadÄ±");
      setShowIyzicoModal(true);
    } finally {
      setIyzicoLoading(false);
    }
  };

  /** =========================
   *  UI helpers
   *  ========================= */
  const emphasizedPrice = (exPrice) => {
    const ex = Number(exPrice || 0);
    const inc = ex + Math.round(ex * VAT_RATE);
    return state.showVatIncluded ? trCurrency(inc) : trCurrency(ex);
  };

  const badge = useMemo(() => {
    if (state.currentPlanId === "prof-ozel")
      return { text: "Ã–zel", cls: "bg-purple-100 text-purple-800 border-purple-200" };
    if (state.period === "YÄ±llÄ±k")
      return { text: "Kampanya", cls: "bg-green-100 text-green-800 border-green-200" };
    return { text: "Aktif", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  }, [state.currentPlanId, state.period]);

 const isProfOzelActive = useMemo(() => {
  return state.currentPlanId === "prof-ozel" && Number(state.amountTRY || 0) > 0;
}, [state.currentPlanId, state.amountTRY]);

const offerAdminNote = useMemo(() => {
  return String(
    offerData?.note ||
      offerData?.admin_note ||
      offerData?.adminNote ||
      ""
  ).trim();
}, [offerData]);

const selectedOfferPrice = useMemo(() => {
  const monthlyIncVat = Number(state.amountTRY || 0);
  if (monthlyIncVat <= 0) return 0;

  if (state.period === "YÄ±llÄ±k") {
    return Math.round(monthlyIncVat * 10);
  }

  return monthlyIncVat;
}, [state.amountTRY, state.period]);

const selectedOfferExVat = useMemo(() => {
  return Math.round(Number(selectedOfferPrice || 0) / (1 + VAT_RATE));
}, [selectedOfferPrice, VAT_RATE]);

const selectedOfferVat = useMemo(() => {
  return Number(selectedOfferPrice || 0) - Number(selectedOfferExVat || 0);
}, [selectedOfferPrice, selectedOfferExVat]);

  // âœ… Tekliften kiÅŸi baÅŸÄ± baz tutar (TRY) Ã§ek
  const getOfferPerUserBaseTRY = (offer, fallbackUsersCount) => {
  // âœ… Ã¶nce teklif Ã¼zerindeki gerÃ§ek kullanÄ±cÄ± sayÄ±sÄ±nÄ± baz al
  const offerUsers = Math.max(
    1,
    Number(
      offer?.users_count ||
      offer?.usersCount ||
      fallbackUsersCount ||
      1
    )
  );

  // âœ… backend kiÅŸi baÅŸÄ± fiyat verdiyse direkt onu kullan
  const perUserDirect = Number(
    offer?.per_user_price_try ||
    offer?.perUserPriceTRY ||
    offer?.per_user_try ||
    offer?.perUserTRY ||
    0
  );

  if (perUserDirect > 0) return perUserDirect;

  // âœ… toplam teklif tutarÄ± / teklif kullanÄ±cÄ± sayÄ±sÄ±
  const totalOfferPrice = Number(
    offer?.price_try ||
    offer?.priceTRY ||
    offer?.amountTRY ||
    offer?.amount ||
    0
  );

  if (totalOfferPrice > 0 && offerUsers > 0) {
    return totalOfferPrice / offerUsers;
  }

  return 0;
};

  const planTitle = useMemo(() => currentPlan?.name || "Paket Bilgisi Yok", [currentPlan]);

  const planMeta = useMemo(() => {
    const addNow =
      state.currentPlanId === "prof-ozel" && state.addUsersFlow?.active
        ? Number(state.addUsersFlow.addUsersCount || 0)
        : 0;

    const usersText =
      state.currentPlanId === "prof-ozel"
        ? addNow > 0
          ? `${state.usersCount} + ${addNow} kullanÄ±cÄ±`
          : `${state.usersCount} kullanÄ±cÄ± (teklifli)`
        : currentPlan?.users || `${state.usersCount} kullanÄ±cÄ±`;

    const periodText = state.period === "YÄ±llÄ±k" ? "YÄ±llÄ±k" : "AylÄ±k";
    return `${usersText} â€¢ ${periodText}`;
  }, [state.currentPlanId, state.usersCount, state.addUsersFlow?.active, state.addUsersFlow?.addUsersCount, currentPlan, state.period]);

  // âœ… Ã–DEME Ã–ZETÄ° HESABI (upgradeFlow)
  const upgradeTargetPlan = useMemo(() => {
    const id = state.upgradeFlow?.targetPlanId;
    return id ? plans.find((p) => p.id === id) : null;
  }, [state.upgradeFlow?.targetPlanId, plans]);

const payExVat = useMemo(() => {
  // âœ… Normal Ã¶deme / yenileme
  if (!state.upgradeFlow?.active) {
    return Math.round(Number(exVatPrice || 0));
  }

  const targetPlan = upgradeTargetPlan || selectedBillingPlan;
  if (!targetPlan) return 0;

  const targetPrice =
    state.period === "YÄ±llÄ±k"
      ? Number(targetPlan.yearlyExVat || 0)
      : Number(targetPlan.monthlyExVat || 0);

  const currentPrice =
    state.activePeriod === "YÄ±llÄ±k"
      ? Number(currentPlan?.yearlyExVat || 0)
      : Number(currentPlan?.monthlyExVat || 0);

  const currentBaseDays = state.activePeriod === "YÄ±llÄ±k" ? 365 : 30;
  const targetBaseDays = state.period === "YÄ±llÄ±k" ? 365 : 30;
  const safeDaysLeft = Math.max(0, Number(daysLeft || 0));

  // âœ… AynÄ± dÃ¶nem paket yÃ¼kseltme
  if (state.period === state.activePeriod) {
    const dailyTarget = targetPrice / targetBaseDays;
    const dailyCurrent = currentPrice / currentBaseDays;

    return Math.max(
      0,
      Math.round((dailyTarget - dailyCurrent) * safeDaysLeft)
    );
  }

  // âœ… AylÄ±k â†’ YÄ±llÄ±k / yÄ±llÄ±k dÃ¶nem deÄŸiÅŸimi
  const currentCredit =
    currentBaseDays > 0
      ? currentPrice * (safeDaysLeft / currentBaseDays)
      : 0;

  return Math.max(0, Math.round(targetPrice - currentCredit));
}, [
  state.upgradeFlow?.active,
  state.period,
  state.activePeriod,
  exVatPrice,
  upgradeTargetPlan,
  selectedBillingPlan,
  currentPlan,
  daysLeft,
]);

const payVat = useMemo(() => {
  return Math.round(Number(payExVat || 0) * VAT_RATE);
}, [payExVat, VAT_RATE]);

const payTotal = useMemo(() => {
  return Math.round(Number(payExVat || 0) + Number(payVat || 0));
}, [payExVat, payVat]);

const shouldUseProratedPay =
  state.period === "YÄ±llÄ±k" &&
  state.activePeriod === "AylÄ±k" &&
  Number(daysLeft || 0) > 0;

const summaryExVat =
  state.upgradeFlow?.active || shouldUseProratedPay ? payExVat : exVatPrice;

const summaryVat =
  state.upgradeFlow?.active || shouldUseProratedPay ? payVat : vatAmount;

const summaryTotal =
  state.upgradeFlow?.active || shouldUseProratedPay ? payTotal : incVatPrice;
  // âœ… Ek kullanÄ±cÄ± Ã¼creti (ready olunca hesap)
const addUsersPay = useMemo(() => {
  if (state.currentPlanId !== "prof-ozel") return null;
  if (!state.addUsersFlow?.ready) return null;

  const addCount = Math.max(1, Number(state.addUsersFlow?.addUsersCount || 0));
  if (addCount <= 0) return null;

  const totalDays = state.period === "YÄ±llÄ±k" ? 365 : 30;
  const safeDaysLeft = Math.max(0, Number(daysLeft || 0));
  const ratio = totalDays > 0 ? safeDaysLeft / totalDays : 0;

  // âœ… kiÅŸi baÅŸÄ± teklif = teklif toplamÄ± / teklif kullanÄ±cÄ± sayÄ±sÄ±
  const perUserBaseTRY = getOfferPerUserBaseTRY(
    offerData,
    Number(offerData?.users_count || offerData?.usersCount || state.usersCount || 1)
  );

  if (perUserBaseTRY <= 0) return null;

  const vatIncluded = isOfferVatIncluded(offerData);

  // âœ… kiÅŸi baÅŸÄ± KDV hariÃ§ baz
  const perUserExVat = vatIncluded
    ? perUserBaseTRY / (1 + VAT_RATE)
    : perUserBaseTRY;

  // âœ… sadece eklenecek kullanÄ±cÄ± sayÄ±sÄ± kadar hesapla
  const periodMultiplier = state.period === "YÄ±llÄ±k" ? 10 : 1;
const ex = Math.round(perUserExVat * periodMultiplier * addCount * ratio);
  const vat = Math.round(ex * VAT_RATE);
  const total = ex + vat;

  return {
    addCount,
    ratio,
    safeDaysLeft,
    perUserBaseTRY,
    perUserExVat,
    ex,
    vat,
    total,
  };
}, [state.currentPlanId, state.addUsersFlow, state.activePeriod, daysLeft, offerData, state.usersCount, VAT_RATE]);


return (
    <div className="max-w-5xl mx-auto mt-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#0a2b45] to-[#0f4c81] text-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">ğŸ’³ Ticari Abonelik & Ã–demeler</h2>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.cls}`}>
                  {badge.text}
                </span>
              </div>
              <p className="text-white/80 text-sm mt-1">
                Abonelik iÅŸlemleriniz gÃ¼venli Ã¶deme altyapÄ±sÄ± Ã¼zerinden yÃ¼rÃ¼tÃ¼lÃ¼r. Kart bilgileri sistemde saklanmaz.
              </p>
            </div>

            <div className="md:text-right">
              <div className="text-white/70 text-xs">Kalan SÃ¼re</div>
              <div className="text-2xl font-extrabold leading-tight">
  {state.endAtISO ? `${daysLeft} gÃ¼n` : "â€”"}
</div>
<div className="text-white/80 text-xs mt-1">
  BitiÅŸ: <span className="font-semibold">{state.endAtISO ? toDateOnly(state.endDate) : "â€”"}</span>
  {state.endAtISO ? (
    <span className="ml-2 text-[11px] text-white/70 tabular-nums">{countdown.hms}</span>
  ) : null}
</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-3">
              <div className="text-[11px] text-white/70">Paket</div>
              <div className="font-semibold">{planTitle}</div>
              <div className="text-xs text-white/70">{planMeta}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-3">
              <div className="text-[11px] text-white/70">BaÅŸlangÄ±Ã§</div>
              <div className="font-semibold">{state.startDate}</div>
              <div className="text-xs text-white/70">
  {state.endAtISO ? "Abonelik aktif" : "Ã–deme bekleniyor"}
</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-3">
              <div className="text-[11px] text-white/70">Firma</div>
              <div className="font-semibold">{firmName}</div>
              <div className="text-xs text-white/70">{[firmPhone, firmMail].filter(Boolean).join(" â€¢ ") || "â€”"}</div>
            </div>
          </div>
        </div>


        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Owner cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-gray-500">Abonelik Sahibi</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">{ownerName}</div>
              <div className="text-xs text-gray-600">{ownerEmail || "â€”"}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-gray-500">Firma</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">{firmName}</div>
              <div className="text-xs text-gray-600">{[firmPhone, firmMail].filter(Boolean).join(" â€¢ ") || "â€”"}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-gray-500">Yenileme</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">
                {state.autoRenew ? "Otomatik Yenileme AÃ§Ä±k" : "Otomatik Yenileme KapalÄ±"}
              </div>
              <div className="text-xs text-gray-600 mt-1">BitiÅŸ: {state.endDate}</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Plan card */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500">Paket</div>
                  <div className="text-lg font-bold text-[#0a2b45] mt-1">{planTitle}</div>
                  <div className="text-sm text-gray-600 mt-1 italic">{currentPlan?.note || ""}</div>
                  <div className="text-sm text-gray-700 mt-2">
                    {state.currentPlanId === "prof-ozel" ? (
                      state.addUsersFlow?.active && Number(state.addUsersFlow.addUsersCount || 0) > 0 ? (
                        <span>
                          {state.usersCount} + {Number(state.addUsersFlow.addUsersCount || 0)} kullanÄ±cÄ±
                        </span>
                      ) : (
                        <span>{state.usersCount} kullanÄ±cÄ± (teklifli)</span>
                      )
                    ) : (
                      <span>{currentPlan?.users || ""}</span>
                    )}
                  </div>
                </div>

                {state.period === "YÄ±llÄ±k" && (
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                    ğŸ 2 ay bizden
                  </div>
                )}
              </div>

                                        {/* Kurumsal Teklif */}
              {showPreAcceptOfferCard && hasValidPanelOffer && (
                <div className="rounded-2xl border bg-white p-5 mt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Kurumsal Teklif</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">Teklif Bilgisi</div>
                      <div className="text-xs text-gray-500 mt-1">Kurumunuza tanÄ±mlÄ± en gÃ¼ncel teklif</div>
                    </div>

                    {offerData &&
                      (() => {
                        const st = String(offerData?.status || "").toLowerCase();
                        const isAccepted = ["registered", "paid", "active"].includes(st) || offerAccepted;
                        const isExpired = ["expired", "canceled"].includes(st);

                        if (isExpired) {
                          return (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200">
                              SÃ¼resi Doldu / Ä°ptal
                            </span>
                          );
                        }

                        if (isAccepted) {
                          return (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200 inline-flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[12px] leading-none">
                                âœ“
                              </span>
                              <span>Kabul Edildi</span>
                            </span>
                          );
                        }

                        return (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                            SÃ¼reÃ§te
                          </span>
                        );
                      })()}
                  </div>

                  <div className="mt-4">
                    {offerLoading ? (
                      <div className="text-sm text-gray-500">YÃ¼kleniyorâ€¦</div>
                    ) : offerFetchError ? (
                      <div className="text-sm text-red-600">{offerFetchError}</div>
                    ) : !offerData ? (
                      <div className="text-sm text-gray-600">Kurumsal teklif bulunamadÄ±.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs">Firma</div>
                          <div className="font-semibold">{offerData.company_name || "â€”"}</div>
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">KullanÄ±cÄ±</div>
                          <div className="font-semibold">{offerData.users_count || "â€”"}</div>
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">Teklif TutarÄ±</div>
                          <div className="font-semibold">
                            {offerData.price_try ? trCurrency(offerData.price_try) : "â€”"}
                          </div>

                          {(() => {
                            const st = String(offerData?.status || "").toLowerCase();
                            const isExpired = ["expired", "canceled"].includes(st);
                            const isAccepted = ["registered", "paid", "active"].includes(st) || offerAccepted;

                            return (
                              <div className="mt-4 space-y-3">



<div className="mt-4 flex flex-col sm:flex-row gap-2">
  <button
    type="button"
    onClick={acceptOfferAndContinue}
    className={`${BTN_GREEN} w-full sm:w-auto`}
    disabled={
      isAccepted ||
      isExpired ||
      Number(
        offerData?.price_try ||
          offerData?.priceTRY ||
          offerData?.amountTRY ||
          offerData?.amount ||
          0
      ) <= 0
    }
  >
    {isAccepted
      ? "Teklif Kabul Edildi"
      : Number(
          offerData?.price_try ||
            offerData?.priceTRY ||
            offerData?.amountTRY ||
            offerData?.amount ||
            0
        ) <= 0
      ? "Teklif TutarÄ± Eksik"
      : "Teklifi Kabul Et"}
  </button>

  {!isExpired && !offerPaidOrActive && (
    <button
      type="button"
      onClick={rejectOfferAndStayCurrent}
      className={`${BTN_OUTLINE} w-full sm:w-auto`}
    >
      Reddet
    </button>
  )}

  {isExpired && (
    <div className="text-xs text-red-600 self-center">
      Bu teklifin sÃ¼resi dolmuÅŸ/iptal edilmiÅŸ.
    </div>
  )}
</div>
                              </div>
                            );
                          })()}
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">SÃ¼re</div>
                          <div className="font-semibold">
                            {offerData.duration_days ? `${offerData.duration_days} gÃ¼n` : "â€”"}
                          </div>
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">Link GeÃ§erlilik</div>
                          <div className="font-semibold">
                            {offerData.link_expires_at
                              ? new Date(offerData.link_expires_at).toLocaleDateString("tr-TR")
                              : "â€”"}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <div className="text-gray-500 text-xs">Not</div>
                          <div className="text-gray-700">{offerData.note || "â€”"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* âœ… Paket YÃ¼kseltme Paneli */}
              {state.currentPlanId !== "prof-ozel" && state.upgrade?.show && (
                <div className="rounded-2xl border bg-white p-5 mb-5 mt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Paket YÃ¼kseltme</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">SeÃ§ilen Paket</div>
                      <div className="text-xs text-gray-500 mt-1">
  Paket yÃ¼kseltmede Ã¼cret, hedef paket fiyatÄ±na gÃ¶re hesaplanÄ±r. YÄ±llÄ±k pakete geÃ§iÅŸte mevcut paketin kalan sÃ¼resi mahsup edilir.
</div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                      SÃ¼reÃ§te
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Paket</div>
                      <div className="font-semibold">
                        {plans.find((p) => p.id === state.upgrade.targetPlanId)?.name || "â€”"}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs">Kalan GÃ¼n</div>
                      <div className="font-semibold">{daysLeft} gÃ¼n</div>
                    </div>
                  </div>

                  {/* SÃ¶zleÅŸme OnaylarÄ± */}
                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    {/* KVKK */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={offerChecks.kvkk}
                          onChange={(e) => setOfferChecks((c) => ({ ...c, kvkk: e.target.checked }))}
                        />
                        <div className="leading-snug">KVKK AydÄ±nlatma Metni</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("kvkk")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>

                    {/* TERMS */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={offerChecks.terms}
                          onChange={(e) => setOfferChecks((c) => ({ ...c, terms: e.target.checked }))}
                        />
                        <div className="leading-snug">KullanÄ±m KoÅŸullarÄ±</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("terms")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>

                    {/* SALES */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={offerChecks.sales}
                          onChange={(e) => setOfferChecks((c) => ({ ...c, sales: e.target.checked }))}
                        />
                        <div className="leading-snug">SatÄ±ÅŸ / Ã–deme SÃ¶zleÅŸmesi</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("sales")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        continueUpgradeFlow();
                        setCanPay(true);
                      }}
                      className={`${BTN_GREEN} w-full sm:w-auto`}
                      disabled={!upgradeChecksOk}
                    >
                      Devam Et
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          upgrade: { ...s.upgrade, show: false, targetPlanId: null },
                          upgradeFlow: { active: false, mode: null, targetPlanId: null },
                        }));
                        setOfferChecks({ kvkk: false, terms: false, sales: false });
                        setCanPay(false);
                      }}
                      className={`${BTN_OUTLINE} w-full sm:w-auto`}
                    >
                      VazgeÃ§
                    </button>
                  </div>
                </div>
              )}

              {/* âœ… Kurumsal Ek KullanÄ±cÄ± sÃ¶zleÅŸmeleri */}
              {state.currentPlanId === "prof-ozel" && state.addUsersFlow?.active && (
  <div className="mt-5 rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Kurumsal Ek KullanÄ±cÄ±</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">SÃ¶zleÅŸmeler</div>
                     <div className="text-xs text-gray-500 mt-1">
  Ek kullanÄ±cÄ± Ã¼creti, teklif fiyatÄ±na gÃ¶re kiÅŸi baÅŸÄ± ve kalan gÃ¼n oranlÄ± hesaplanÄ±r.
  Mevcut abonelik sÃ¼resi deÄŸiÅŸmez.
</div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                      SÃ¼reÃ§te
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    {/* KVKK */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={addUsersChecks.kvkk}
                          onChange={(e) => setAddUsersChecks((c) => ({ ...c, kvkk: e.target.checked }))}
                        />
                        <div className="leading-snug">KVKK AydÄ±nlatma Metni</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("kvkk")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>

                    {/* TERMS */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={addUsersChecks.terms}
                          onChange={(e) => setAddUsersChecks((c) => ({ ...c, terms: e.target.checked }))}
                        />
                        <div className="leading-snug">KullanÄ±m KoÅŸullarÄ±</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("terms")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>

                    {/* SALES */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={addUsersChecks.sales}
                          onChange={(e) => setAddUsersChecks((c) => ({ ...c, sales: e.target.checked }))}
                        />
                        <div className="leading-snug">SatÄ±ÅŸ / Ã–deme SÃ¶zleÅŸmesi</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("sales")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
                   <button
  type="button"
  onClick={continueAddUsersFlow}
  className={`${BTN_GREEN} w-full sm:w-auto`}
  disabled={!(addUsersChecks.kvkk && addUsersChecks.terms && addUsersChecks.sales)}
>
  Devam Et
</button>

                    <button
                      type="button"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
                        }));
                        setAddUsersChecks({ kvkk: false, terms: false, sales: false });
                        setCanPay(false);
                      }}
                      className={`${BTN_OUTLINE} w-full sm:w-auto`}
                    >
                      VazgeÃ§
                    </button>
                  </div>
                </div>
              )}

                           {/* âœ… Paket Yenileme (Pilotta mevcut paket uygunsa teklif yokmuÅŸ gibi davran) */}
              {state.currentPlanId !== "prof-ozel" &&
                !state.upgrade?.show &&
                !((offerData && !offerAlreadyAccepted) && !shouldHideOfferInfo) && (
                <div className="mt-5 rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Paket Yenileme</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">SÃ¶zleÅŸmeler</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Ã–demeye geÃ§mek iÃ§in sÃ¶zleÅŸmeleri onaylayÄ±p devam edin.
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                      SÃ¼reÃ§te
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    {/* KVKK */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={renewChecks.kvkk}
                          onChange={(e) => setRenewChecks((c) => ({ ...c, kvkk: e.target.checked }))}
                        />
                        <div className="leading-snug">KVKK AydÄ±nlatma Metni</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("kvkk")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>

                    {/* TERMS */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={renewChecks.terms}
                          onChange={(e) => setRenewChecks((c) => ({ ...c, terms: e.target.checked }))}
                        />
                        <div className="leading-snug">KullanÄ±m KoÅŸullarÄ±</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("terms")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>

                    {/* SALES */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={renewChecks.sales}
                          onChange={(e) => setRenewChecks((c) => ({ ...c, sales: e.target.checked }))}
                        />
                        <div className="leading-snug">SatÄ±ÅŸ / Ã–deme SÃ¶zleÅŸmesi</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal("sales")}
                        className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                      >
                        Metni GÃ¶r
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={continueRenewFlow}
                      className={`${BTN_GREEN} w-full sm:w-auto`}
                      disabled={!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)}
                    >
                      Devam Et
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setState((s) => ({ ...s, renewFlow: { active: false } }));
                        setRenewChecks({ kvkk: false, terms: false, sales: false });
                        setCanPay(false);
                      }}
                      className={`${BTN_OUTLINE} w-full sm:w-auto`}
                    >
                      VazgeÃ§
                    </button>
                  </div>
                </div>
              )}

              {/* Period + VAT toggle */}

<div className="mt-5">
  <div className="text-sm font-medium text-gray-700">FaturalandÄ±rma</div>

{state.currentPlanId === "prof-ozel" &&
  offerAlreadyAccepted &&
  !state.addUsersFlow?.active && (
    <div className="mt-5 rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">Paket Ä°ÅŸlemi</div>
          <div className="text-lg font-bold text-[#0a2b45] mt-1">SÃ¶zleÅŸmeler</div>
          <div className="text-xs text-gray-500 mt-1">
            Ã–demeye geÃ§mek iÃ§in sÃ¶zleÅŸmeleri onaylayÄ±p devam edin.
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
          SÃ¼reÃ§te
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm text-gray-800">
        <div className="flex flex-col">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={renewChecks.kvkk}
              onChange={(e) => setRenewChecks((c) => ({ ...c, kvkk: e.target.checked }))}
            />
            <div className="leading-snug">KVKK AydÄ±nlatma Metni</div>
          </div>
          <button
            type="button"
            onClick={() => setShowContractModal("kvkk")}
            className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
          >
            Metni GÃ¶r
          </button>
        </div>

        <div className="flex flex-col">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={renewChecks.terms}
              onChange={(e) => setRenewChecks((c) => ({ ...c, terms: e.target.checked }))}
            />
            <div className="leading-snug">KullanÄ±m KoÅŸullarÄ±</div>
          </div>
          <button
            type="button"
            onClick={() => setShowContractModal("terms")}
            className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
          >
            Metni GÃ¶r
          </button>
        </div>

        <div className="flex flex-col">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={renewChecks.sales}
              onChange={(e) => setRenewChecks((c) => ({ ...c, sales: e.target.checked }))}
            />
            <div className="leading-snug">SatÄ±ÅŸ / Ã–deme SÃ¶zleÅŸmesi</div>
          </div>
          <button
            type="button"
            onClick={() => setShowContractModal("sales")}
            className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
          >
            Metni GÃ¶r
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
      <button
  type="button"
  onClick={() => {
    if (!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)) {
      alert("Devam etmek iÃ§in sÃ¶zleÅŸmeleri onaylayÄ±nÄ±z.");
      return;
    }
    setCanPay(true);
  }}
  className={`${BTN_GREEN} w-full sm:w-auto`}
  disabled={!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)}
>
  Devam Et
</button>

        <button
          type="button"
          onClick={() => {
            setRenewChecks({ kvkk: false, terms: false, sales: false });
            setCanPay(false);
          }}
          className={`${BTN_OUTLINE} w-full sm:w-auto`}
        >
          VazgeÃ§
        </button>
      </div>
    </div>
  )}
  {(() => {
    const offerVatLocked =
  state.currentPlanId === "prof-ozel" || (offerAlreadyAccepted && isOfferVatIncluded(offerData));
    return (
      <>
        <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
  <select
    value={state.period}
    onChange={(e) => setState((s) => ({ ...s, period: e.target.value }))}
    className="w-full sm:w-64 border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400"
    disabled={state.addUsersFlow?.active}
  >
    <option
      value="AylÄ±k"
      disabled={
        state.addUsersFlow?.active
          ? state.activePeriod !== "AylÄ±k"
          : state.activePeriod === "YÄ±llÄ±k" &&
            Number(daysLeft || 0) > 3 &&
            !state.upgradeFlow?.active
      }
    >
      AylÄ±k
    </option>

    <option
      value="YÄ±llÄ±k"
      disabled={state.addUsersFlow?.active ? state.activePeriod !== "YÄ±llÄ±k" : false}
    >
      YÄ±llÄ±k
    </option>
  </select>

  <label className="flex items-center gap-2 text-sm text-gray-700">
    <input
      type="checkbox"
      checked={offerVatLocked ? true : state.showVatIncluded}
      onChange={(e) =>
        !offerVatLocked && setState((s) => ({ ...s, showVatIncluded: e.target.checked }))
      }
      disabled={offerVatLocked}
      className="h-4 w-4"
    />
    KDV Dahil GÃ¶ster
    {offerVatLocked && (
      <span className="text-xs text-gray-500 ml-2">(Teklif tutarÄ± KDV dahildir)</span>
    )}
  </label>
</div>

       <div className="text-xs text-gray-500 mt-1">
  {state.addUsersFlow?.active
    ? `Ek kullanÄ±cÄ± alÄ±mÄ±nda dÃ¶nem kilitlidir. Aktif paket: ${state.activePeriod}.`
    : state.activePeriod === "YÄ±llÄ±k" && Number(daysLeft || 0) > 3
    ? "YÄ±llÄ±k paket aktifken AylÄ±k seÃ§eneÄŸi son 3 gÃ¼ne kadar kapalÄ±dÄ±r."
    : state.period === "YÄ±llÄ±k"
    ? "YÄ±llÄ±ÄŸa geÃ§iÅŸte kalan gÃ¼n otomatik eklenir. (kalan gÃ¼n / 30)."
    : "AylÄ±k abonelik mevcut dÃ¶nem sonunda yenilenir."}
</div>

        <div className="mt-5">
          <div className="text-sm font-medium text-gray-700">Ã–zellikler</div>
          <ul className="mt-2 text-sm text-gray-700 space-y-1">
            {(currentPlan?.features || []).map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  })()}
</div>
</div>

            {/* Payment card */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500">Ã–deme</div>
                  <div className="text-lg font-bold text-[#0a2b45] mt-1">Ã–deme Ã–zeti</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ã–deme iÅŸlemleri iyzico Ã¼zerinden gÃ¼venli ÅŸekilde gerÃ§ekleÅŸtirilir.
                  </div>
                </div>
                              <div className="flex items-center gap-2">
                  {isPilot && canRequestOffer && (
                    <button type="button" onClick={openOfferModal} className={BTN_OUTLINE}>
                      Teklif Al
                    </button>
                  )}
                </div>
              </div>

              {/* Amount box */}
              <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">Ã–denecek Tutar</div>

{state.currentPlanId === "prof-ozel" ? (
  (() => {
    // teklif hiÃ§ yoksa
    if (!hasValidPanelOffer && Number(state.amountTRY || 0) <= 0) {
      return (
        <div className="mt-2 text-sm text-gray-700">
          {isPilot
            ? "HenÃ¼z panele gÃ¶nderilmiÅŸ bir teklif yok. Ã–nce Teklif Al ile talep oluÅŸturun."
            : "Teklif tanÄ±mlÄ± deÄŸil."}
          <div className="mt-3">
            <button type="button" onClick={openOfferModal} className={BTN_GREEN}>
              Teklif Al
            </button>
          </div>
        </div>
      );
    }

    // teklif var ama henÃ¼z kabul edilmedi
    if (hasValidPanelOffer && !offerAlreadyAccepted) {
      return (
        <div className="mt-2 text-sm text-gray-700">
          Teklifinizi kabul ederek devam ediniz.
        </div>
      );
    }

    // âœ… sÃ¶zleÅŸme onayÄ± Ã¶ncesi: rakamlar 0
    const rawMonthlyIncVat = Number(state.amountTRY || offerPriceTRY || 0);
    const monthlyIncVat = canPay ? rawMonthlyIncVat : 0;
    const yearlyIncVat = canPay ? Math.round(rawMonthlyIncVat * 10) : 0;

    const samePeriod =
  (state.period === "AylÄ±k" && state.activePeriod === "AylÄ±k") ||
  (state.period === "YÄ±llÄ±k" && state.activePeriod === "YÄ±llÄ±k");

// âœ… teklif kabul edildi ama Ã¶deme tamamlanmadÄ±ysa bu yenileme deÄŸildir
const isOfferTransitionPayment =
  state.currentPlanId === "prof-ozel" &&
  offerAcceptedButUnpaid &&
  !state.addUsersFlow?.ready;

const onlyRenewWindowBlocked =
  samePeriod &&
  !isOfferTransitionPayment &&
  !state.addUsersFlow?.ready &&
  !canRenewNow;

    const isAddUsersMode = Boolean(state.addUsersFlow?.active);

const preOfferPlan = plans.find((p) => p.id === state.preOfferPlanId) || null;
const creditPeriod = state.preOfferPeriod || state.activePeriod;
const creditBaseDays = creditPeriod === "YÄ±llÄ±k" ? 365 : 30;

// âœ… Kalan sÃ¼re mahsubu:
// 1) Normal paketten Ã¶zel teklife geÃ§iÅŸte eski paketin fiyatÄ± baz alÄ±nÄ±r.
// 2) Zaten Ã¶zel teklifte aylÄ±ktan yÄ±llÄ±ÄŸa geÃ§iÅŸte mevcut teklifin aylÄ±k tutarÄ± baz alÄ±nÄ±r.
const creditSourceIncVat = (() => {
  if (preOfferPlan) {
    const exVat =
      creditPeriod === "YÄ±llÄ±k"
        ? Number(preOfferPlan.yearlyExVat || 0)
        : Number(preOfferPlan.monthlyExVat || 0);

    return Math.round(exVat * (1 + VAT_RATE));
  }

  if (state.currentPlanId === "prof-ozel") {
    const monthlyOfferIncVat = Number(state.amountTRY || offerPriceTRY || 0);

    if (creditPeriod === "YÄ±llÄ±k") {
      return Math.round(monthlyOfferIncVat * 10);
    }

    return Math.round(monthlyOfferIncVat);
  }

  return 0;
})();


const currentCredit = 0;

const monthlyBaseIncVat = monthlyIncVat;
const yearlyBaseIncVat = yearlyIncVat;

const selectedBaseIncVat =
  state.period === "YÄ±llÄ±k" ? yearlyBaseIncVat : monthlyBaseIncVat;

const selectedPayableIncVat =
  !canPay
    ? 0
    : isAddUsersMode
    ? Number(addUsersPay?.total || 0)
    : Math.max(0, Number(selectedBaseIncVat || 0) - Number(currentCredit || 0));
const selectedPayableExVat =
  isAddUsersMode
    ? Number(addUsersPay?.ex || 0)
    : Math.round(selectedPayableIncVat / (1 + VAT_RATE));

const selectedPayableVat =
  isAddUsersMode
    ? Number(addUsersPay?.vat || 0)
    : selectedPayableIncVat - selectedPayableExVat;

const totalPayable = isAddUsersMode
  ? Number(addUsersPay?.total || 0)
  : selectedPayableIncVat;

    return (
      <div className="mt-3 space-y-2 text-sm text-gray-700">
       <div className="rounded-xl border bg-gray-50 p-3 space-y-2">

  <div className="flex justify-between">
    <span>SeÃ§ilen DÃ¶nem</span>
    <span className="font-medium">{state.period}</span>
  </div>

 {state.addUsersFlow?.active && addUsersPay && (
  <div className="flex justify-between">
    <span>Ek KullanÄ±cÄ±</span>
    <span className="font-medium">+{addUsersPay.addCount}</span>
  </div>
)}

  {!state.addUsersFlow?.active && (
    <div className="flex justify-between">
      <span>Paket TutarÄ±</span>
      <span className="font-medium">
        {trCurrency(state.period === "YÄ±llÄ±k" ? yearlyIncVat : monthlyIncVat)}
      </span>
    </div>
  )}

          {canPay && !isPilot && !state.addUsersFlow?.active && Number(currentCredit || 0) > 0 && (
  <div className="flex justify-between text-emerald-700">
    <span>Mevcut Paket Mahsubu</span>
    <span className="font-medium">- {trCurrency(currentCredit)}</span>
  </div>
)}

          <div className="flex justify-between">
            <span>KDV HariÃ§</span>
            <span className="font-medium">
  {state.addUsersFlow?.active
    ? trCurrency(addUsersPay?.ex || 0)
    : trCurrency(selectedPayableExVat)}
</span>
          </div>

          <div className="flex justify-between">
            <span>KDV (%20)</span>
            <span className="font-medium">
  {state.addUsersFlow?.active
    ? trCurrency(addUsersPay?.vat || 0)
    : trCurrency(selectedPayableVat)}
</span>
          </div>

          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">KDV Dahil Toplam</span>
            <span className="font-semibold">{trCurrency(totalPayable)}</span>
          </div>
        </div>

       <div className="text-xs text-gray-500 pt-1">
  {state.addUsersFlow?.active
    ? "Ek kullanÄ±cÄ± Ã¼creti, teklif fiyatÄ±na gÃ¶re kiÅŸi baÅŸÄ± ve kalan gÃ¼n oranlÄ± hesaplanÄ±r. Mevcut abonelik sÃ¼resi deÄŸiÅŸmez."
    : state.period === "YÄ±llÄ±k"
    ? !isPilot
      ? "YÄ±llÄ±k Ã¼cretlendirme uygulanÄ±r. Erken Ã¶deme yapÄ±lÄ±rsa kalan sÃ¼re yeni dÃ¶neme eklenir."
      : "Pilottan pakete geÃ§iÅŸte mahsup uygulanmaz."
    : "AylÄ±k Ã¼cretlendirme uygulanÄ±r. Erken Ã¶deme yapÄ±lÄ±rsa kalan sÃ¼re yeni dÃ¶neme eklenir."}
</div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              const isAddUsersPayment =
  state.addUsersFlow?.active &&
  state.addUsersFlow?.ready &&
  addUsersPay &&
  addUsersPay.total > 0;

iyzicoOde({
  type: isAddUsersPayment ? "ADD_USERS" : "NEW",

  amount: isAddUsersPayment ? addUsersPay.total : totalPayable,
  addUsersCount: isAddUsersPayment ? addUsersPay.addCount : 0,
  carryOverDays: isAddUsersPayment ? Number(daysLeft || 0) : 0,
  isRenewal: false,
});
            }}
            className={`${BTN_IYZICO} w-full flex items-center justify-center`}
            disabled={
  !canPay ||
  iyzicoLoading ||
  totalPayable <= 0 ||
  onlyRenewWindowBlocked ||
  (state.addUsersFlow?.active && !state.addUsersFlow?.ready)
}
          >
            {iyzicoLoading ? (
              "BaÅŸlatÄ±lÄ±yor..."
            ) : (
              <img
                src="/iyzico-pay.png"
                alt="iyzico ile Ã¶de"
                className="h-5 sm:h-6 w-auto block"
                draggable={false}
              />
            )}
          </button>

          {samePeriod && !canRenewNow && (
            <div className="text-xs text-gray-500 mt-3 text-center">
              Yenileme Ã¶demesi, bitiÅŸ tarihine <b>son 3 gÃ¼n</b> kala aÃ§Ä±lÄ±r. (Kalan: {daysLeft} gÃ¼n)
            </div>
          )}

          {!canPay && (
            <div className="text-xs text-gray-500 mt-2 text-center">
              Ã–deme yapabilmek iÃ§in soldaki sÃ¶zleÅŸmeleri onaylayÄ±p <b>Devam Et</b> butonuna basmanÄ±z gerekir.
            </div>
          )}
        </div>
      </div>
    );
  })()
) : !hydrated ? (
                  <div className="mt-2 text-sm text-gray-500">YÃ¼kleniyorâ€¦</div>
                ) : !currentPlan || currentPlan.monthlyExVat == null ? (
                  <div className="mt-2 text-sm text-gray-700">
                    Bu paket teklif Ã¼zerinedir. LÃ¼tfen teklif talebi oluÅŸturunuz.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-gray-700">
                   {addUsersPay ? (
  <>
    <div className="flex justify-between">
      <span>Ek KullanÄ±cÄ±</span>
      <span className="font-medium">+{addUsersPay.addCount} kiÅŸi</span>
    </div>

    <div className="flex justify-between">
      <span>KiÅŸi BaÅŸÄ± Ãœcret</span>
      <span className="font-medium">{trCurrency(addUsersPay.perUserBaseTRY)}</span>
    </div>

    <div className="flex justify-between">
      <span>Kalan GÃ¼n OranÄ±</span>
      <span className="font-medium">%{Math.round((addUsersPay.ratio || 0) * 100)}</span>
    </div>

    <div className="flex justify-between">
      <span>KDV HariÃ§</span>
      <span className="font-medium">{trCurrency(addUsersPay.ex)}</span>
    </div>

    <div className="flex justify-between">
      <span>KDV (%20)</span>
      <span className="font-medium">{trCurrency(addUsersPay.vat)}</span>
    </div>

    <div className="flex justify-between border-t pt-2">
      <span className="font-semibold">KDV Dahil Toplam</span>
      <span className="font-semibold">{trCurrency(addUsersPay.total)}</span>
    </div>
  </>
) : (
  <>
    <div className="flex justify-between">
      <span>KDV HariÃ§</span>
      <span className="font-medium">{trCurrency(summaryExVat)}</span>
    </div>

    <div className="flex justify-between">
      <span>KDV (%20)</span>
      <span className="font-medium">{trCurrency(summaryVat)}</span>
    </div>

    <div className="flex justify-between border-t pt-2">
      <span className="font-semibold">KDV Dahil Toplam</span>
      <span className="font-semibold">{trCurrency(summaryTotal)}</span>
    </div>
  </>
)}
                                       <div className="text-xs text-gray-500 pt-1">
                     {state.period === "YÄ±llÄ±k"
  ? "YÄ±llÄ±k Ã¼cretlendirme uygulanÄ±r. Erken Ã¶deme yapÄ±lÄ±rsa kalan sÃ¼re yeni dÃ¶neme eklenir."
  : "AylÄ±k Ã¼cretlendirme uygulanÄ±r. Erken Ã¶deme yapÄ±lÄ±rsa kalan sÃ¼re yeni dÃ¶neme eklenir."}
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      {state.period === "YÄ±llÄ±k" ? (
                        <button
                          type="button"
                          onClick={() => {
  const t =
    state.upgradeFlow?.active && state.upgradeFlow.mode === "UPGRADE" ? "UPGRADE" : "NEW";

  // âœ… Ã–deme Ã–zeti ile birebir aynÄ± tutar iyzico'ya gitsin
    iyzicoOde({
    type: t,
    amount: summaryTotal,
   carryOverDays: Number(daysLeft || 0),
isRenewal: Number(daysLeft || 0) > 0,
  });
}}
                          className={`${BTN_IYZICO} w-full flex items-center justify-center`}
                          disabled={
  !canPay ||
  iyzicoLoading ||
  // âœ… Soru 2: Yenileme yalnÄ±z son 3 gÃ¼n
  (!isPeriodSwitch && isSamePeriod && !state.upgradeFlow?.active && !canRenewNow)
}
                        >
                          {iyzicoLoading ? "BaÅŸlatÄ±lÄ±yor..." : "YÄ±llÄ±ÄŸa GeÃ§iÅŸ Ä°Ã§in Devam Et"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const t =
                              state.upgradeFlow?.active && state.upgradeFlow.mode === "UPGRADE" ? "UPGRADE" : "NEW";
                                                        iyzicoOde({
                              type: t,
                              amount: summaryTotal,
                              // âœ… Pilot dahil erken yenilemede kalan gÃ¼n yeni dÃ¶neme eklenecek
                              carryOverDays: Number(daysLeft || 0),
isRenewal: Number(daysLeft || 0) > 0,
                            });
                          }}
                          className={`${BTN_IYZICO} w-full flex items-center justify-center`}
                          disabled={
  !canPay ||
  iyzicoLoading ||
  // âœ… Soru 2: Yenileme yalnÄ±z son 3 gÃ¼n
  (!isPeriodSwitch && isSamePeriod && !state.upgradeFlow?.active && !canRenewNow)
}
                        >
                          {iyzicoLoading ? (
                            "BaÅŸlatÄ±lÄ±yor..."
                          ) : (
                            <img
                              src="/iyzico-pay.png"
                              alt="iyzico ile Ã¶de"
                              className="h-5 sm:h-6 w-auto block"
                              draggable={false}
                            />
                          )}
                        </button>
                      )}
                       {isSamePeriod && !state.upgradeFlow?.active && !canRenewNow && (
  <div className="text-xs text-gray-500 mt-3 text-center">
    Yenileme Ã¶demesi, bitiÅŸ tarihine <b>son 3 gÃ¼n</b> kala aÃ§Ä±lÄ±r. (Kalan: {daysLeft} gÃ¼n)
  </div>
)}
                      {!canPay && (
                        <div className="text-xs text-gray-500 mt-3 text-center">
                          Ã–deme yapabilmek iÃ§in soldaki sÃ¶zleÅŸmeleri onaylayÄ±p <b>Devam Et</b> butonuna basmanÄ±z gerekir.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Son Ã–demeler */}
              <div className="mt-5">
                <div className="text-sm font-semibold text-gray-800">Son Ã–demeler</div>

                <div className="mt-2 rounded-2xl border p-4 bg-white">
                  {recentPaymentsLoading ? (
                    <div className="text-sm text-gray-500">YÃ¼kleniyorâ€¦</div>
                  ) : recentPaymentsError ? (
                    <div className="text-sm text-red-600">{recentPaymentsError}</div>
                  ) : recentPayments.length === 0 ? (
                    <div className="text-sm text-gray-600">HenÃ¼z Ã¶deme iÅŸlemi bulunmuyor.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentPayments.slice(0, 6).map((p, idx) => {
                        const type = String(p?.type || p?.paymentType || "").toUpperCase();
const amount = Number(p?.amountTRY ?? p?.amount ?? p?.price_try ?? 0);

const periodRaw = String(p?.period || p?.billingPeriod || "").toLocaleLowerCase("tr-TR");
const isYearly =
  periodRaw === "yÄ±llÄ±k" ||
  periodRaw === "yillik" ||
  periodRaw === "yearly" ||
  periodRaw === "annual";

const planFrom = String(p?.planFrom || p?.plan_from || "").trim();
const planTo = String(p?.planTo || p?.plan_to || "").trim();
const isFirstSubscription = !planFrom && !!planTo;

const typeLabel =
  type === "UPGRADE"
    ? "Paket YÃ¼kseltme"
    : type === "ADD_USERS"
    ? "Ek KullanÄ±cÄ±"
    : type === "NEW"
    ? isFirstSubscription
      ? "Yeni Abonelik"
      : isYearly
      ? "YÄ±llÄ±k Abonelik"
      : "AylÄ±k Abonelik"
    : type === "OFFER"
    ? isFirstSubscription
      ? "Yeni Abonelik"
      : isYearly
      ? "YÄ±llÄ±k Abonelik"
      : "AylÄ±k Abonelik"
    : type || "Ã–deme";

                        const dtRaw =
                          p?.createdAt || p?.created_at || p?.paidAt || p?.paid_at || p?.date || "";
                        const dt = dtRaw ? new Date(dtRaw).toLocaleString("tr-TR") : "â€”";

                        return (
                          <div
                            key={p?.id || p?.paymentId || idx}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 truncate">{typeLabel}</div>
                              <div className="text-xs text-gray-500">{dt}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900 tabular-nums">{trCurrency(amount)}</div>
                              <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                BaÅŸarÄ±lÄ±
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

{/* Paket YÃ¼kseltme SeÃ§enekleri / Kurumsal Ek KullanÄ±cÄ± */}
{state.currentPlanId !== "prof-ozel" ? (
  <div className="border rounded p-5 bg-white">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-gray-900">Paket YÃ¼kseltme SeÃ§enekleri</div>
        <div className="text-xs text-gray-500 mt-1">
          Mevcut paketinizi yÃ¼kseltebilir veya ihtiyaÃ§larÄ±nÄ±za gÃ¶re deÄŸiÅŸtirebilirsiniz.
        </div>
      </div>
      <div className="text-xs text-gray-600">
        GÃ¶rÃ¼ntÃ¼leme:{" "}
        <span className="font-semibold">{state.showVatIncluded ? "KDV Dahil" : "KDV HariÃ§"}</span>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {plans.map((p) => {
        const isCurrent = p.id === state.currentPlanId;
        const ex = state.period === "YÄ±llÄ±k" ? p.yearlyExVat : p.monthlyExVat;
        const isOffer = ex == null;

        // âœ… YÄ±llÄ±k pakette teklif alma kapalÄ±
        const offerDisabled = isOffer && state.period === "YÄ±llÄ±k";

        const btnClass =
          "w-full px-4 py-2 rounded text-sm font-semibold text-white " +
          (isOffer
            ? offerDisabled
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
            : "bg-green-600 hover:bg-green-700");

        return (
          <div
            key={p.id}
            className={`border rounded-xl p-4 ${isCurrent ? "bg-gray-50" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-gray-900">{p.name}</div>
              {p.badge ? (
                <span className="text-[11px] px-2 py-1 rounded-full bg-blue-600 text-white">
                  {p.badge}
                </span>
              ) : null}
            </div>

            <div className="text-xs text-gray-600 italic mt-1">{p.note}</div>
            <div className="text-xs text-gray-700 mt-1">{p.users}</div>

            <div className="mt-3 text-2xl font-extrabold text-gray-900">
              {isOffer ? "Teklif Ãœzerine" : emphasizedPrice(ex)}
            </div>

            {!isOffer && (
              <div className="text-xs text-gray-500">
                {state.period} â€¢ {state.showVatIncluded ? "KDV Dahil" : "KDV HariÃ§"}
              </div>
            )}

            <ul className="mt-3 space-y-1 text-xs text-gray-700">
              {p.features.slice(0, 3).map((f, i) => (
                <li key={i}>â€¢ {f}</li>
              ))}
            </ul>

            <div className="mt-4">
              {isCurrent ? (
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-2 rounded text-sm font-semibold bg-gray-200 text-gray-700 cursor-not-allowed"
                >
                  Mevcut Paket
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={offerDisabled}
                    onClick={() => {
                      if (isOffer) {
                        if (offerDisabled) return;
                        openOfferModal();
                      } else {
                        changePlan(p.id);
                      }
                    }}
                    className={btnClass}
                  >
                    {isOffer ? "Teklif Al" : "YÃ¼kselt / DeÄŸiÅŸtir"}
                  </button>

                  {offerDisabled && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      YÄ±llÄ±k pakette Ã¶zel teklif alÄ±nmaz. AylÄ±k seÃ§iniz.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
) : (
  <div className="rounded-2xl border bg-white p-5">
    {(() => {
     const isYearlyActive = state.activePeriod === "YÄ±llÄ±k";
const isMonthlyActive = state.activePeriod === "AylÄ±k";

// âœ… Ek kullanÄ±cÄ±da dÃ¶nem aktif pakete kilitli
const addUsersPeriodLocked = state.currentPlanId === "prof-ozel";

// âœ… YÄ±llÄ±k pakete geÃ§iÅŸ ekranÄ±ndayken ek kullanÄ±cÄ± alÄ±nmaz
const blockAddUsers =
  state.currentPlanId === "prof-ozel" &&
  state.period !== state.activePeriod;
      return (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Kurumsal Ek KullanÄ±cÄ±
              </div>
             <div className="text-xs text-gray-500 mt-1">
  Ek kullanÄ±cÄ± alÄ±mÄ±nda dÃ¶nem, aktif paket dÃ¶nemi ile aynÄ±dÄ±r:
  <span className="font-semibold"> {state.activePeriod}</span>
</div>
            </div>
            <div className="text-xs text-gray-600">
              Mevcut: <span className="font-semibold">{state.usersCount}</span> kullanÄ±cÄ±
            </div>
          </div>

          {blockAddUsers && (
  <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
    Paket dÃ¶nemi deÄŸiÅŸtirirken <b>ek kullanÄ±cÄ±</b> eklenemez.
    Ã–nce mevcut paketi <b>{state.period}</b> olarak tamamlayÄ±n, ardÄ±ndan ek kullanÄ±cÄ± ekleyin.
  </div>
)}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <div className="text-sm font-medium text-gray-700">
                Eklemek istediÄŸin kullanÄ±cÄ±
              </div>
             <input
  type="number"
  min={1}
  value={state.addUsersCount}
  disabled={blockAddUsers}
  onChange={(e) =>
    setState((s) => ({
      ...s,
      addUsersCount: Math.max(1, Number(e.target.value || 1)),
    }))
  }
  className="mt-2 w-full border rounded-xl px-3 py-2.5 text-sm"
/>

<div className="mt-2 text-xs text-gray-500">
  Bu iÅŸlem <b>{state.activePeriod}</b> dÃ¶nemine gÃ¶re hesaplanÄ±r.
</div>
            </div>

            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Yeni Limit</div>
              <div className="text-lg font-bold text-[#0a2b45]">
                {state.usersCount + Number(state.addUsersCount || 1)} kullanÄ±cÄ±
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
           <button
  type="button"
  className={`${BTN_GREEN} ${blockAddUsers ? "opacity-50 cursor-not-allowed" : ""}`}
  onClick={() => {
    if (blockAddUsers) return;
    startAddUsersFlow();
  }}
  disabled={blockAddUsers}
>
  KullanÄ±cÄ± Ekle
</button>

            {state.addUsersFlow?.active && (
              <button
                type="button"
                className={BTN_OUTLINE}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
                  }));
                  setAddUsersChecks({ kvkk: false, terms: false, sales: false });
                  setCanPay(false);
                }}
              >
                VazgeÃ§
              </button>
            )}
          </div>
        </>
      );
    })()}
  </div>
)}
</div>
</div>

      {/* âœ… iyzico Checkout Modal */}
      {showIyzicoModal && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">iyzico Ã–deme</h4>

              <button
                onClick={() => {
                  setShowIyzicoModal(false);
                  setIyzicoHtml("");
                  setIyzicoError("");
                }}
                className="text-gray-500 hover:text-gray-700"
                type="button"
              >
                âœ•
              </button>
            </div>

            {iyzicoError ? (
              <div className="border rounded-xl p-3 bg-red-50 text-sm text-red-700">{iyzicoError}</div>
            ) : (
              <div className="min-h-[260px]">
                <div ref={iyzicoContainerRef} />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowIyzicoModal(false);
                  setIyzicoHtml("");
                  setIyzicoError("");
                }}
                className={BTN_OUTLINE}
                type="button"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* âœ… Ã–zel Teklif Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800">Teklif Al</h4>
              <button onClick={closeOfferModal} className="text-gray-500 hover:text-gray-700" type="button">
                âœ•
              </button>
            </div>

            {offerError ? (
              <div className="mb-3 border rounded-xl p-3 bg-red-50 text-sm text-red-700">{offerError}</div>
            ) : null}

            <div className="space-y-3">
              <input
                type="text"
                value={offerForm.companyName}
                readOnly
                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50"
                placeholder="Kurum AdÄ±"
              />

              <input
  type="text"
  value={offerForm.fullName}
  onChange={(e) =>
    setOfferForm((s) => ({
      ...s,
      fullName: e.target.value.toLocaleUpperCase("tr-TR"),
    }))
  }
  placeholder="Ad Soyad"
  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
  style={{ lineHeight: "1.5rem" }}
/>

              <input
                type="email"
                value={offerForm.email}
                readOnly
                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50"
                placeholder="E-posta"
              />

              <input
                inputMode="numeric"
                value={offerForm.usersCount}
                onChange={(e) =>
                  setOfferForm((f) => ({
                    ...f,
                    usersCount: digitsOnly(e.target.value, 6),
                  }))
                }
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="KullanÄ±cÄ± SayÄ±sÄ± (15+)"
              />

              <textarea
                rows={4}
                value={offerForm.message}
                onChange={(e) =>
                  setOfferForm((f) => ({
                    ...f,
                    message: sentenceCaseTR(e.target.value),
                  }))
                }
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="MesajÄ±nÄ±z"
              />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={closeOfferModal} className={BTN_OUTLINE} disabled={offerSending}>
                VazgeÃ§
              </button>
              <button type="button" onClick={submitOfferRequest} className={BTN_GREEN} disabled={offerSending}>
                {offerSending ? "GÃ¶nderiliyor..." : "GÃ¶nder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* âœ… SÃ¶zleÅŸme Modal */}
      {showContractModal && (
        <div className="fixed inset-0 z-[130] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">
                {showContractModal === "kvkk" && "KVKK AydÄ±nlatma Metni"}
                {showContractModal === "terms" && "KullanÄ±m KoÅŸullarÄ±"}
                {showContractModal === "sales" && "SatÄ±ÅŸ / Ã–deme SÃ¶zleÅŸmesi"}
              </h4>

              <button
                type="button"
                onClick={() => setShowContractModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                âœ•
              </button>
            </div>

            <div className="text-sm text-gray-700 whitespace-pre-line max-h-[65vh] overflow-y-auto pr-1">
              {showContractModal === "kvkk" && KVKK_TEXT}
              {showContractModal === "terms" && TERMS_TEXT}
              {showContractModal === "sales" && SALES_TEXT}
            </div>
          </div>
        </div>
      )}
    </div>
  );


}
