// Archivo generado por tools/generar-estaciones.js a partir de plantilla/registro-temperatura.xlsx.
// Cada polea guarda la celda del Excel donde se escribe su temperatura.

// Celdas de los datos generales (iguales en las tres hojas)
export const CELDAS_GENERALES = { nombre: 'D4', fecha: 'F4', hora: 'D5', temperaturaAmbiente: 'F5' };

// Celdas con las opciones de velocidad del sistema
export const CELDAS_VELOCIDAD = { 3: 'C7', 4: 'D7', 5: 'F7' };

export const ESTACIONES = [
  {
    "id": "oasis",
    "nombre": "Oasis",
    "hojaExcel": "Oasis",
    "secciones": [
      {
        "titulo": "Volante principal",
        "filaExcel": 8,
        "poleas": [
          {
            "celda": "D9",
            "nombre": "Rodamiento Superior"
          },
          {
            "celda": "F9",
            "nombre": "Guarnición"
          },
          {
            "celda": "D10",
            "nombre": "Rodamiento Inferior"
          }
        ]
      },
      {
        "titulo": "Poleas de entrada",
        "filaExcel": 11,
        "poleas": [
          {
            "celda": "D12",
            "nombre": "Polea 1 (Balancín entrada)"
          },
          {
            "celda": "F12",
            "nombre": "Polea 2 (Balancín entrada)"
          },
          {
            "celda": "D13",
            "nombre": "Polea 3 (Balancín entrada)"
          },
          {
            "celda": "F13",
            "nombre": "Polea 4 (Balancín entrada)"
          },
          {
            "celda": "D14",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F14",
            "nombre": "Polea 6E"
          },
          {
            "celda": "D15",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F15",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D16",
            "nombre": "Polea 9E"
          },
          {
            "celda": "F16",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      },
      {
        "titulo": "Poleas desviación vertical entrada",
        "filaExcel": 17,
        "poleas": [
          {
            "celda": "D18",
            "nombre": "Polea 1E"
          },
          {
            "celda": "F18",
            "nombre": "Polea 2E"
          },
          {
            "celda": "D19",
            "nombre": "Polea 3E"
          }
        ]
      },
      {
        "titulo": "Poleas desviación vertical salida",
        "filaExcel": 20,
        "poleas": [
          {
            "celda": "D21",
            "nombre": "Polea 1S"
          },
          {
            "celda": "F21",
            "nombre": "Polea 2S"
          },
          {
            "celda": "D22",
            "nombre": "Polea 3S"
          }
        ]
      },
      {
        "titulo": "Poleas de salida",
        "filaExcel": 23,
        "poleas": [
          {
            "celda": "D24",
            "nombre": "Polea 1 (Balancín salida)"
          },
          {
            "celda": "F24",
            "nombre": "Polea 2 (Balancín salida)"
          },
          {
            "celda": "D25",
            "nombre": "Polea 3 (Balancín salida)"
          },
          {
            "celda": "F25",
            "nombre": "Polea 4 (Balancín salida)"
          },
          {
            "celda": "D26",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F26",
            "nombre": "Polea 6S"
          },
          {
            "celda": "D27",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F27",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D28",
            "nombre": "Polea 9S"
          },
          {
            "celda": "F28",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      }
    ]
  },
  {
    "id": "tupahue",
    "nombre": "Tupahue",
    "hojaExcel": " Tupahue",
    "secciones": [
      {
        "titulo": "Volante principal",
        "filaExcel": 8,
        "poleas": [
          {
            "celda": "D9",
            "nombre": "Rodamiento Superior"
          },
          {
            "celda": "F9",
            "nombre": "Guarnición"
          },
          {
            "celda": "D10",
            "nombre": "Rodamiento Inferior"
          }
        ]
      },
      {
        "titulo": "Subida · poleas de entrada",
        "filaExcel": 11,
        "poleas": [
          {
            "celda": "D12",
            "nombre": "Polea 1 (Balancín entrada)"
          },
          {
            "celda": "F12",
            "nombre": "Polea 2 (Balancín entrada)"
          },
          {
            "celda": "D13",
            "nombre": "Polea 3 (Balancín entrada)"
          },
          {
            "celda": "F13",
            "nombre": "Polea 4 (Balancín entrada)"
          },
          {
            "celda": "D14",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F14",
            "nombre": "Polea 6 E/A"
          },
          {
            "celda": "D15",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F15",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D16",
            "nombre": "Polea 9 E/A"
          },
          {
            "celda": "F16",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      },
      {
        "titulo": "Subida · desviación entrada",
        "filaExcel": 17,
        "poleas": [
          {
            "celda": "D18",
            "nombre": "Polea 1 (Horizontal)"
          },
          {
            "celda": "F18",
            "nombre": "Polea 2 (Horizontal)"
          },
          {
            "celda": "D19",
            "nombre": "Polea 3 (Horizontal)"
          },
          {
            "celda": "F19",
            "nombre": "Polea 4 (Horizontal)"
          },
          {
            "celda": "D20",
            "nombre": "Polea 1 (Vertical)"
          },
          {
            "celda": "F20",
            "nombre": "Polea 2 (Vertical)"
          },
          {
            "celda": "D21",
            "nombre": "Polea 3 (Vertical)"
          }
        ]
      },
      {
        "titulo": "Subida · bananas desviación horizontal",
        "filaExcel": 22,
        "poleas": [
          {
            "celda": "D23",
            "nombre": "Polea 1 (Banana 1)"
          },
          {
            "celda": "F23",
            "nombre": "Polea 2 (Banana 1)"
          },
          {
            "celda": "D24",
            "nombre": "Polea 3 (Banana 1)"
          },
          {
            "celda": "F24",
            "nombre": "Polea 4 (Banana 1)"
          },
          {
            "celda": "D25",
            "nombre": "Polea 5 (Banana 1)"
          },
          {
            "celda": "F25",
            "nombre": "Polea 1 (Banana 2)"
          },
          {
            "celda": "D26",
            "nombre": "Polea 2 (Banana 2)"
          },
          {
            "celda": "F26",
            "nombre": "Polea 3 (Banana 2)"
          },
          {
            "celda": "D27",
            "nombre": "Polea 4 (Banana 2)"
          },
          {
            "celda": "F27",
            "nombre": "Polea 5 (Banana 2)"
          }
        ]
      },
      {
        "titulo": "Subida · desviación salida",
        "filaExcel": 28,
        "poleas": [
          {
            "celda": "D29",
            "nombre": "Polea 1 (Vertical)"
          },
          {
            "celda": "F29",
            "nombre": "Polea 2 (Vertical)"
          },
          {
            "celda": "D30",
            "nombre": "Polea 3 (Vertical)"
          },
          {
            "celda": "F30",
            "nombre": "Polea 1 (Horizontal)"
          },
          {
            "celda": "D31",
            "nombre": "Polea 2 (Horizontal)"
          },
          {
            "celda": "F31",
            "nombre": "Polea 3 (Horizontal)"
          },
          {
            "celda": "D32",
            "nombre": "Polea 4 (Horizontal)"
          }
        ]
      },
      {
        "titulo": "Subida · poleas de salida",
        "filaExcel": 33,
        "poleas": [
          {
            "celda": "D34",
            "nombre": "Polea 1 (Balancín salida)"
          },
          {
            "celda": "F34",
            "nombre": "Polea 2 (Balancín salida)"
          },
          {
            "celda": "D35",
            "nombre": "Polea 3 (Balancín salida)"
          },
          {
            "celda": "F35",
            "nombre": "Polea 4 (Balancín salida)"
          },
          {
            "celda": "D36",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F36",
            "nombre": "Polea 6 S/A"
          },
          {
            "celda": "D37",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F37",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D38",
            "nombre": "Polea 9 S/A"
          },
          {
            "celda": "F38",
            "nombre": "Polea 10 S/A (Desviación horizontal)"
          }
        ]
      },
      {
        "titulo": "Bajada · poleas de entrada",
        "filaExcel": 39,
        "poleas": [
          {
            "celda": "D40",
            "nombre": "Polea 1 (Balancín entrada)"
          },
          {
            "celda": "F40",
            "nombre": "Polea 2 (Balancín entrada)"
          },
          {
            "celda": "D41",
            "nombre": "Polea 3 (Balancín entrada)"
          },
          {
            "celda": "F41",
            "nombre": "Polea 4 (Balancín entrada)"
          },
          {
            "celda": "D42",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F42",
            "nombre": "Polea 6 E/D"
          },
          {
            "celda": "D43",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F43",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D44",
            "nombre": "Polea 9 E/D"
          },
          {
            "celda": "F44",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      },
      {
        "titulo": "Bajada · desviación entrada",
        "filaExcel": 45,
        "poleas": [
          {
            "celda": "D46",
            "nombre": "Polea 1 (Vertical)"
          },
          {
            "celda": "F46",
            "nombre": "Polea 2 (Vertical)"
          },
          {
            "celda": "D47",
            "nombre": "Polea 3 (Vertical)"
          }
        ]
      },
      {
        "titulo": "Bajada · bananas desviación horizontal",
        "filaExcel": 48,
        "poleas": [
          {
            "celda": "D49",
            "nombre": "Polea 1 (Banana 1)"
          },
          {
            "celda": "F49",
            "nombre": "Polea 2 (Banana 1)"
          },
          {
            "celda": "D50",
            "nombre": "Polea 3 (Banana 1)"
          },
          {
            "celda": "F50",
            "nombre": "Polea 4 (Banana 1)"
          },
          {
            "celda": "D51",
            "nombre": "Polea 5 (Banana 1)"
          },
          {
            "celda": "F51",
            "nombre": "Polea 6 (Banana 1)"
          },
          {
            "celda": "D52",
            "nombre": "Polea 1 (Banana 2)"
          },
          {
            "celda": "F52",
            "nombre": "Polea 2 (Banana 2)"
          },
          {
            "celda": "D53",
            "nombre": "Polea 3 (Banana 2)"
          },
          {
            "celda": "F53",
            "nombre": "Polea 4 (Banana 2)"
          },
          {
            "celda": "D54",
            "nombre": "Polea 5 (Banana 2)"
          },
          {
            "celda": "F54",
            "nombre": "Polea 1 (Banana 3)"
          },
          {
            "celda": "D55",
            "nombre": "Polea 2 (Banana 3)"
          },
          {
            "celda": "F55",
            "nombre": "Polea 3 (Banana 3)"
          },
          {
            "celda": "D56",
            "nombre": "Polea 4 (Banana 3)"
          },
          {
            "celda": "F56",
            "nombre": "Polea 5 (Banana 3)"
          },
          {
            "celda": "D57",
            "nombre": "Polea 6 (Banana 3)"
          }
        ]
      },
      {
        "titulo": "Bajada · desviación salida",
        "filaExcel": 58,
        "poleas": [
          {
            "celda": "D59",
            "nombre": "Polea 1 (Vertical)"
          },
          {
            "celda": "F59",
            "nombre": "Polea 2 (Vertical)"
          },
          {
            "celda": "D60",
            "nombre": "Polea 3 (Vertical)"
          }
        ]
      },
      {
        "titulo": "Bajada · poleas de salida",
        "filaExcel": 61,
        "poleas": [
          {
            "celda": "D62",
            "nombre": "Polea 1 (Balancín salida)"
          },
          {
            "celda": "F62",
            "nombre": "Polea 2 (Balancín salida)"
          },
          {
            "celda": "D63",
            "nombre": "Polea 3 (Balancín salida)"
          },
          {
            "celda": "F63",
            "nombre": "Polea 4 (Balancín salida)"
          },
          {
            "celda": "D64",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F64",
            "nombre": "Polea 6 S/D"
          },
          {
            "celda": "D65",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F65",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D66",
            "nombre": "Polea 9 S/D"
          },
          {
            "celda": "F66",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      }
    ]
  },
  {
    "id": "cumbre",
    "nombre": "Cumbre",
    "hojaExcel": "Cumbre",
    "secciones": [
      {
        "titulo": "Volante principal",
        "filaExcel": 8,
        "poleas": [
          {
            "celda": "D9",
            "nombre": "Rodamiento Superior"
          },
          {
            "celda": "F9",
            "nombre": "Guarnición"
          },
          {
            "celda": "D10",
            "nombre": "Rodamiento Inferior"
          }
        ]
      },
      {
        "titulo": "Poleas de entrada",
        "filaExcel": 11,
        "poleas": [
          {
            "celda": "D12",
            "nombre": "Polea 1 (Balancín entrada)"
          },
          {
            "celda": "F12",
            "nombre": "Polea 2 (Balancín entrada)"
          },
          {
            "celda": "D13",
            "nombre": "Polea 3 (Balancín entrada)"
          },
          {
            "celda": "F13",
            "nombre": "Polea 4 (Balancín entrada)"
          },
          {
            "celda": "D14",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F14",
            "nombre": "Polea 6E"
          },
          {
            "celda": "D15",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F15",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D16",
            "nombre": "Polea 9E"
          },
          {
            "celda": "F16",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      },
      {
        "titulo": "Poleas de salida",
        "filaExcel": 17,
        "poleas": [
          {
            "celda": "D18",
            "nombre": "Polea 1 (Balancín salida)"
          },
          {
            "celda": "F18",
            "nombre": "Polea 2 (Balancín salida)"
          },
          {
            "celda": "D19",
            "nombre": "Polea 3 (Balancín salida)"
          },
          {
            "celda": "F19",
            "nombre": "Polea 4 (Balancín salida)"
          },
          {
            "celda": "D20",
            "nombre": "Polea 5 (Altura cable, \"Gálibo A\")"
          },
          {
            "celda": "F20",
            "nombre": "Polea 6S"
          },
          {
            "celda": "D21",
            "nombre": "Polea 7 (Toma de movimiento)"
          },
          {
            "celda": "F21",
            "nombre": "Polea 8 (Toma de movimiento)"
          },
          {
            "celda": "D22",
            "nombre": "Polea 9S"
          },
          {
            "celda": "F22",
            "nombre": "Polea 10 (Desviación horizontal)"
          }
        ]
      }
    ]
  }
];
