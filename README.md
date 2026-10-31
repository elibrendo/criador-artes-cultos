# Criador de Artes — Cultos (Filadélfia)

Gera artes de divulgação dos cultos (PNG e vídeo MP4 animado), com remoção de fundo da foto do pregador feita no próprio navegador.

## Como abrir

- **Mais simples:** dê dois cliques em `index.html` (abre no navegador).
- **Pelo VS Code:** instale a extensão **Live Server** (o VS Code vai sugerir), clique com o botão direito em `index.html` → *Open with Live Server*. A página recarrega sozinha a cada alteração salva.

Use Chrome ou Edge atualizados (MP4 e recorte funcionam melhor neles).

## Estrutura

```
index.html                    página (estrutura dos 7 passos)
css/style.css                 visual da interface
js/config.js                  ⭐ cultos, modelos, horários, pregadores, endereço
js/app.js                     desenho da arte, animação, passos, fotos, exportação
js/logos.js                   logos ADMMP e Filadélfia (base64)
js/motor-recorte/             remoção de fundo (não precisa mexer)
  modelo-u2netp.js            rede neural U2-Net-P (pesos)
  u2net-gl.js                 execução na placa de vídeo (rápido)
  u2net-cpu.js                plano B no processador (mais lento)
```

## Tarefas comuns (tudo em `js/config.js`)

**Adicionar um modelo a um culto** — dentro de `CULTOS.<culto>.modelos`, copie um bloco e mude a chave:

```js
festivo: { nome: 'Festivo', kicker: 'CULTO DA', big: 'FAMÍLIA', script: 'família', giant: 'LARES',
  th: { bg: '#fff4e0', ink: '#b34a1c', big: '#f0dcc0', giant: '#f6ead6', glow: 'rgba(255,255,250,.92)', dark: false } },
```

- `kicker` texto pequeno acima do título · `big` palavra grande com textura · `script` palavra cursiva · `giant` palavra gigante no fundo
- `th.bg` fundo · `th.ink` cor principal (textos, etiqueta, logos) · `th.big`/`th.giant` cores das palavras grandes · `dark: true` para fundos escuros

**Mudar dia/horário padrão** — `slots` do culto (`dow`: 0 = domingo … 6 = sábado; `null` = não muda a data).

**Adicionar pregador** — inclua em `PREGADORES` (`f: true` faz a etiqueta sair "PRELETORA").

**Endereço** — `ENDERECO`.

## Fotos dos pregadores

Rodando no computador, a biblioteca de fotos fica salva **neste navegador** (IndexedDB). Na versão publicada no Claude, as fotos ficam numa biblioteca compartilhada.
