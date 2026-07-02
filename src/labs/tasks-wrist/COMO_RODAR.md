# Como Rodar — Tasks Wrist Lab (M069B)

IP desta máquina na rede local: **192.168.0.140**

---

## Passo 1 — Subir o report server (porta 5174)

Abra um terminal na raiz do projeto e rode:

```
node src/labs/tasks-wrist/reportServer.mjs
```

Deixe rodando. Quando o lab terminar a calibração, o relatório será
salvo automaticamente em `src/labs/tasks-wrist/M069B_FILTER_CALIBRATION_REPORT.md`.

---

## Passo 2 — Subir o lab em HTTPS

Em outro terminal, na raiz do projeto:

```
npm run lab:m069b
```

Na **primeira vez**, o `vite-plugin-mkcert` vai:
1. Baixar e instalar a ferramenta `mkcert` automaticamente
2. Criar um certificado HTTPS local confiável
3. Pedir confirmação de administrador (clique em Sim)

Depois disso, o Vite sobe em `https://0.0.0.0:5173`.

---

## Passo 3 — Abrir no celular

Certifique-se de que o celular está **na mesma rede Wi-Fi** que este computador.

Abra no navegador do celular:

```
https://192.168.0.140:5173/?lab=tasks-wrist&auto=1
```

Na primeira vez pode aparecer aviso de certificado — clique em
"Avançado → Continuar mesmo assim" (ou equivalente no seu navegador).
Após a primeira aceitação, o mkcert evita esse aviso nas próximas vezes.

---

## Fluxo automático (?auto=1)

1. Câmera abre automaticamente
2. Quando detectar o pulso → conta 3-2-1 → grava 3s parado → grava 4s lento
3. Testa 49 combinações de filtro
4. Aplica o melhor preset automaticamente
5. Envia relatório ao report server (porta 5174)
6. Exibe tela de conclusão com o melhor combo

**Sem ?auto=1:** modo manual — use os botões do painel à direita.

---

## Resumo dos 2 comandos + 1 URL

```
node src/labs/tasks-wrist/reportServer.mjs
npm run lab:m069b
https://192.168.0.140:5173/?lab=tasks-wrist&auto=1
```
