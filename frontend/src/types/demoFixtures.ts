export const DEMO_BASE_PLOT = {
  type: "Polygon",
  coordinates: [
    [
      [-54.500000, -12.500000],
      [-54.495000, -12.500000],
      [-54.495000, -12.495000],
      [-54.500000, -12.495000],
      [-54.500000, -12.500000]
    ]
  ]
};

export const DEMO_JITTERED_PLOT = {
  type: "Polygon",
  coordinates: [
    [
      [-54.500015, -12.500012],
      [-54.494985, -12.499991],
      [-54.495018, -12.494982],
      [-54.499982, -12.495021],
      [-54.500015, -12.500012]
    ]
  ]
};

export const DEMO_AMBIGUOUS_OVERLAP_PLOT = {
  type: "Polygon",
  coordinates: [
    [
      [-54.498000, -12.500000],
      [-54.493000, -12.500000],
      [-54.493000, -12.495000],
      [-54.498000, -12.495000],
      [-54.498000, -12.500000]
    ]
  ]
};

export const DEMO_ADJACENT_PLOT = {
  type: "Polygon",
  coordinates: [
    [
      [-54.495000, -12.500000],
      [-54.490000, -12.500000],
      [-54.490000, -12.495000],
      [-54.495000, -12.495000],
      [-54.495000, -12.500000]
    ]
  ]
};

export const DEMO_SAMPLE_DOCUMENT_TEXT = `
BILL OF LADING & COMMERCIAL INVOICE
BOL Number: BOL-BR-2026-9941
Consignor: Fazenda Santa Maria do Sul Ltda (Mato Grosso, BR)
Consignee: EuroCommodities Logistics B.V. (Rotterdam Port, NL)
Commodity: Soybeans (Non-GMO, Certified Deforestation-Free)
Declared Net Weight: 1,800 KG
Shipment Date: 2026-10-16
Origin Plot Cadastral ID: PLOT-BASE-DEMO
Phytosanitary Cert: MAPA-BR-2026-088192
`.trim();
