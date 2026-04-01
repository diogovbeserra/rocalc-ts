# ROCalc TypeScript Replatform

Projeto em TypeScript (React + Vite) com bridge de compatibilidade para manter paridade visual/funcional do snapshot legado.

## Estrutura

- `src/features/legacy-bridge`: componente TypeScript que carrega a aplicacao legada.
- `src/shared/config`: configuracao tipada da URL de entrada legada.
- `public/legacy`: snapshot estatico completo da aplicacao original.

## Execucao local

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

## Build para publicacao

```bash
npm run build
npm run preview
```

Artefatos finais ficam em `dist/`.

## Sincronizar atualizacoes de item/formula do upstream

Este projeto puxa atualizacoes automaticamente destes repositorios:
- `https://github.com/attackjom/tong-calc-ro-host`
- `https://github.com/Diwesta-Nut/tong-calc-ro-host`
- `https://github.com/turugrura/tong-calc-ro-host`

Para sincronizar os dados/arquivos relacionados a itens:

```bash
npm run sync:upstream
```

Comportamento do sync:
- Faz merge incremental (na ordem acima), adicionando apenas dados/campos faltantes.
- Nao sobrescreve valores locais ja existentes em `item.json` e `monster.json`.
- Copia apenas imagens faltantes.
- Para arquivos JSON em formato array (ex.: `hp_sp_table.json`), so substitui quando o source for maior.  
- Para permitir substituir array mesmo quando menor (PowerShell):

```bash
$env:ROCALC_SYNC_ALLOW_SMALLER='1'; npm run sync:upstream
```

O comando atualiza apenas:

- `public/legacy/assets/demo/data`
- `public/legacy/assets/demo/images/items`
- `public/legacy/assets/demo/images/jobs`
- `public/legacy/assets/demo/images/others`

Assim, customizacoes locais de layout/texto (ex.: cabecalho) ficam preservadas.
Os detalhes da ultima sincronizacao ficam em `public/legacy/.upstream-sync.json`, incluindo commits e estatisticas por repositorio.

## Observacao de migracao

Como o material de origem disponivel esta compilado/minificado (sem codigo-fonte TypeScript original), esta base mantem 100% da experiencia atual via bridge e permite portar funcionalidades para TypeScript por fases, sem quebrar producao.


## Publicacao Online (GitHub Pages)

Este projeto esta configurado para deploy automatico no GitHub Pages via GitHub Actions.

Fluxo:
- git push na branch main
- Action Deploy to GitHub Pages gera o build e publica

A URL fica no formato:
- https://<usuario>.github.io/<repositorio>/

Dominio custom (opcional):
1. Crie o dominio/subdominio no seu provedor DNS.
2. Em GitHub: Settings > Pages > Custom domain.
3. Configure DNS:
   - Subdominio: CNAME para <usuario>.github.io
   - Dominio raiz: registros A para IPs do GitHub Pages (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153)
4. Aguarde propagacao e habilite HTTPS no Pages.

