import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { AiEnergyAdvisor } from "./AiEnergyAdvisor";
import { ptBR } from "@/i18n/locales/pt-BR";

const mockSuccessData = {
  daily: {
    summary: "Geração prevista de 62 kWh para hoje com sol pleno.",
    recommendations: [
      { title: "Manter limpo", description: "Placas limpas garantem 98% de rendimento.", icon: "tools" },
      { title: "Horário de pico", description: "Consumo ideal entre 11h e 14h.", icon: "flashlight" },
    ],
  },
  monthly: {
    summary: "Previsão mensal de 1.850 kWh, superando a média.",
    recommendations: [
      { title: "Meta mensal", description: "Balanço positivo esperado na cooperativa.", icon: "dollar" },
    ],
  },
  modelUsed: "gemini-2.5-flash",
  quotaCount: 2,
  maxPrimaryQuota: 4,
  isCached: true,
};

let lastPostPayload: unknown = null;

const server = setupServer(
  http.get("/api/ai-advisor", () => {
    return HttpResponse.json(mockSuccessData);
  }),
  http.post("/api/ai-advisor", async ({ request }) => {
    lastPostPayload = await request.json();
    return HttpResponse.json({
      ...mockSuccessData,
      daily: {
        ...mockSuccessData.daily,
        summary: "Análise atualizada via Gemini com dados ao vivo.",
      },
      isCached: false,
      quotaCount: 3,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  lastPostPayload = null;
});
afterAll(() => server.close());

describe("AiEnergyAdvisor", () => {
  it("loads and displays cached analysis and recommendations", async () => {
    render(<AiEnergyAdvisor nominalKwp={16} />);

    expect(screen.getByRole("button", { name: /Consultando|Regerar/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Geração prevista de 62 kWh para hoje com sol pleno.")).toBeInTheDocument();
    });

    expect(screen.getByText("Manter limpo")).toBeInTheDocument();
    expect(screen.getByText("Horário de pico")).toBeInTheDocument();

    expect(screen.getByText(/Gemini 2.5 Flash · 2\/4/)).toBeInTheDocument();
  });

  it("allows toggling between Daily and Monthly views", async () => {
    render(<AiEnergyAdvisor nominalKwp={16} />);

    await waitFor(() => {
      expect(screen.getByText("Geração prevista de 62 kWh para hoje com sol pleno.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mensal/ }));

    expect(screen.getByText("Previsão mensal de 1.850 kWh, superando a média.")).toBeInTheDocument();
    expect(screen.getByText("Meta mensal")).toBeInTheDocument();
  });

  it("displays error message when request fails", async () => {
    server.use(
      http.get("/api/ai-advisor", () => {
        return HttpResponse.json({ error: "Daily quota exhausted" }, { status: 429 });
      }),
    );

    render(<AiEnergyAdvisor nominalKwp={16} />);

    await waitFor(() => {
      expect(screen.getByText(/Daily quota exhausted/)).toBeInTheDocument();
    });
  });

  it("sends POST with force: true and updates data when clicking Regenerate", async () => {
    render(<AiEnergyAdvisor nominalKwp={16} />);

    await waitFor(() => {
      expect(screen.getByText("Geração prevista de 62 kWh para hoje com sol pleno.")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /Regerar/ });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText("Análise atualizada via Gemini com dados ao vivo.")).toBeInTheDocument();
    });

    expect(lastPostPayload).toEqual({
      force: true,
      nominalKwp: 16,
    });
  });

  it("shows only the unavailable message when there is no analysis for today", async () => {
    server.use(
      http.get("/api/ai-advisor", () =>
        HttpResponse.json({ error: ptBR.aiAdvisor.unavailable, unavailable: true }, { status: 503 }),
      ),
    );

    render(<AiEnergyAdvisor nominalKwp={16} />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(ptBR.aiAdvisor.unavailable))).toBeInTheDocument();
    });
    expect(screen.queryByText("Manter limpo")).not.toBeInTheDocument();
  });

  it("keeps today's analysis and reports the error when regeneration fails", async () => {
    server.use(
      http.post("/api/ai-advisor", () =>
        HttpResponse.json({ error: ptBR.aiAdvisor.unavailable, unavailable: true }, { status: 503 }),
      ),
    );

    render(<AiEnergyAdvisor nominalKwp={16} />);
    await waitFor(() => {
      expect(screen.getByText("Geração prevista de 62 kWh para hoje com sol pleno.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Regerar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(ptBR.aiAdvisor.unavailable);
    expect(screen.getByText("Geração prevista de 62 kWh para hoje com sol pleno.")).toBeInTheDocument();
  });
});
