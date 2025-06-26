import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CriarSala from './pages/CriarSala';
import EntrarSala from './pages/EntrarSala';
import Sala from './pages/Sala';
import SalasPublicas from './pages/SalasPublicas';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/criar-sala" element={<CriarSala />} />
        <Route path="/entrar-sala" element={<EntrarSala />} />
        <Route path="/entrar-sala/:roomCode" element={<EntrarSala />} />
        <Route path="/salas-publicas" element={<SalasPublicas />} />
        <Route path="/sala/:roomCode" element={<Sala />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App; 