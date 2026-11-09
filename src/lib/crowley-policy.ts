export type AiProvider = "deepseek" | "ollama";
export function chooseProvider(text: string): AiProvider {
  return text.length > 450 || /estrat[eé]gia|anal[ií]s|analis|diagn[oó]st|gerar|criar|montar|site|p[aá]gina|funil|c[oó]digo|program|cbo|escala|agente|monitore|monitorar|acompanhe|vigie/i.test(text) ? "deepseek" : "ollama";
}
export const ruleActionSchemaDescription = `ACAO: {"tipo":"regra","id":"<id campanha ou *>","nome":"...","perfil":"teste|escala|manutencao","gastoSemVenda":0,"cpaMax":0,"roasEscala":0,"frequenciaMax":0,"percentualEscala":20,"tetoDiario":0,"horas":[0,24],"autonomia":"auto|aprovar|avisar"}`;