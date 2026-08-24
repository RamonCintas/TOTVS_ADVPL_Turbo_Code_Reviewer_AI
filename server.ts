import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit to handle potentially large source code files
  app.use(express.json({ limit: "50mb" }));

  // API route for analyzing ADVPL diff
  app.post("/api/analyze", async (req, res) => {
    try {
      const { diffText } = req.body;
      if (!diffText) {
        return res.status(400).json({ error: "diffText is required" });
      }

      const systemInstruction = `Você é um Auditor Sênior de Sistemas Protheus especializado em ADVPL/TLPP, arquitetura TOTVS e tuning avançado de performance.

Sua função é realizar uma auditoria técnica profunda do Diff recebido.

Analise criticamente:

1. Gargalos de performance:
- Queries SQL em loops
- Falta de ChangeQuery()
- DbSkip excessivo
- Processamentos redundantes
- Locks indevidos
- Uso incorreto de índices
- Gargalos em FWTemporaryTable

2. Problemas de escopo:
- Uso incorreto de Private/Public
- Variáveis globais perigosas
- Vazamento de contexto
- Shadowing

3. Violação de padrões Protheus:
- Gravação direta em tabelas
- Ausência de MsExecAuto
- Bypass de validações padrão
- Manipulação indevida de SXs
- Violação de pontos de entrada

4. Problemas transacionais:
- Falta de Begin Transaction
- Ausência de DisarmTransaction()
- RestArea ausente
- RpcClearEnv ausente

5. Riscos críticos:
- Deadlocks
- SQL Injection
- Corrupção de dados
- Concorrência
- Integridade transacional

6. Embedded SQL:
- Sintaxe inválida
- Alias incorretos
- SQL sem parametrização

7. Qualidade arquitetural:
- Acoplamento excessivo
- Complexidade alta
- Duplicação de código
- Violações SOLID/TOTVS

SAÍDA OBRIGATÓRIA:

Retorne EXCLUSIVAMENTE um HTML COMPLETO E AUTÔNOMO.

REGRAS:
- NÃO utilize markdown
- NÃO utilize \`\`\`html
- COMEÇAR com <!DOCTYPE html>
- FINALIZAR com </html>

O HTML deve possuir:
- CSS embutido
- tema dark premium
- design executivo corporativo
- layout responsivo
- tabelas profissionais
- indicadores visuais

Criticidade:
- Vermelho = Crítico
- Laranja = Médio
- Azul = Atenção
- Verde = Correto

O relatório deve conter:

1. Resumo Executivo
2. Score Geral
3. Riscos Críticos
4. Problemas Encontrados
5. Explicação Técnica
6. Sugestões de Refatoração
7. Impacto de Performance
8. Impacto Arquitetural
9. Impacto no Banco
10. Checklist Final
11. Conclusão Técnica

O HTML precisa parecer um relatório enterprise de auditoria premium.`;

      const prompt = `Aqui está o Diff do código ADVPL/TLPP a ser analisado:\n\n` + diffText;

      let response;
      const modelsToTry = [
        "gemini-3.1-pro-preview",
        "gemini-3-flash-preview",
        "gemini-2.0-flash-exp"
      ];
      
      let lastError;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                  systemInstruction,
                  temperature: 0.2,
              }
          });
          console.log(`Successfully generated report using ${modelName}`);
          break; // Success!
        } catch (error: any) {
          const isRateLimit = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("exceeded") || error?.message?.includes("RESOURCE_EXHAUSTED");
          if (isRateLimit) {
            console.log(`[Rate Limit] Model ${modelName} exceeded quota. Trying next model...`);
          } else {
            console.warn(`[Error] Model ${modelName} failed (${error.message}). Trying next...`);
          }
          lastError = error;
        }
      }

      if (!response) {
        console.error("All Gemini models failed:", lastError);
        const isRateLimit = lastError?.status === 429 || lastError?.message?.includes("429") || lastError?.message?.includes("exceeded your current quota") || lastError?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRateLimit) {
          return res.status(429).json({ error: "Limite de quota excedido na API Gemini. Verifique os limites da sua chave de API ou tente novamente." });
        }
        throw lastError;
      }

      let htmlOutput = response.text || "";
      
      // Cleanup markdown artifacts if any
      if (htmlOutput.includes("```html")) {
          htmlOutput = htmlOutput.replace(/```html/g, "").replace(/```/g, "");
      }
      if (htmlOutput.includes("```")) {
          htmlOutput = htmlOutput.replace(/```/g, "");
      }
      htmlOutput = htmlOutput.trim();

      res.setHeader('Content-Type', 'text/html');
      res.send(htmlOutput);
    } catch (error) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: "Failed to compile the report" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Since this is express 4, use '*'
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
