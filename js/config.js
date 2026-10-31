'use strict';
/* =====================================================================
   CONFIGURAÇÃO — edite aqui cultos, modelos, pregadores e endereço.
   Para adicionar um modelo a um culto, copie um bloco dentro de "modelos"
   e troque a chave (ex.: "festivo"), o nome e as cores.
   O cronograma (qual culto cai em qual dia) fica em cultoDoDia(), no app.js.
   ===================================================================== */
const ENDERECO = ['RUA CEARÁ, 219 - SÃO BENEDITO,', 'ALPINÓPOLIS'];

// Cada CULTO tem horário padrão ("hora"), texto "quando" e uma lista de MODELOS.
// "dow" (opcional) = dia da semana fixo quando o culto não está no cronograma mensal.
const CULTOS = {
  familia: { nome: 'Culto da Família', hora: '19:00', quando: 'Domingo · 19h',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DA', big: 'FAMÍLIA', script: 'família', giant: 'LARES',
        th: { bg: '#efe5d8', ink: '#8a3f22', big: '#dcc7b1', giant: '#e2d6c6', glow: 'rgba(255,253,248,.92)', dark: false } },
      noite: { nome: 'Noite', kicker: 'CULTO DA', big: 'FAMÍLIA', script: 'família', giant: 'LARES',
        th: { bg: '#24150f', ink: '#e8a77a', big: '#4a2c20', giant: '#2d1b14', glow: 'rgba(70,40,28,.9)', dark: true } },
    } },
  santaceia: { nome: 'Santa Ceia', hora: '19:00', quando: 'Domingo · 19h',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DE', big: 'SANTA CEIA', script: 'santa ceia', giant: 'COMUNHÃO',
        th: { bg: '#ece3dc', ink: '#7a2332', big: '#d9c2c0', giant: '#e2d4cf', glow: 'rgba(255,252,250,.92)', dark: false } },
      noite: { nome: 'Noite', kicker: 'CULTO DE', big: 'SANTA CEIA', script: 'santa ceia', giant: 'COMUNHÃO',
        th: { bg: '#1f1114', ink: '#d98a96', big: '#47232b', giant: '#2a171b', glow: 'rgba(75,36,45,.9)', dark: true } },
    } },
  missoes: { nome: 'Culto de Missões', hora: '19:00', quando: 'Domingo · 19h',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DE', big: 'MISSÕES', script: 'missões', giant: 'NAÇÕES',
        th: { bg: '#e4e9e4', ink: '#1f5a52', big: '#c5d3cc', giant: '#d6ded8', glow: 'rgba(250,253,251,.92)', dark: false } },
      noite: { nome: 'Noite', kicker: 'CULTO DE', big: 'MISSÕES', script: 'missões', giant: 'NAÇÕES',
        th: { bg: '#10201f', ink: '#8fd1c4', big: '#244541', giant: '#162a28', glow: 'rgba(34,66,62,.9)', dark: true } },
    } },
  adoracao: { nome: 'Culto de Adoração', hora: '19:00', quando: 'Domingo · 19h',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DE', big: 'ADORAÇÃO', script: 'adoração', giant: 'ADORAI',
        th: { bg: '#1d1613', ink: '#dcb57d', big: '#4a392d', giant: '#251c18', glow: 'rgba(60,45,34,.9)', dark: true } },
      claro: { nome: 'Claro', kicker: 'CULTO DE', big: 'ADORAÇÃO', script: 'adoração', giant: 'ADORAI',
        th: { bg: '#f1ebe1', ink: '#8c6431', big: '#e0d2bd', giant: '#e8dfd1', glow: 'rgba(255,253,248,.92)', dark: false } },
    } },
  ensino: { nome: 'Culto de Ensino', hora: '19:30', quando: 'Quarta · 19h30',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DE', big: 'ENSINO', script: 'ensino', giant: 'PALAVRA',
        th: { bg: '#e3e6e9', ink: '#1f3452', big: '#c6cdd7', giant: '#d7dce2', glow: 'rgba(250,251,253,.92)', dark: false } },
      noite: { nome: 'Noite', kicker: 'CULTO DE', big: 'ENSINO', script: 'ensino', giant: 'PALAVRA',
        th: { bg: '#121c2b', ink: '#9fc0ea', big: '#253650', giant: '#172335', glow: 'rgba(35,52,78,.9)', dark: true } },
    } },
  jovens: { nome: 'Culto de Jovens', hora: '19:00', quando: '1ª sexta · 19h',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DE', big: 'JOVENS', script: 'jovens', giant: 'GERAÇÃO',
        th: { bg: '#15181d', ink: '#f2bf57', big: '#323843', giant: '#1b1f25', glow: 'rgba(40,45,54,.92)', dark: true } },
      claro: { nome: 'Claro', kicker: 'CULTO DE', big: 'JOVENS', script: 'jovens', giant: 'GERAÇÃO',
        th: { bg: '#f2efe8', ink: '#c2761b', big: '#e4dccd', giant: '#ebe6dc', glow: 'rgba(255,254,250,.92)', dark: false } },
    } },
  irmas: { nome: 'Culto de Irmãs', hora: '19:00', quando: 'Última sexta · 19h',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CULTO DAS', big: 'IRMÃS', script: 'irmãs', giant: 'MULHERES',
        th: { bg: '#e7e4dd', ink: '#6b3f1a', big: '#d3cabd', giant: '#dcd8cf', glow: 'rgba(255,255,253,.92)', dark: false } },
      rose: { nome: 'Rosé', kicker: 'CULTO DAS', big: 'IRMÃS', script: 'irmãs', giant: 'MULHERES',
        th: { bg: '#f1e4e1', ink: '#8e4552', big: '#e5cfcb', giant: '#ebdcd8', glow: 'rgba(255,251,250,.92)', dark: false } },
    } },
  criancas: { nome: 'Culto das Crianças', hora: '19:00', quando: 'Escolha o dia',
    modelos: {
      claro: { nome: 'Claro', kicker: 'CULTO DAS', big: 'CRIANÇAS', script: 'crianças', giant: 'ALEGRIA',
        th: { bg: '#f6ecd9', ink: '#d1561f', big: '#ecd5ae', giant: '#f0e1c4', glow: 'rgba(255,252,243,.92)', dark: false } },
      azul: { nome: 'Azul', kicker: 'CULTO DAS', big: 'CRIANÇAS', script: 'crianças', giant: 'ALEGRIA',
        th: { bg: '#e2edf4', ink: '#2a6fa8', big: '#c3d7e6', giant: '#d3e2ed', glow: 'rgba(250,253,255,.92)', dark: false } },
    } },
  cafe: { nome: 'Café com Deus', hora: '19:00', quando: 'Escolha o dia',
    modelos: {
      classico: { nome: 'Clássico', kicker: 'CAFÉ COM', big: 'DEUS', script: 'café com Deus', giant: 'INTIMIDADE',
        th: { bg: '#eadfd0', ink: '#5b3a24', big: '#d5c2aa', giant: '#e0d2bd', glow: 'rgba(255,251,244,.92)', dark: false } },
      noite: { nome: 'Noite', kicker: 'CAFÉ COM', big: 'DEUS', script: 'café com Deus', giant: 'INTIMIDADE',
        th: { bg: '#1c140f', ink: '#d4a574', big: '#43301f', giant: '#261b13', glow: 'rgba(66,46,32,.9)', dark: true } },
    } },
  ebd: { nome: 'EBD', hora: '09:00', quando: 'Domingo · 9h', dow: 0,
    modelos: {
      classico: { nome: 'Clássico', kicker: 'ESCOLA BÍBLICA', big: 'EBD', script: 'dominical', giant: 'BÍBLIA',
        th: { bg: '#e8e6da', ink: '#35502f', big: '#d0d3bf', giant: '#dcdccd', glow: 'rgba(252,252,246,.92)', dark: false } },
      noite: { nome: 'Noite', kicker: 'ESCOLA BÍBLICA', big: 'EBD', script: 'dominical', giant: 'BÍBLIA',
        th: { bg: '#141d14', ink: '#b6d39a', big: '#2a3a28', giant: '#1a251a', glow: 'rgba(38,54,36,.9)', dark: true } },
    } },
};
const PREGADORES = [
  { id: 'pr-joaquim', nome: 'Pr. Joaquim' },
  { id: 'dc-fernando', nome: 'Dc. Fernando' },
  { id: 'pb-valdeir', nome: 'Pb. Valdeir' },
  { id: 'elias', nome: 'Elias' },
  { id: 'josy', nome: 'Josy', f: true },
  { id: 'outro', nome: 'Outro' },
];

const FORMATOS = {
  story: { nome: 'Status e Stories', w: 1080, h: 1920, desc: '1080 × 1920', onde: 'Status do WhatsApp, Instagram e Facebook' },
  feed: { nome: 'Feed', w: 1080, h: 1350, desc: '1080 × 1350', onde: 'Post no feed do Instagram e Facebook' },
};
const PREGADOR_PADRAO = 'pr-joaquim';

const VIDEO_SEG = 8;      // duração do vídeo (s)
const FPS = 30;
