import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/** DOM elementini A4 dikey PDF'e aktarır. */
export async function exportElementAsPDF(node, fileName = "document.pdf") {
  if (!node) return;
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  // Basit tek-parça yerleşim (çoğu tabloya yeterli)
  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
  pdf.save(fileName);
}
