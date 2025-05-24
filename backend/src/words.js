// Banco de palavras organizado por categorias e dificuldades
// Para adicionar novas palavras, basta adicionar aos arrays correspondentes

const CATEGORIES = {
  ANIMAIS: {
    facil: [
      'cão', 'gato', 'pato', 'peixe', 'cavalo', 'vaca', 'porco', 'galinha', 'ovelha', 'burro', 'cabra', 'coelho', 'rato', 'leão', 'tigre', 'urso', 'elefante', 'macaco', 'zebra', 'girafa', 'golfinho', 'tubarão', 'águia', 'coruja', 'pombo', 'cobra', 'sapo', 'borboleta', 'abelha', 'aranha', 'mosca', 'caracol', 'polvo', 'caranguejo', 'tartaruga', 'pinguim', 'canguru', 'rato', 'esquilo', 'raposa', 'lobo'
    ],
    medio: [
      'baleia', 'tartaruga', 'escorpião', 'bicharoco', 'crocodilo', 'hipopótamo', 'rinoceronte', 'chimpanzé', 'orangotango', 'gorila', 'leopardo', 'jaguar', 'puma', 'lince', 'hiena', 'chacal', 'mangusto', 'suricata', 'castor', 'lontra', 'foca', 'morsa', 'orca', 'cachalote', 'tubarão-branco', 'raia', 'enguia', 'salmão', 'bacalhau', 'atum', 'sardinha', 'linguado', 'corvina', 'dourada', 'robalo', 'garoupa'
    ],
    dificil: [
      'ornitorrinco', 'escaravelho', 'anfíbio', 'canguru', 'axolotl', 'quetzal', 'tucano', 'flamingo', 'pelicano', 'albatroz', 'colibri', 'beija-flor', 'andorinha', 'rouxinol', 'canário', 'papagaio', 'arara', 'cacatua', 'periquito', 'catatua', 'faisão', 'pavão', 'cisne', 'pato-real', 'ganso', 'marreco', 'mergulhão', 'cormorão', 'garça', 'cegonha', 'íbis', 'espátula', 'flamingo', 'avestruz', 'emu', 'casuar', 'kiwi', 'moa'
    ]
  },
  
  COMIDA: {
    facil: [
      'pão', 'leite', 'ovos', 'manteiga', 'queijo', 'iogurte', 'mel', 'açúcar', 'sal', 'arroz', 'massa', 'batata', 'cenoura', 'tomate', 'alface', 'cebola', 'alho', 'limão', 'laranja', 'maçã', 'banana', 'uvas', 'morango', 'pêssego', 'pêra', 'melão', 'melancia', 'abacaxi', 'kiwi', 'ameixa', 'cereja', 'café', 'chá', 'água', 'sumo'
    ],
    medio: [
      'pastel', 'francesinha', 'bacalhau', 'pequeno-almoço', 'bolacha', 'croissant', 'tosta', 'sanduíche', 'hambúrguer', 'pizza', 'esparguete', 'lasanha', 'risotto', 'paella', 'sushi', 'tempura', 'curry', 'chili', 'tacos', 'burrito', 'nachos', 'quesadilla', 'guacamole', 'hummus', 'tzatziki', 'bruschetta', 'carpaccio', 'ceviche', 'sashimi', 'maki'
    ],
    dificil: [
      'bouillabaisse', 'ratatouille', 'coq-au-vin', 'beef-wellington', 'foie-gras', 'escargots', 'crème-brûlée', 'soufflé', 'tarte-tatin', 'mille-feuille', 'profiteroles', 'macarons', 'financiers', 'madeleines', 'cannelés', 'kouign-amann', 'croquembouche', 'charlotte', 'baba-au-rhum', 'paris-brest', 'saint-honoré', 'opéra', 'fraisier', 'alheira', 'chouriço', 'morcela', 'farinheira', 'linguiça', 'paio', 'presunto'
    ]
  },
  
  PROFISSOES: {
    facil: [
      'professor', 'médico', 'enfermeiro', 'bombeiro', 'polícia', 'padeiro', 'cozinheiro', 'empregado', 'pintor', 'músico', 'dentista', 'veterinário', 'motorista', 'piloto', 'marinheiro', 'soldado', 'agricultor', 'pescador', 'construtor', 'pedreiro'
    ],
    medio: [
      'carpinteiro', 'electricista', 'canalizador', 'mecânico', 'jardineiro', 'advogado', 'arquiteto', 'engenheiro', 'farmacêutico', 'jornalista', 'fotógrafo', 'actor', 'escritor', 'designer', 'programador', 'contabilista', 'economista', 'psicólogo', 'sociólogo', 'antropólogo'
    ],
    dificil: [
      'otorrinolaringologista', 'neurocirurgião', 'anestesiologista', 'radiologista', 'patologista', 'cardiologista', 'neurologista', 'psiquiatra', 'gastroenterologista', 'endocrinologista', 'reumatologista', 'oncologista', 'hematologista', 'pneumologista', 'urologista', 'ginecologista', 'obstetra', 'pediatra', 'geriatra', 'dermatologista'
    ]
  },
  
  OBJETOS: {
    facil: [
      'mesa', 'cadeira', 'cama', 'sofá', 'armário', 'gaveta', 'porta', 'janela', 'escada', 'espelho', 'relógio', 'chave', 'mala', 'carteira', 'óculos', 'chapéu', 'sapato', 'meia', 'camisa', 'calça', 'vestido', 'saia', 'casaco', 'luva', 'cachecol', 'cinto', 'gravata', 'colar', 'anel', 'brinco'
    ],
    medio: [
      'guarda-chuva', 'escova', 'pente', 'toalha', 'almofada', 'cobertor', 'lençol', 'travesseiro', 'frigorífico', 'fogão', 'forno', 'máquina', 'aspirador', 'ferro', 'microondas', 'torradeira', 'chaleira', 'liquidificador', 'batedeira', 'cafeteira'
    ],
    dificil: [
      'paralelepípedo', 'microscópio', 'estetoscópio', 'candelabro', 'ampulheta', 'bumerangue', 'escafandro', 'periscópio', 'telescópio', 'caleidoscópio', 'estetoscópio', 'termómetro', 'barómetro', 'higrómetro', 'cronómetro', 'podómetro', 'velocímetro', 'odómetro', 'altímetro', 'sismógrafo'
    ]
  },
  
  LUGARES: {
    facil: [
      'casa', 'escola', 'hospital', 'loja', 'parque', 'praia', 'cidade', 'vila', 'aldeia', 'rua', 'avenida', 'praça', 'jardim', 'bosque', 'floresta', 'montanha', 'rio', 'lago', 'mar', 'oceano'
    ],
    medio: [
      'biblioteca', 'universidade', 'restaurante', 'supermercado', 'padaria', 'farmácia', 'banco', 'correios', 'estação', 'aeroporto', 'museu', 'teatro', 'cinema', 'cemitério', 'igreja', 'castelo', 'ponte', 'torre', 'fábrica', 'escritório', 'laboratório'
    ],
    dificil: [
      'observatório', 'planetário', 'mausoléu', 'anfiteatro', 'coliseu', 'panteão', 'basílica', 'catedral', 'mosteiro', 'convento', 'seminário', 'santuário', 'templo', 'pagode', 'sinagoga', 'mesquita', 'ashram', 'monastério', 'abadia', 'priorado'
    ]
  },
  
  TRANSPORTE: {
    facil: [
      'carro', 'mota', 'bicicleta', 'autocarro', 'comboio', 'metro', 'elétrico', 'avião', 'barco', 'navio', 'camião', 'ambulância', 'táxi', 'carrinha', 'scooter'
    ],
    medio: [
      'helicóptero', 'foguetão', 'submarino', 'iate', 'veleiro', 'canoa', 'kayak', 'jangada', 'teleférico', 'funicular', 'monorail', 'tram', 'trolley', 'segway', 'patins'
    ],
    dificil: [
      'dirigível', 'zeppelin', 'planador', 'ultraleve', 'parapente', 'asa-delta', 'hovercraft', 'hidrofólio', 'catamarã', 'trimaran', 'corveta', 'fragata', 'destroier', 'cruzador', 'porta-aviões'
    ]
  },
  
  TECNOLOGIA: {
    facil: [
      'computador', 'telemóvel', 'televisão', 'rádio', 'telefone', 'relógio', 'câmara', 'microfone', 'teclado', 'rato', 'ecrã', 'coluna', 'auscultadores'
    ],
    medio: [
      'tablet', 'smartphone', 'laptop', 'desktop', 'impressora', 'scanner', 'projetor', 'router', 'modem', 'pendrive', 'disco-rígido', 'processador', 'memória', 'placa-gráfica'
    ],
    dificil: [
      'motherboard', 'fonte-alimentação', 'cooler', 'heatsink', 'overclocking', 'firmware', 'hardware', 'software', 'algoritmo', 'blockchain', 'criptomoeda', 'inteligência-artificial', 'machine-learning', 'big-data', 'cloud-computing'
    ]
  }
};

// Lista tradicional combinada (mantém compatibilidade com código existente)
const WORDS_FACIL = [
  ...CATEGORIES.ANIMAIS.facil.slice(0, 15),
  ...CATEGORIES.COMIDA.facil.slice(0, 15),
  ...CATEGORIES.OBJETOS.facil.slice(0, 15),
  ...CATEGORIES.LUGARES.facil.slice(0, 10),
  ...CATEGORIES.TRANSPORTE.facil.slice(0, 8),
  ...CATEGORIES.TECNOLOGIA.facil.slice(0, 7)
];

const WORDS_MEDIO = [
  ...CATEGORIES.ANIMAIS.medio.slice(0, 12),
  ...CATEGORIES.COMIDA.medio.slice(0, 12),
  ...CATEGORIES.OBJETOS.medio.slice(0, 12),
  ...CATEGORIES.LUGARES.medio.slice(0, 12),
  ...CATEGORIES.TRANSPORTE.medio.slice(0, 8),
  ...CATEGORIES.TECNOLOGIA.medio.slice(0, 8),
  ...CATEGORIES.PROFISSOES.medio.slice(0, 6)
];

const WORDS_DIFICIL = [
  ...CATEGORIES.ANIMAIS.dificil.slice(0, 10),
  ...CATEGORIES.COMIDA.dificil.slice(0, 10),
  ...CATEGORIES.OBJETOS.dificil.slice(0, 10),
  ...CATEGORIES.LUGARES.dificil.slice(0, 10),
  ...CATEGORIES.TRANSPORTE.dificil.slice(0, 8),
  ...CATEGORIES.TECNOLOGIA.dificil.slice(0, 8),
  ...CATEGORIES.PROFISSOES.dificil.slice(0, 8),
  // Palavras científicas e complexas
  'microscópio', 'paralelepípedo', 'ornitorrinco', 'helicóptero', 'canguru', 'escaravelho', 'anfíbio', 'estetoscópio', 'circuito', 'criptografia', 'maracujá', 'turbilhão', 'crocodilo', 'escafandro', 'bumerangue', 'trombone', 'saxofone', 'candelabro', 'ampulheta', 'otorrinolaringologista', 'eletrocardiograma', 'descodificador', 'pneumoultramicroscopicossilicovulcanoconiótico', 'hipopotomonstrosesquipedaliofobia', 'descentralização', 'constitucionalidade', 'multidisciplinaridade', 'fotossensibilidade', 'inconstitucionalissimamente'
];

// Função para obter palavras por categoria e dificuldade
function getWordsByCategory(category, difficulty) {
  if (CATEGORIES[category] && CATEGORIES[category][difficulty]) {
    return CATEGORIES[category][difficulty];
  }
  return [];
}

// Função para obter palavra aleatória de uma categoria específica
function getRandomWordFromCategory(category, difficulty) {
  const words = getWordsByCategory(category, difficulty);
  if (words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

// Função para obter palavra aleatória de todas as categorias (atual)
function getRandomWord(difficulty) {
  let wordList = WORDS_FACIL;
  if (difficulty === 'medio') wordList = WORDS_MEDIO;
  if (difficulty === 'dificil') wordList = WORDS_DIFICIL;
  
  return wordList[Math.floor(Math.random() * wordList.length)];
}

// Exportar para uso no servidor
module.exports = {
  CATEGORIES,
  WORDS_FACIL,
  WORDS_MEDIO,
  WORDS_DIFICIL,
  getWordsByCategory,
  getRandomWordFromCategory,
  getRandomWord
}; 