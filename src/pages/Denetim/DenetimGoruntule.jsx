import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Download, Eye, FileText, FolderOpen, Lock, ShieldCheck, X } from "lucide-react";
import { API_BASE } from "../../config/api";

const AUDIT_API_BASE = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
};

const documentId = (doc) => doc?.id || doc?._id || doc?.documentId;
const isImage = (doc) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(doc?.fileName || "");

export default function DenetimGoruntule() {
  const { publicToken } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("summary");
  const [previewDoc, setPreviewDoc] = useState(null);

  const loadPackage = async (candidatePassword = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${AUDIT_API_BASE}/audit-packages/public/${encodeURIComponent(publicToken)}`, {
        headers: candidatePassword ? { "x-audit-password": candidatePassword } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && data?.requiresPassword) {
        setPasswordRequired(true);
        if (candidatePassword) setError(data.message || "Şifre hatalı.");
        return;
      }
      if (!response.ok) throw new Error(data.message || "Bu denetim bağlantısı geçersiz, iptal edilmiş veya artık kullanılamıyor.");
      setPayload(data);
      setPassword(candidatePassword);
      setPasswordRequired(false);
      setActiveCategory("summary");
    } catch (err) {
      setError(err.message || "Denetim bağlantısı açılamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPackage(); }, [publicToken]);

  const pkg = payload?.package || {};
  const categories = payload?.categories || [];
  const selectedCategory = useMemo(
    () => categories.find((item) => (item.id || item.category || item.name) === activeCategory),
    [categories, activeCategory]
  );

  const fileUrl = (doc, download = false) => {
    const params = new URLSearchParams();
    if (password) params.set("password", password);
    if (download) params.set("download", "1");
    const query = params.toString();
    return `${AUDIT_API_BASE}/audit-packages/public/${encodeURIComponent(publicToken)}/documents/${encodeURIComponent(documentId(doc))}/file${query ? `?${query}` : ""}`;
  };

  if (loading) return <PublicState title="Denetim dosyası hazırlanıyor..." />;

  if (passwordRequired) {
    return (
      <main className="audit-state-page">
        <section className="audit-state-card">
          <Lock size={34} />
          <h1>Şifre korumalı paylaşım</h1>
          <p>Bu denetim dosyasını görüntülemek için paylaşım şifresini giriniz.</p>
          <form onSubmit={(event) => { event.preventDefault(); loadPackage(passwordInput); }}>
            <input type="password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} placeholder="Paylaşım şifresi" autoFocus />
            {error && <div className="audit-error">{error}</div>}
            <button type="submit" disabled={!passwordInput}>Dosyayı Görüntüle</button>
          </form>
        </section>
        <PortalStyles />
      </main>
    );
  }

  if (error || !payload) return <PublicState error title="Denetim bağlantısı geçersiz" text={error} />;

  return (
    <main className="audit-public-page">
      <header className="audit-header">
        <div className="audit-brand"><ShieldCheck size={30} /><div><strong>İSG PANEL</strong><span>DENETİM GÖRÜNTÜLEME</span></div></div>
        <div className="audit-file-number">Dosya No <strong>{pkg.packageNumber}</strong></div>
      </header>

      <section className="audit-hero">
        <span className="audit-badge">DİJİTAL İSG DENETİM DOSYASI</span>
        <h1>{pkg.companyName || "Firma"}</h1>
        <div className="audit-meta">
          <span>Oluşturulma <strong>{formatDate(pkg.createdAt)}</strong></span>
          <span>Toplam Belge <strong>{pkg.documentCount ?? categories.reduce((sum, item) => sum + (item.count || 0), 0)}</strong></span>
          <span>Kategori <strong>{pkg.categoryCount ?? categories.length}</strong></span>
          <span>Durum <strong>Aktif</strong></span>
        </div>
      </section>

      <div className="audit-layout">
        <aside className="audit-sidebar">
          <button className={activeCategory === "summary" ? "active" : ""} onClick={() => setActiveCategory("summary")}><ShieldCheck size={17} /> Denetim Özeti</button>
          {categories.map((category) => {
            const key = category.id || category.category || category.name;
            return <button key={key} className={activeCategory === key ? "active" : ""} onClick={() => setActiveCategory(key)}><FolderOpen size={17} /><span>{category.name || category.label || category.category}</span><b>{category.count ?? category.documents?.length ?? 0}</b></button>;
          })}
        </aside>

        <section className="audit-content">
          {activeCategory === "summary" ? (
            <><div className="audit-section-title"><div><h2>Denetim Özeti</h2><p>Paylaşılan denetim dosyasındaki kategoriler ve belge sayıları.</p></div></div><div className="audit-category-grid">{categories.map((category) => { const key = category.id || category.category || category.name; return <button key={key} onClick={() => setActiveCategory(key)}><FolderOpen size={22} /><span>{category.name || category.label || category.category}</span><strong>{category.count ?? category.documents?.length ?? 0} belge</strong></button>; })}</div></>
          ) : (
            <><div className="audit-section-title"><div><h2>{selectedCategory?.name || selectedCategory?.label || selectedCategory?.category}</h2><p>{selectedCategory?.documents?.length || 0} belge</p></div></div><div className="audit-documents">{(selectedCategory?.documents || []).map((doc) => <article key={documentId(doc)}><div className="audit-document-icon"><FileText size={22} /></div><div className="audit-document-info"><h3>{doc.title || doc.fileName || doc.belgeTuru || "Belge"}</h3><div>{doc.tarih && <span>{formatDate(doc.tarih).split(" ")[0]}</span>}{doc.revision && <span>{doc.revision}</span>}{doc.signatureStatus && <span className={String(doc.signatureStatus).toLowerCase().includes("eksik") ? "warning" : "signed"}>{doc.signatureStatus}</span>}{doc.status && <span>{doc.status}</span>}</div></div><button className="audit-view" onClick={() => setPreviewDoc(doc)} disabled={!doc.hasFile}><Eye size={17} /> Görüntüle</button>{pkg.allowDownload && doc.hasFile && <a className="audit-download" href={fileUrl(doc, true)}><Download size={17} /><span>İndir</span></a>}</article>)}</div></>
          )}
        </section>
      </div>

      {previewDoc && <div className="audit-modal" role="dialog"><div className="audit-modal-card"><header><strong>{previewDoc.title || previewDoc.fileName || "Belge"}</strong><button onClick={() => setPreviewDoc(null)} aria-label="Kapat"><X /></button></header><div className="audit-preview">{isImage(previewDoc) ? <img src={fileUrl(previewDoc)} alt={previewDoc.title || "Belge"} /> : <iframe src={fileUrl(previewDoc)} title={previewDoc.title || "Belge önizleme"} />}</div></div></div>}
      <PortalStyles />
    </main>
  );
}

function PublicState({ title, text, error = false }) {
  return <main className="audit-state-page"><section className="audit-state-card">{error ? <AlertTriangle size={36} /> : <ShieldCheck size={36} />}<h1>{title}</h1>{text && <p>{text}</p>}</section><PortalStyles /></main>;
}

function PortalStyles() {
  return <style>{`
    *{box-sizing:border-box}.audit-public-page,.audit-state-page{min-height:100vh;background:#f4f7fb;color:#0b2742;font-family:Inter,Arial,sans-serif}.audit-header{height:72px;padding:0 max(24px,calc((100vw - 1240px)/2));display:flex;align-items:center;justify-content:space-between;background:white;border-bottom:1px solid #dce5ef}.audit-brand{display:flex;align-items:center;gap:10px}.audit-brand>div{display:flex;flex-direction:column}.audit-brand strong{font-size:18px}.audit-brand span{font-size:10px;color:#16795b;font-weight:800;letter-spacing:1px}.audit-file-number{font-size:13px;color:#62748a}.audit-file-number strong{color:#0b2742;margin-left:6px}.audit-hero{padding:34px max(24px,calc((100vw - 1240px)/2));background:#0b304c;color:white}.audit-badge{font-size:11px;color:#77e0bc;font-weight:800;letter-spacing:1px}.audit-hero h1{margin:10px 0 20px;font-size:28px;letter-spacing:0}.audit-meta{display:flex;gap:32px;flex-wrap:wrap}.audit-meta span{display:flex;flex-direction:column;font-size:12px;color:#b9cad8}.audit-meta strong{margin-top:4px;color:white;font-size:14px}.audit-layout{display:grid;grid-template-columns:270px minmax(0,1fr);gap:20px;max-width:1240px;margin:24px auto;padding:0 24px}.audit-sidebar,.audit-content{background:white;border:1px solid #dce5ef;border-radius:6px}.audit-sidebar{padding:10px;height:max-content}.audit-sidebar button{width:100%;display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:9px;padding:11px;border:0;border-radius:5px;background:transparent;text-align:left;color:#334e68;cursor:pointer}.audit-sidebar button.active{background:#e8f2ff;color:#155fcc;font-weight:700}.audit-sidebar b{font-size:11px;background:#edf2f7;padding:3px 6px;border-radius:10px}.audit-content{padding:24px;min-height:430px}.audit-section-title{display:flex;justify-content:space-between;border-bottom:1px solid #e3eaf1;padding-bottom:16px;margin-bottom:18px}.audit-section-title h2{font-size:20px;margin:0 0 5px}.audit-section-title p{margin:0;color:#718096;font-size:13px}.audit-category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.audit-category-grid button{display:grid;grid-template-columns:28px 1fr;gap:4px 9px;align-items:center;text-align:left;padding:17px;border:1px solid #dce5ef;border-radius:6px;background:white;color:#193b57;cursor:pointer}.audit-category-grid button:hover{border-color:#2d6bea}.audit-category-grid span{font-weight:700}.audit-category-grid strong{grid-column:2;color:#718096;font-size:12px}.audit-documents{display:flex;flex-direction:column;gap:8px}.audit-documents article{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid #e1e8ef;border-radius:6px}.audit-document-icon{width:38px;height:38px;display:grid;place-items:center;background:#edf4fb;border-radius:5px;color:#2767c9}.audit-document-info{flex:1;min-width:0}.audit-document-info h3{font-size:14px;margin:0 0 6px;overflow-wrap:anywhere}.audit-document-info div{display:flex;gap:7px;flex-wrap:wrap}.audit-document-info span{font-size:11px;color:#66788a;background:#f1f4f7;padding:3px 6px;border-radius:3px}.audit-document-info .signed{color:#087a55;background:#e8fbf3}.audit-document-info .warning{color:#b54708;background:#fff4e5}.audit-view,.audit-download{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #cfdbe7;border-radius:5px;background:white;color:#17466d;text-decoration:none;font-weight:700;font-size:12px;cursor:pointer}.audit-view:disabled{opacity:.45}.audit-download span{display:none}.audit-modal{position:fixed;inset:0;background:rgba(8,25,40,.7);display:grid;place-items:center;padding:20px;z-index:20}.audit-modal-card{width:min(1100px,96vw);height:min(820px,92vh);background:white;border-radius:6px;overflow:hidden}.audit-modal-card header{height:54px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dde5ed}.audit-modal-card header button{border:0;background:transparent;cursor:pointer}.audit-preview{height:calc(100% - 54px);background:#26323c;display:grid;place-items:center}.audit-preview iframe,.audit-preview img{width:100%;height:100%;border:0;object-fit:contain}.audit-state-page{display:grid;place-items:center;padding:20px}.audit-state-card{width:min(440px,100%);padding:34px;background:white;border:1px solid #dae4ee;border-radius:7px;text-align:center;box-shadow:0 14px 40px rgba(21,43,64,.1)}.audit-state-card svg{color:#196c55}.audit-state-card h1{font-size:22px;margin:14px 0 8px}.audit-state-card p{font-size:14px;color:#63788a;line-height:1.5}.audit-state-card form{display:flex;flex-direction:column;gap:10px;margin-top:20px}.audit-state-card input{height:42px;border:1px solid #c9d6e2;border-radius:5px;padding:0 12px;font-size:14px}.audit-state-card button{height:42px;border:0;border-radius:5px;background:#2368e8;color:white;font-weight:700;cursor:pointer}.audit-state-card button:disabled{opacity:.5}.audit-error{font-size:12px;color:#c53030;text-align:left}
    @media(max-width:800px){.audit-header{height:auto;padding:14px 18px}.audit-file-number{display:none}.audit-hero{padding:25px 18px}.audit-hero h1{font-size:22px}.audit-meta{display:grid;grid-template-columns:1fr 1fr;gap:16px}.audit-layout{display:block;margin:14px auto;padding:0 12px}.audit-sidebar{display:flex;overflow-x:auto;gap:5px;margin-bottom:12px}.audit-sidebar button{min-width:max-content;display:flex}.audit-content{padding:16px;min-height:360px}.audit-category-grid{grid-template-columns:1fr}.audit-documents article{align-items:flex-start;flex-wrap:wrap}.audit-document-info{width:calc(100% - 52px);flex:none}.audit-view,.audit-download{margin-left:50px}.audit-download{margin-left:0}.audit-modal{padding:0}.audit-modal-card{width:100vw;height:100vh;border-radius:0}}
  `}</style>;
}
