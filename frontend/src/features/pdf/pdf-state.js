const PDF_DEMO_URL = "/public/demo/demo-document.pdf";
const pdfState = {
  pdfjs: null,
  doc: null,
  fileName: "",
  id: "",
  page: 1,
  pageCount: 0,
  scale: 1.15,
  fitMode: "width",
  pageTexts: new Map(),
  pageItems: new Map(),
  wordPages: [],
  wordPageIndex: 0,
  activeWord: "",
  renderToken: 0,
  indexing: false,
  outputScale: 1,
  ocrRunning: false,
  libraryItemId: ""
};
