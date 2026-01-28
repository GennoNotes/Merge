(function () {
  const NL = "\n";
  const $ = (id) => document.getElementById(id);

  function setStatus(msg, level = "info") {
    const box = $("statusBox");
    if (!box) return;
    box.className = level;
    box.textContent = msg;
  }

  function log(msg) {
    console.log(msg);
    const el = $("log");
    if (el) el.textContent += String(msg) + NL;
  }

  function mustGet(id) {
    const el = $(id);
    if (!el) throw new Error("Missing element #" + id);
    return el;
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readPdf(file) {
    const { PDFDocument } = window.PDFLib;
    if (!PDFDocument) throw new Error("pdf-lib not loaded");
    const buf = await file.arrayBuffer();
    return await PDFDocument.load(buf);
  }

  async function mergeTwoPdfs(fileA, fileB) {
    const { PDFDocument } = window.PDFLib;

    const [pdfA, pdfB] = await Promise.all([readPdf(fileA), readPdf(fileB)]);
    const merged = await PDFDocument.create();

    // Copy all pages from A, then from B (standard pdf-lib merge pattern) [web:418]
    const pagesA = await merged.copyPages(pdfA, pdfA.getPageIndices());
    pagesA.forEach((p) => merged.addPage(p));

    const pagesB = await merged.copyPages(pdfB, pdfB.getPageIndices());
    pagesB.forEach((p) => merged.addPage(p));

    return await merged.save();
  }

  let mergedBytes = null;
  let mergedName = "merged.pdf";

  function filesSelected() {
    return ($("pdfA")?.files?.length || 0) > 0 && ($("pdfB")?.files?.length || 0) > 0;
  }

  function updateStatusFromSelection() {
    if (!filesSelected()) {
      setStatus("Please select both PDFs (PDF 1 and PDF 2).", "warn");
      $("downloadMergedBtn").disabled = true;
      return;
    }
    setStatus("Ready to merge. Click Merge.", "info");
  }

  async function doMerge() {
    const fileA = $("pdfA")?.files?.[0] || null;
    const fileB = $("pdfB")?.files?.[0] || null;

    if (!fileA || !fileB) {
      setStatus("Please select both PDFs first.", "warn");
      return;
    }

    setStatus("Merging PDFs…", "info");
    $("downloadMergedBtn").disabled = true;
    mergedBytes = null;

    const bytes = await mergeTwoPdfs(fileA, fileB);

    mergedBytes = bytes;
    const baseA = fileA.name.replace(/\.pdf$/i, "");
    const baseB = fileB.name.replace(/\.pdf$/i, "");
    mergedName = `${baseA}+${baseB}-merged.pdf`;

    $("downloadMergedBtn").disabled = false;
    setStatus(`Done.\nMerged: ${fileA.name} + ${fileB.name}`, "info");
  }

  function bindEvents() {
    mustGet("pdfA").addEventListener("change", updateStatusFromSelection);
    mustGet("pdfB").addEventListener("change", updateStatusFromSelection);

    mustGet("mergeBtn").addEventListener("click", async () => {
      try {
        await doMerge();
      } catch (e) {
        console.error(e);
        setStatus("Error: " + (e?.message || String(e)), "error");
        log("Error: " + (e?.stack || e?.message || String(e)));
      }
    });

    mustGet("downloadMergedBtn").addEventListener("click", () => {
      if (!mergedBytes) {
        setStatus("Nothing to download yet. Click Merge first.", "warn");
        return;
      }
      downloadBytes(mergedBytes, mergedName);
    });

    setStatus("Ready. Select two PDFs, then click Merge.", "info");
    log("Merge script loaded.");
    updateStatusFromSelection();
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
