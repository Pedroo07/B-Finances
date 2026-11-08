import { NextResponse } from "next/server";
import {
  buildGeminiPdfPrompt,
  generateGeminiPdfJsonOnServer,
} from "@/lib/importer/pdf/gemini";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (text.length < 10) {
      return NextResponse.json(
        { error: "Texto da fatura inválido ou vazio." },
        { status: 400 },
      );
    }

    const prompt = buildGeminiPdfPrompt(text);
    const rawJson = await generateGeminiPdfJsonOnServer(prompt);

    return NextResponse.json({ rawJson });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível processar o texto da fatura com o Gemini.",
      },
      { status: 500 },
    );
  }
}
