# 🎨 ArteRápida - Jogo de Desenho Online 2.5

**ArteRápida** é um jogo de desenho online multiplayer onde os jogadores se divertem desenhando e adivinhando palavras em tempo real!

## ✨ Funcionalidades

### 🎮 **Funcionalidades Principais**
- **Multijogador em tempo real** - Até 8 jogadores por sala
- **Sistema de rondas personalizável** - 1 a 10 rondas por partida
- **3 níveis de dificuldade** - Fácil, Médio e Difícil
- **Canvas responsivo** - Funciona perfeitamente em móvel e desktop
- **Sistema de pontuação inteligente** - Pontos baseados no tempo de resposta
- **Partilha fácil de salas** - QR Code, WhatsApp e links diretos

### 🚀 **Novas Melhorias v2.5**

#### 🏆 **Sistema de Conquistas e Níveis**
- **Sistema de XP** com 7 níveis diferentes
- **8 conquistas diferentes** (Bronze, Prata, Ouro, Platina)
- **Gamificação completa** para manter jogadores engajados
- **Progressão visual** com barras de progresso e recompensas
- **Modal de conquistas** com animações

#### 🎨 **Canvas Avançado**
- **Ferramentas múltiplas** - Caneta, Pincel, Marcador, Borracha
- **Suporte para pressão** - Stylus e 3D Touch
- **Cores personalizáveis** e tamanhos de pincel
- **Desenho suave** com curvas quadráticas
- **Performance otimizada** com debounce e cache

#### 📊 **Estatísticas Detalhadas**
- **Tabs organizadas** - Ranking, Histórico, Estatísticas
- **Métricas avançadas** - Tempo médio, streak, taxa de sucesso
- **Histórico completo** de palavras por ronda
- **Análise de performance** individual e geral
- **Destaques da partida** com recordes

#### 🛡️ **Sistema de Moderação**
- **Filtro de palavrões** automático
- **Detecção de spam** com rate limiting
- **Sistema anti-spoiler** impede revelar palavras
- **Advertências progressivas** com banimento temporário
- **Moderação de nomes** de usuários

#### ⚡ **Performance e Otimização**
- **Sistema de cache** em memória para salas
- **Rate limiting avançado** para diferentes ações
- **Lógica de jogo separada** em módulos
- **Gestão de timers** melhorada
- **Cleanup automático** de salas inativas

#### 🎯 **Sistema de Categorias** (Em Implementação)
- **7 categorias temáticas**: Animais, Comida, Profissões, Objetos, Lugares, Transporte, Tecnologia
- **600+ palavras** organizadas por categoria e dificuldade
- **Seleção de categoria** na criação de salas
- **Palavras personalizadas** por sala

### 🎨 **Funcionalidades de Desenho**
- **Canvas adaptativo** que se ajusta ao tamanho da tela
- **Suporte completo a touch** para dispositivos móveis
- **Sincronização em tempo real** dos desenhos
- **Múltiplas ferramentas** de desenho
- **Cursor personalizado** para melhor experiência

## 🔧 Instalação e Execução

### Pré-requisitos
- Node.js 16+
- npm ou yarn

### 1. **Instalação das Dependências**
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. **Execução em Desenvolvimento**
```bash
# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2)
cd frontend
npm run dev
```

### 3. **Execução em Produção**
```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** com Express
- **Socket.IO** para comunicação em tempo real
- **Sistema de Cache** em memória
- **Rate Limiting** com rate-limiter-flexible
- **Moderação automática** com filtros
- **Helmet** para segurança
- **Compression** para otimização

### Frontend
- **React 18** com TypeScript
- **React Router** para navegação
- **Socket.IO Client** para comunicação
- **Tailwind CSS** para estilização
- **Canvas API** para desenho
- **Vite** como bundler
- **Sistema de conquistas** personalizado

## 📚 Estrutura do Projeto

```
arteRapida/
├── backend/
│   ├── src/
│   │   ├── index.js          # Servidor principal
│   │   │   ├── words.js          # Sistema de palavras
│   │   │   ├── gameLogic.js      # Lógica do jogo
│   │   │   ├── cache.js          # Sistema de cache
│   │   │   ├── moderation.js     # Sistema de moderação
│   │   │   └── rateLimiter.js    # Rate limiting
│   │   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx          # Canvas avançado
│   │   │   ├── GameStats.tsx       # Estatísticas
│   │   │   └── AchievementSystem.tsx # Conquistas
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── CriarSala.tsx
│   │   │   ├── EntrarSala.tsx
│   │   │   └── Sala.tsx
│   │   └── services/
│   │       └── socket.ts
│   └── package.json
└── README.md
```

## 🎯 Melhorias Implementadas

### **Performance & Segurança**
- ✅ **Cache em memória** para salas ativas
- ✅ **Rate limiting** para diferentes ações
- ✅ **Sistema de moderação** automática
- ✅ **Limpeza automática** de recursos
- ✅ **Validação robusta** de entrada

### **UX/UI Avançada**
- ✅ **Canvas profissional** com múltiplas ferramentas
- ✅ **Estatísticas detalhadas** com tabs
- ✅ **Sistema de conquistas** gamificado
- ✅ **Responsividade total** mobile/desktop
- ✅ **Animações suaves** e transições

### **Funcionalidades do Jogo**
- ✅ **600+ palavras** organizadas por categoria
- ✅ **Sistema de níveis** com progressão
- ✅ **Histórico completo** de partidas
- ✅ **Métricas avançadas** de performance
- ✅ **Anti-cheat** e moderação

## 🚀 Próximas Funcionalidades

### 🔮 **Em Desenvolvimento**
- **Seleção de categorias** na criação de salas
- **Modo espectador** para assistir partidas
- **Salas privadas** com senha
- **Sistema de amigos** e convites
- **Replay de partidas** com gravação
- **Torneios** e competições

### 🌟 **Ideias Futuras**
- **IA para avaliar desenhos** e dar dicas
- **Modo colaborativo** (desenho em equipe)
- **Integração com redes sociais**
- **Sistema de clãs** e guildas
- **Marketplace** de temas e pincéis
- **Modo offline** com IA

## 📊 Estatísticas do Projeto

- **Versão atual**: 2.5
- **Linhas de código**: ~5000+
- **Componentes React**: 15+
- **Palavras disponíveis**: 600+ em 7 categorias
- **Níveis de conquista**: 7 níveis
- **Tipos de conquista**: 4 (Bronze, Prata, Ouro, Platina)
- **Ferramentas de desenho**: 4 tipos
- **Rate limiters**: 7 diferentes
- **Sistemas de cache**: 3 tipos

## 🔒 Segurança

- **CORS configurado** para domínios específicos
- **Rate limiting** em todas as ações
- **Validação de entrada** robusta
- **Moderação automática** de conteúdo
- **Sanitização** de dados do usuário
- **Prevenção de XSS** e injeções

## 📱 Compatibilidade

- ✅ **Desktop** (Chrome, Firefox, Safari, Edge)
- ✅ **Tablet** (iOS Safari, Chrome Android)
- ✅ **Smartphone** (iOS, Android)
- ✅ **PWA Ready** (pode ser instalado como app)
- ✅ **Touch e stylus** totalmente suportados

## 🤝 Contribuição

Contribuições são bem-vindas! Siga estes passos:

1. Faça fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 👨‍💻 Desenvolvedor

**Dev Rui Valentim**
- GitHub: [@ruivalentim](https://github.com/ruivalentim)
- Email: rui.valentim@email.com

---

## 🎨 Como Jogar

### 1. **Criar uma Sala**
- Escolha seu nome de usuário
- Defina o número de rondas (1-10)
- Selecione a dificuldade
- Compartilhe o código da sala

### 2. **Durante o Jogo**
- **Se você é o desenhista**: Use as ferramentas para desenhar a palavra
- **Se você está adivinhando**: Digite seus palpites no chat
- **Ganhe XP**: Complete conquistas e suba de nível
- **Acompanhe stats**: Veja seu progresso em tempo real

### 3. **Sistema de Pontuação e XP**
- **Quem acerta**: 10 pontos + bônus por tempo
- **Desenhista**: 5 pontos quando alguém acerta
- **XP por conquistas**: 50-1000 XP dependendo da dificuldade
- **Níveis**: 7 níveis com recompensas exclusivas

---

© 2025 ArteRápida v2.5 - Desenvolvido por Dev Rui Valentim

**Desenha, Adivinha, Conquista! 🎨✨🏆** 