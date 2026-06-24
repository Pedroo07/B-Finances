import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    console.log("Mensagem recebida do WhatsApp:", JSON.stringify(data, null, 2));

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}