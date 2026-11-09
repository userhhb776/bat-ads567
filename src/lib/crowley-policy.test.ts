import { describe, expect, it } from "vitest";
import { chooseProvider } from "./crowley-policy";
describe("Crowley automatic routing", () => {
  it("uses Ollama for simple greetings", () => expect(chooseProvider("Olá")).toBe("ollama"));
  it("uses DeepSeek for site generation", () => expect(chooseProvider("Crie uma página de vendas")).toBe("deepseek"));
  it("uses DeepSeek for strategic agent work", () => expect(chooseProvider("Monitore a campanha e monte uma estratégia de escala")).toBe("deepseek"));
});