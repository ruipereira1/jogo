# 📝 Como Adicionar Palavras ao ArteRápida

Este guia explica como adicionar novas palavras ao jogo ArteRápida de forma simples e organizada.

## 📁 Localização das Palavras

As palavras estão organizadas no ficheiro `backend/src/words.js` em categorias e níveis de dificuldade.

## 🏷️ Categorias Disponíveis

O jogo tem as seguintes categorias:

- **ANIMAIS** - Cães, gatos, animais selvagens, aves, peixes, etc.
- **COMIDA** - Frutas, pratos típicos, bebidas, ingredientes, etc.
- **PROFISSOES** - Médicos, professores, engenheiros, etc.
- **OBJETOS** - Móveis, eletrodomésticos, ferramentas, etc.
- **LUGARES** - Cidades, edifícios, locais públicos, etc.
- **TRANSPORTE** - Carros, aviões, barcos, etc.
- **TECNOLOGIA** - Computadores, smartphones, software, etc.

## 📊 Níveis de Dificuldade

Cada categoria tem 3 níveis:

### 🟢 **FÁCIL**
- Palavras simples e conhecidas por todos
- 3-8 letras geralmente
- Exemplos: `cão`, `casa`, `sol`, `pão`

### 🟡 **MÉDIO**
- Palavras um pouco mais complexas
- 6-15 letras geralmente
- Exemplos: `bicicleta`, `hospital`, `guitarra`

### 🔴 **DIFÍCIL**
- Palavras complexas, técnicas ou muito longas
- 10+ letras geralmente
- Exemplos: `microscópio`, `otorrinolaringologista`

## ✅ Como Adicionar Palavras

### 1. Abrir o ficheiro
Edite o ficheiro `backend/src/words.js`

### 2. Encontrar a categoria desejada
Procure por `CATEGORIES` e navegue até à categoria desejada:

```javascript
ANIMAIS: {
  facil: [
    'cão', 'gato', // ... palavras existentes
    'NOVA_PALAVRA_AQUI' // ← Adicione aqui
  ],
  // ...
}
```

### 3. Adicionar a palavra
Simplesmente adicione a nova palavra dentro das aspas, separada por vírgula:

```javascript
facil: [
  'cão', 'gato', 'cavalo',
  'hamster', // ← Nova palavra adicionada
  'coelho'
]
```

## 💡 Exemplos Práticos

### Adicionar animais fáceis:
```javascript
ANIMAIS: {
  facil: [
    'cão', 'gato', 'pato', 'peixe',
    'hamster', 'papagaio', 'pinguim' // ← Novas palavras
  ]
}
```

### Adicionar comida média:
```javascript
COMIDA: {
  medio: [
    'francesinha', 'bacalhau', 'pastel',
    'bifana', 'caldo-verde', 'pastéis-de-nata' // ← Novas palavras
  ]
}
```

### Adicionar tecnologia difícil:
```javascript
TECNOLOGIA: {
  dificil: [
    'blockchain', 'machine-learning',
    'cibersegurança', 'nanotecnologia' // ← Novas palavras
  ]
}
```

## 📋 Regras Importantes

### ✅ **FAZER:**
- Usar apenas palavras em **português de Portugal**
- Manter a categoria apropriada (animal em ANIMAIS, etc.)
- Seguir o nível de dificuldade correto
- Usar aspas simples: `'palavra'`
- Separar palavras com vírgulas: `'palavra1', 'palavra2'`
- Testar se a palavra desenha bem (não muito abstrata)

### ❌ **EVITAR:**
- Palavras muito abstratas (`amor`, `felicidade`)
- Nomes próprios específicos (`João`, `Lisboa` - exceto se apropriado)
- Palavras ofensivas ou inadequadas
- Palavras em outras línguas
- Duplicatas na mesma categoria
- Palavras impossíveis de desenhar

## 🔄 Aplicar Mudanças

Após adicionar palavras:

1. **Guardar o ficheiro** `words.js`
2. **Reiniciar o servidor backend** (se estiver a correr)
3. **Testar** criando uma nova sala no jogo

## 📈 Estatísticas Atuais

O jogo atualmente tem:

### Fácil: ~70 palavras
- Animais: 42 palavras
- Comida: 36 palavras  
- Objetos: 31 palavras
- E mais...

### Médio: ~75 palavras
- Profissões: 25 palavras
- Lugares: 25 palavras
- Instrumentos: 20 palavras
- E mais...

### Difícil: ~75 palavras
- Medicina: 20 palavras
- Ciência: 30 palavras
- Filosofia: 25 palavras
- E mais...

## 🆕 Adicionar Nova Categoria

Para criar uma nova categoria (ex: DESPORTOS):

```javascript
DESPORTOS: {
  facil: [
    'futebol', 'ténis', 'natação', 'corrida'
  ],
  medio: [
    'basquetebol', 'voleibol', 'atletismo'
  ],
  dificil: [
    'badminton', 'esgrima', 'pentatlo'
  ]
},
```

**Não esquecer de atualizar as listas combinadas no final do ficheiro!**

## 🔍 Verificar Palavras

Antes de adicionar, verifique se:
- [ ] A palavra ainda não existe na categoria
- [ ] É possível desenhar visualmente
- [ ] Está no nível de dificuldade correto
- [ ] Está em português de Portugal

## 📞 Suporte

Se tiver dúvidas sobre:
- Qual categoria usar
- Nível de dificuldade apropriado  
- Como testar as palavras

Crie uma issue no repositório do projeto!

---

**Contribua para tornar o ArteRápida ainda mais divertido! 🎨🎮** 