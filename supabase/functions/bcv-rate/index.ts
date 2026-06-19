import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sources = [
      {
        url: "https://rates.dolarvzla.com/current.json",
        extract: (d: any) => ({
          rate: d?.USD?.rate || d?.usd?.rate,
          fecha: d?.date || d?.fecha
        })
      },
      {
        url: "https://ve.dolarapi.com/v1/dolares/oficial",
        extract: (d: any) => ({
          rate: d?.promedio,
          fecha: d?.fechaActualizacion?.slice(0, 10)
        })
      },
      {
        url: "https://pydolarve.org/api/v1/dollar?page=bcv",
        extract: (d: any) => ({
          rate: d?.monitors?.usd?.price,
          fecha: d?.monitors?.usd?.last_update
        })
      }
    ];

    let rate = null;
    let fecha = new Date().toISOString().slice(0, 10);
    let usedSource = null;

    for (const s of sources) {
      try {
        const res = await fetch(s.url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Sloty/1.0"
          },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) continue;
        const data = await res.json();
        const extracted = s.extract(data);
        if (extracted.rate && Number(extracted.rate) > 100) {
          rate  = Number(extracted.rate);
          fecha = extracted.fecha || fecha;
          usedSource = s.url;
          break;
        }
      } catch(e) {
        console.warn(`Source failed: ${s.url}`, e);
        continue;
      }
    }

    if (!rate) {
      return new Response(JSON.stringify({
        error: "No se pudo obtener la tasa BCV",
        rate: null,
        fecha: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    return new Response(JSON.stringify({
      rate,
      fecha,
      source: usedSource,
      cached_at: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800"
      }
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
