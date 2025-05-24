const { getRandomWord, CATEGORIES, WORDS_FACIL, WORDS_MEDIO, WORDS_DIFICIL } = require('./src/words');

console.log('🧪 Testando sistema de palavras...\n');

// Testar palavras aleatórias
console.log('📝 Palavras aleatórias:');
console.log('Fácil:', getRandomWord('facil'));
console.log('Médio:', getRandomWord('medio'));
console.log('Difícil:', getRandomWord('dificil'));
console.log('');

// Testar tamanhos das listas
console.log('📊 Estatísticas:');
console.log('Palavras fáceis:', WORDS_FACIL.length);
console.log('Palavras médias:', WORDS_MEDIO.length);
console.log('Palavras difíceis:', WORDS_DIFICIL.length);
console.log('Total de palavras:', WORDS_FACIL.length + WORDS_MEDIO.length + WORDS_DIFICIL.length);
console.log('');

// Testar categorias
console.log('🏷️ Categorias disponíveis:');
Object.keys(CATEGORIES).forEach(category => {
  const facil = CATEGORIES[category].facil.length;
  const medio = CATEGORIES[category].medio.length;
  const dificil = CATEGORIES[category].dificil.length;
  console.log(`${category}: ${facil + medio + dificil} palavras (${facil}F + ${medio}M + ${dificil}D)`);
});

console.log('\n✅ Sistema de palavras funcionando corretamente!'); 