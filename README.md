# 🎨 ArteRápida - Jogo de Desenho Online

**ArteRápida** é um jogo de desenho online multiplayer onde os jogadores se divertem desenhando e adivinhando palavras em tempo real!

## ✨ Funcionalidades

### 🎮 **Funcionalidades Principais**
- **Multijogador em tempo real** - Até 8 jogadores por sala
- **Sistema de rondas personalizável** - 1 a 10 rondas por partida
- **3 níveis de dificuldade** - Fácil, Médio e Difícil
- **Canvas responsivo** - Funciona perfeitamente em móvel e desktop
- **Sistema de pontuação inteligente** - Pontos baseados no tempo de resposta
- **Partilha fácil de salas** - QR Code, WhatsApp e links diretos

### 🚀 **Melhorias Recentes v2.0**

#### 💡 **Sistema de Dicas Progressivas**
- **40s restantes**: Mostra o número de letras
- **25s restantes**: Revela a primeira letra
- **10s restantes**: Mostra uma letra aleatória
- Ajuda os jogadores quando o tempo está acabando

#### 💬 **Chat Durante o Jogo**
- Chat em tempo real entre jogadores
- Não interfere com os palpites
- Histórico de mensagens com timestamps
- Contador de mensagens no botão

#### 📚 **Histórico de Palavras**
- Veja todas as palavras das rondas anteriores
- Quem desenhou cada palavra
- Lista de quem acertou cada palavra
- Perfeito para revisar a partida

#### 🔄 **Sistema de Reconexão Automática**
- Reconexão automática em caso de queda de conexão
- Indicador visual do status da conexão
- Reentrada automática na sala após reconexão

#### 🎯 **Melhorias de UX/UI**
- **Animações suaves** e transições melhoradas
- **Indicadores visuais** de status de conexão
- **Botões com emojis** para melhor usabilidade
- **Layout mais responsivo** para todos os dispositivos
- **Toast notifications** para feedback instantâneo

#### 🛡️ **Melhorias de Robustez**
- **Salas persistentes** - Não são deletadas imediatamente quando vazias
- **Melhor tratamento** quando o desenhista sai
- **Validação robusta** de rondas e parâmetros
- **Sistema anti-spoiler** no chat (impede revelar a palavra)

### 🎨 **Funcionalidades de Desenho**
- **Canvas adaptativo** que se ajusta ao tamanho da tela
- **Suporte completo a touch** para dispositivos móveis
- **Sincronização em tempo real** dos desenhos
- **Função limpar canvas** para recomeçar
- **Cursor personalizado** para melhor experiência

## 🚀 Como Jogar

### 1. **Criar uma Sala**
- Escolha seu nome de usuário
- Defina o número de rondas (1-10)
- Selecione a dificuldade
- Compartilhe o código da sala

### 2. **Durante o Jogo**
- **Se você é o desenhista**: Desenhe a palavra que apareceu para você
- **Se você está adivinhando**: Digite seus palpites no chat
- **Use o chat** para se comunicar com outros jogadores
- **Acompanhe as dicas** que aparecem conforme o tempo passa

### 3. **Sistema de Pontuação**
- **Quem acerta**: 10 pontos + bônus por tempo restante
- **Desenhista**: 5 pontos quando alguém acerta
- **Classificação final** ao fim de todas as rondas

## 📱 Compatibilidade

- ✅ **Desktop** (Chrome, Firefox, Safari, Edge)
- ✅ **Tablet** (iOS Safari, Chrome Android)
- ✅ **Smartphone** (iOS, Android)
- ✅ **PWA Ready** (pode ser instalado como app)

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** com TypeScript
- **React Router** para navegação
- **Socket.IO Client** para comunicação em tempo real
- **Tailwind CSS** para estilização responsiva
- **Vite** como bundler e dev server

### Backend
- **Node.js** com Express
- **Socket.IO** para comunicação WebSocket
- **CORS** habilitado para múltiplos domínios
- **Sistema de salas em memória** com limpeza automática

## 🔧 Instalação e Execução

### Pré-requisitos
- Node.js 16+
- npm ou yarn

### 1. **Backend**
```bash
cd backend
npm install
npm start
```
O servidor será iniciado na porta 4000.

### 2. **Frontend**
```bash
cd frontend
npm install
npm run dev    # Para desenvolvimento
npm run build  # Para produção
```

### 3. **Variáveis de Ambiente**
O backend aceita conexões de:
- `https://desenharapido.netlify.app` (produção)
- `http://localhost:3000`
- `http://localhost:5173`

## 🎯 Próximas Funcionalidades

### 🔮 **Em Desenvolvimento**
- **Categorias temáticas** (Animais, Comida, Desporto, etc.)
- **Modo espectador** para assistir partidas
- **Sistema de níveis** e ranking global
- **Palavras personalizadas** pelos jogadores
- **Efeitos sonoros** e música de fundo
- **Modo torneio** com eliminatórias

### 🌟 **Ideias Futuras**
- **Integração com redes sociais**
- **Replay de partidas**
- **Modo colaborativo** (desenho em equipa)
- **IA para avaliar desenhos**
- **Salas privadas** com senha
- **Sistema de conquistas**

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

## 📊 Estatísticas do Projeto

- **Versão atual**: 2.0
- **Linhas de código**: ~2000+
- **Idioma**: Português de Portugal
- **Palavras disponíveis**: 100+ em 3 níveis
- **Tempo médio de partida**: 5-15 minutos
- **Jogadores simultâneos**: Até 8 por sala

---

© 2025 ArteRápida - Desenvolvido por Dev Rui Valentim

**Diverte-te desenhando! 🎨✨** 